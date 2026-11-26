import { useEffect, useMemo, useRef, useState } from "react";
import type { SiteData, SiteVenue } from "../lib/site-data";
import { EventList } from "./EventList";
import { FollowButton } from "./FollowButton";
import { getFollowState, newSince, radarEvents, setFollowState, useFollows } from "./follow";
import { artistHref, artistIndex, slug } from "./lib";
import { PageHead } from "./Pages";
import { codeHref, createLink, formatCode, joinLink, onSyncFailure, refreshLink, syncFailed, unlink } from "./sync";

type Common = { data: SiteData; venues: Map<string, SiteVenue> };

/** Screen 5 (bouwplan §9): the followed artists and all their coming shows, with "Nieuw" since the previous visit. */
export function Radar({ data, venues, joinCode }: Common & { joinCode?: string }) {
  const follows = useFollows();
  // "Nieuw" compares with the previous visit; this visit is saved for next time once the page is open.
  const previousVisit = useRef(getFollowState().lastVisit);
  useEffect(() => {
    setFollowState({ ...getFollowState(), lastVisit: new Date().toISOString() }, false);
  }, []);
  useEffect(() => {
    if (!joinCode && getFollowState().code) refreshLink().catch(() => undefined); // offline: keep the local list
  }, [joinCode]);

  const events = useMemo(() => radarEvents(data.events, follows.artists), [data, follows.artists]);
  const playing = new Set(events.flatMap((e) => e.a.map(slug)));
  const quiet = follows.artists.filter((a) => !playing.has(slug(a)));
  const fresh = (e: (typeof events)[number]) => newSince(e, previousVisit.current);
  const newCount = events.filter(fresh).length;

  return (
    <>
      <PageHead title="Mijn radar" />
      {follows.artists.length === 0 ? (
        <Suggestions data={data} />
      ) : (
        <>
          <ul className="follows" aria-label="Artiesten die je volgt">
            {follows.artists.map((a) => (
              <li key={a}>
                <a href={artistHref(a)}>{a}</a> <FollowButton name={a} />
              </li>
            ))}
          </ul>
          {quiet.length > 0 && <p className="sub">Nu geen shows: {quiet.join(", ")}. Je ziet het hier zodra er een bijkomt.</p>}
          {newCount > 0 && (
            <p className="note" role="status">
              {newCount} {newCount === 1 ? "nieuwe show" : "nieuwe shows"} sinds je vorige bezoek.
            </p>
          )}
          <EventList events={events} venues={venues} data={data} fresh={fresh} empty={<p>Geen van je artiesten staat nu in de agenda.</p>} />
        </>
      )}
      <Link joinCode={joinCode} />
    </>
  );
}

/** Empty state: five acts with the most shows coming up, to follow with one tap. */
function Suggestions({ data }: { data: SiteData }) {
  const top = useMemo(
    () =>
      artistIndex(data.events.filter((e) => e.c === "m" && e.st !== "g"))
        .sort((a, b) => b.count - a.count)
        .slice(0, 5),
    [data],
  );
  return (
    <div className="empty">
      <p>Je volgt nog niemand. Tik op ☆ naast een artiest, of zoek bovenaan een naam en kies “Volg”.</p>
      <ul className="follows" aria-label="Veel gespeeld">
        {top.map((a) => (
          <li key={a.slug}>
            <a href={artistHref(a.name)}>{a.name}</a> <FollowButton name={a.name} />
          </li>
        ))}
      </ul>
    </div>
  );
}

/** Link code: the same list on another phone or laptop (B42). */
function Link({ joinCode }: { joinCode?: string }) {
  const follows = useFollows();
  const [busy, setBusy] = useState(false);
  const [msg, setMsg] = useState("");
  const [typed, setTyped] = useState("");
  const [failing, setFailing] = useState(syncFailed());
  useEffect(() => onSyncFailure(setFailing), []);

  const run = async (task: () => Promise<unknown>, ok: string) => {
    setBusy(true);
    setMsg("");
    try {
      await task();
      setMsg(ok);
    } catch (e) {
      setMsg(String(e).includes("404") ? "Deze code bestaat niet (meer). Controleer de tekens." : String(e).includes("400") ? "Dit is geen geldige code." : "Koppelen lukt nu niet. Je lijst blijft op dit apparaat bewaard; probeer het later opnieuw.");
    } finally {
      setBusy(false);
    }
  };

  useEffect(() => {
    if (!joinCode) return;
    run(() => joinLink(joinCode), "Gekoppeld: je ziet nu dezelfde lijst als op je andere apparaat.").then(() => history.replaceState(null, "", "#radar"));
  }, [joinCode]);

  const link = follows.code && typeof location !== "undefined" ? `${location.origin}${location.pathname}${codeHref(follows.code)}` : "";
  return (
    <section className="pair" aria-labelledby="link-h">
      <h2 id="link-h" className="h2">
        Op een ander apparaat
      </h2>
      {follows.code ? (
        <>
          <p>Open deze link op je andere telefoon of laptop, of typ daar de code. Deel hem niet: wie de code heeft, kan je lijst aanpassen.</p>
          <p className="pair__code">
            <code>{formatCode(follows.code)}</code>
          </p>
          <div className="pair__actions">
            <button type="button" className="btn" onClick={() => navigator.clipboard?.writeText(link).then(() => setMsg("Link gekopieerd."), () => setMsg(link))}>
              Kopieer link
            </button>
            <button type="button" className="btn btn--quiet" disabled={busy} onClick={() => run(unlink, "Ontkoppeld. Je lijst staat nog op dit apparaat.")}>
              Ontkoppel
            </button>
          </div>
          {failing && <p className="pair__msg">Je laatste wijziging staat nog niet op je andere apparaten (geen verbinding).</p>}
        </>
      ) : (
        <>
          <p>Maak een koppelcode; daarmee zet je dezelfde lijst op een ander apparaat. Er is geen account of e-mailadres nodig.</p>
          <div className="pair__actions">
            <button type="button" className="btn" disabled={busy} onClick={() => run(createLink, "Code gemaakt.")}>
              Maak koppelcode
            </button>
          </div>
          <form
            className="pair__join"
            onSubmit={(ev) => {
              ev.preventDefault();
              if (typed.trim()) run(() => joinLink(typed.replace(/[\s-]/g, "").toUpperCase()), "Gekoppeld.");
            }}
          >
            <label htmlFor="link-code">Heb je al een code?</label>
            <input id="link-code" value={typed} onChange={(ev) => setTyped(ev.target.value)} autoComplete="off" spellCheck={false} inputMode="text" placeholder="XXXX XXXX …" />
            <button type="submit" className="btn" disabled={busy || !typed.trim()}>
              Koppel
            </button>
          </form>
        </>
      )}
      {msg && (
        <p className="pair__msg" role="status">
          {msg}
        </p>
      )}
    </section>
  );
}
