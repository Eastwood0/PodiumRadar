import { useEffect, useMemo, useRef, useState } from "react";
import type { SiteData, SiteVenue } from "../lib/site-data";
import { EventList } from "./EventList";
import { FollowButton } from "./FollowButton";
import { getFollowState, newSince, radarEvents, setFollowState, useFollows } from "./follow";
import { artistHref, bill, slug } from "./lib";
import { PageHead } from "./Pages";
import { cleanTyped, codeHref, createLink, formatCode, joinLink, type JoinMode, onSyncFailure, refreshLink, revokeLink, syncFailed, syncMessage, unlinkDevice } from "./sync";

type Common = { data: SiteData; venues: Map<string, SiteVenue> };

/** Screen 5 (bouwplan §9): the followed artists and all their coming shows, with "Nieuw" since the previous visit. */
export function Radar({ data, venues, joinCode }: Common & { joinCode?: string }) {
  const follows = useFollows();
  const [msg, setMsg] = useState("");
  const linkRef = useRef<HTMLElement>(null);
  // "Nieuw" compares with the data seen at the previous visit; this visit is saved once the whole agenda is in.
  const [previousVisit] = useState(() => getFollowState().lastVisit);
  useEffect(() => {
    if (data.complete) setFollowState({ ...getFollowState(), lastVisit: data.generatedAt.slice(0, 10) }, false);
  }, [data]);
  useEffect(() => {
    if (!joinCode && getFollowState().code) refreshLink().catch(() => undefined); // offline: keep the local list
  }, [joinCode]);

  const events = useMemo(() => radarEvents(data.events, follows.artists), [data, follows.artists]);
  const playing = new Set(events.flatMap((e) => e.a.map(slug)));
  const quiet = follows.artists.filter((a) => !playing.has(slug(a)));
  const fresh = (e: (typeof events)[number]) => newSince(e, previousVisit);
  const newCount = events.filter(fresh).length;
  const toLink = () => linkRef.current?.scrollIntoView({ behavior: "smooth", block: "start" });

  return (
    <>
      <PageHead title="Mijn radar" />
      {msg && (
        <p className="note" role="status">
          {msg}
        </p>
      )}
      {joinCode && <JoinPrompt code={joinCode} setMsg={setMsg} />}
      {follows.artists.length === 0 ? (
        <Suggestions data={data} venues={venues} />
      ) : (
        <>
          <details className="fold radar__follows">
            <summary>
              Gevolgde artiesten ({follows.artists.length}){follows.code ? " · gekoppeld" : ""}
            </summary>
            <ul className="follows" aria-label="Artiesten die je volgt">
              {follows.artists.map((a) => (
                <li key={a}>
                  <a href={artistHref(a)}>{a}</a> <FollowButton name={a} />
                </li>
              ))}
            </ul>
            <button type="button" className="linkbtn" onClick={toLink}>
              {follows.code ? "Koppeling beheren" : "Ook op je andere telefoon of laptop?"}
            </button>
          </details>
          {!data.complete ? (
            <p className="sub">De rest van de agenda wordt nog geladen…</p>
          ) : (
            quiet.length > 0 && <p className="sub">Nu geen shows: {quiet.join(", ")}. Je ziet het hier zodra er een bijkomt.</p>
          )}
          {newCount > 0 && (
            <p className="note" role="status">
              {newCount} {newCount === 1 ? "nieuwe show" : "nieuwe shows"} sinds je vorige bezoek (label “Nieuw”).
            </p>
          )}
          <EventList events={events} venues={venues} data={data} fresh={fresh} empty={<p>{data.complete ? "Geen van je artiesten staat nu in de agenda." : "De agenda wordt nog geladen…"}</p>} />
        </>
      )}
      <Link sectionRef={linkRef} setMsg={setMsg} />
    </>
  );
}

/** Empty state: the headliners of the coming 30 days (the same as the line-up on the overview), to follow with one tap. */
function Suggestions({ data, venues }: Common) {
  const top = useMemo(() => bill(data.events, venues, data.generatedAt).headliners.slice(0, 5), [data, venues]);
  return (
    <div className="empty">
      <p>Je volgt nog niemand. Tik op ☆ naast een artiest, of zoek bovenaan een naam en kies “Volg”.</p>
      {top.length > 0 && (
        <ul className="follows" aria-label="Binnenkort in de grote zalen">
          {top.map((a) => (
            <li key={a.name}>
              <a href={artistHref(a.name)}>{a.name}</a> <FollowButton name={a.name} />
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}

/** Opening a link code never links silently: the visitor chooses first (Codex review, 26 Nov 2026). */
function JoinPrompt({ code, setMsg }: { code: string; setMsg: (m: string) => void }) {
  const follows = useFollows();
  const [busy, setBusy] = useState(false);
  const [done, setDone] = useState(false);
  if (done || follows.code === code) return null;
  const close = () => {
    setDone(true);
    history.replaceState(null, "", "#radar");
  };
  const join = async (mode: JoinMode) => {
    setBusy(true);
    try {
      await joinLink(code, mode);
      setMsg("Gekoppeld: dit apparaat gebruikt nu dezelfde lijst als je andere apparaten.");
      close();
    } catch (e) {
      setMsg(syncMessage(e));
    } finally {
      setBusy(false);
    }
  };
  const own = follows.artists.length;
  return (
    <section className="note join" aria-labelledby="join-h">
      <h2 id="join-h" className="join__h">
        Koppelcode {formatCode(code).slice(0, 9)}… openen?
      </h2>
      <p>Daarmee ziet dit apparaat dezelfde lijst als het apparaat waar de code vandaan komt. Iedereen met deze code kan die lijst zien en aanpassen.</p>
      <div className="pair__actions">
        {own > 0 ? (
          <>
            <button type="button" className="btn" disabled={busy} onClick={() => join("samenvoegen")}>
              Koppelen en mijn {own} {own === 1 ? "artiest" : "artiesten"} toevoegen
            </button>
            <button type="button" className="btn" disabled={busy} onClick={() => join("overnemen")}>
              Koppelen, alleen die lijst gebruiken
            </button>
          </>
        ) : (
          <button type="button" className="btn" disabled={busy} onClick={() => join("overnemen")}>
            Koppelen
          </button>
        )}
        <button type="button" className="btn btn--quiet" disabled={busy} onClick={close}>
          Niet koppelen
        </button>
      </div>
    </section>
  );
}

/** Link code: the same list on another phone or laptop (B42). */
function Link({ sectionRef, setMsg }: { sectionRef: React.RefObject<HTMLElement | null>; setMsg: (m: string) => void }) {
  const follows = useFollows();
  const [busy, setBusy] = useState(false);
  const [typed, setTyped] = useState("");
  const [failing, setFailing] = useState(syncFailed());
  useEffect(() => onSyncFailure(setFailing), []);

  const run = async (task: () => Promise<unknown>, ok: string) => {
    setBusy(true);
    try {
      await task();
      setMsg(ok);
    } catch (e) {
      setMsg(syncMessage(e));
    } finally {
      setBusy(false);
      window.scrollTo({ top: 0, behavior: "smooth" }); // the message is at the top of the page
    }
  };
  const unlinkHere = () => {
    unlinkDevice();
    setMsg("Dit apparaat is ontkoppeld. Je lijst staat er nog; je andere apparaten blijven gekoppeld.");
    window.scrollTo({ top: 0, behavior: "smooth" });
  };
  const revoke = () => {
    if (confirm("De code werkt daarna op geen enkel apparaat meer. Doorgaan?")) run(revokeLink, "Code ingetrokken. Je lijst staat nog op dit apparaat; maak een nieuwe code om opnieuw te koppelen.");
  };

  const link = follows.code && typeof location !== "undefined" ? `${location.origin}${location.pathname}${codeHref(follows.code)}` : "";
  return (
    <section className="pair" aria-labelledby="link-h" ref={sectionRef}>
      <h2 id="link-h" className="h2">
        Op een ander apparaat
      </h2>
      {follows.code ? (
        <>
          <p>Open deze link op je andere telefoon of laptop, of typ daar de code. Deel hem niet: wie de code heeft, kan je lijst zien en aanpassen.</p>
          <p className="pair__code">
            <code>{formatCode(follows.code)}</code>
          </p>
          <div className="pair__actions">
            <button type="button" className="btn" onClick={() => navigator.clipboard?.writeText(link).then(() => setMsg("Link gekopieerd."), () => setMsg(link))}>
              Kopieer link
            </button>
            <button type="button" className="btn btn--quiet" disabled={busy} onClick={unlinkHere}>
              Dit apparaat ontkoppelen
            </button>
            <button type="button" className="btn btn--quiet" disabled={busy} onClick={revoke}>
              Code overal intrekken
            </button>
          </div>
          {failing && <p className="pair__msg">Je laatste wijziging staat nog niet op je andere apparaten; dat gebeurt zodra er weer verbinding is.</p>}
        </>
      ) : (
        <>
          <p>Maak een koppelcode; daarmee zet je dezelfde lijst op een ander apparaat. Er is geen account of e-mailadres nodig.</p>
          <div className="pair__actions">
            <button type="button" className="btn" disabled={busy || !follows.artists.length} onClick={() => run(createLink, "Code gemaakt. Je vindt hem onderaan bij “Op een ander apparaat”.")}>
              Maak koppelcode
            </button>
            {!follows.artists.length && <span className="pair__msg">Volg eerst een artiest.</span>}
          </div>
          <form
            className="pair__join"
            onSubmit={(ev) => {
              ev.preventDefault();
              const code = cleanTyped(typed);
              if (code) location.hash = codeHref(code);
            }}
          >
            <label htmlFor="link-code">Heb je al een code?</label>
            <input id="link-code" value={typed} onChange={(ev) => setTyped(ev.target.value)} autoComplete="off" spellCheck={false} inputMode="text" placeholder="XXXX XXXX …" />
            <button type="submit" className="btn" disabled={busy || !typed.trim()}>
              Verder
            </button>
          </form>
        </>
      )}
    </section>
  );
}
