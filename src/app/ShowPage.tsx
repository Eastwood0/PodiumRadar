import { useMemo } from "react";
import type { SiteData, SiteEvent, SiteVenue } from "../lib/site-data";
import { BackLink } from "./BackLink";
import { EventCard, Flag, GenreTags, TicketLink } from "./EventCard";
import { FollowButton } from "./FollowButton";
import { artistHref, formatDate, formatTime, kindOf, showKey, slug, venueHref } from "./lib";
import { AREAS } from "./places";
import { ProposalToggle, shareText, siteBase } from "./Proposal";
import { sourceNote } from "./sources";

type Common = { data: SiteData; venues: Map<string, SiteVenue> };

/** Venues near this one: the same city, or a region they share (Zuid-Limburg, Randstad, Ruhrgebied…). */
function nearby(v: SiteVenue, venues: Map<string, SiteVenue>): Set<string> {
  const areas = AREAS.filter((a) => a.cities.includes(v.city));
  return new Set([...venues.values()].filter((x) => x.city === v.city || areas.some((a) => a.cities.includes(x.city))).map((x) => x.id));
}

/** How alike two shows are, for "Ook die avond": same genre or dance style first. */
const likeness = (a: SiteEvent, b: SiteEvent) => (b.ds?.some((d) => a.ds?.includes(d)) ? 2 : 0) + (b.mg?.some((g) => a.mg?.includes(g)) ? 1 : 0);

/** Route planner link: Google Maps' public URL scheme, no key, opens the app on a phone. */
export const routeHref = (v: SiteVenue) => `https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(`${v.n}, ${v.city}`)}`;

/**
 * One show: everything to decide and share it. Line-up, when and where, tickets or the venue page, route, share
 * with friends, other nights of the same act and, especially when it is sold out, what else is on that night nearby.
 */
export function ShowPage({ data, venues, showKey: key }: Common & { showKey: string }) {
  const e = useMemo(() => data.events.find((x) => showKey(x) === key), [data, key]);
  const v = e && venues.get(e.v);
  const others = useMemo(() => {
    if (!e) return [];
    const acts = new Set(e.a.map(slug));
    return data.events.filter((x) => x !== e && x.st !== "g" && x.a.some((a) => acts.has(slug(a)))).slice(0, 6);
  }, [data, e]);
  const sameNight = useMemo(() => {
    if (!e || !v) return [];
    const near = nearby(v, venues);
    const day = e.s.slice(0, 10);
    const sameCity = (x: SiteEvent) => (venues.get(x.v)?.city === v.city ? 1 : 0);
    return data.events
      .filter((x) => x !== e && x.s.slice(0, 10) === day && x.st !== "g" && near.has(x.v) && kindOf(x) === kindOf(e))
      .sort((a, b) => sameCity(b) - sameCity(a) || likeness(e, b) - likeness(e, a) || (a.st === "u" ? 1 : 0) - (b.st === "u" ? 1 : 0))
      .slice(0, 6);
  }, [data, e, v, venues]);

  if (!e || !v)
    return (
      <>
        <BackLink />
        <div className="empty">
          <h1 className="h1">Show niet gevonden</h1>
          <p>{data.complete ? "Deze show staat niet (meer) in de agenda. Misschien is hij voorbij of van de site gehaald." : "De rest van de agenda wordt nog geladen…"}</p>
          <p>
            <a href="#agenda">Naar de agenda</a>
          </p>
        </div>
      </>
    );

  const url = `${siteBase()}#show-${key}`;
  const when = `${formatDate(e.s)}${e.h ? `, ${formatTime(e.s)}` : ""}`;
  const note = sourceNote(data, v);
  return (
    <article className="show" aria-labelledby="show-h">
      <BackLink />
      <p className="show__when">
        <time dateTime={e.s}>{when}</time>
        {!e.h && <span className="show__unknown"> · aanvang nog onbekend</span>}
      </p>
      <h1 id="show-h" className="show__title">
        {e.t}
      </h1>
      <GenreTags e={e} />
      <p className="show__where">
        <a href={venueHref(v.id)}>{v.n}</a>, {v.city} <Flag cc={v.cc} />
      </p>
      <div className="show__actions">
        <TicketLink e={e} big />
        <a className="btn btn--quiet" href={routeHref(v)} target="_blank" rel="noopener noreferrer">
          Route<span className="sr-only"> naar {v.n} (opent kaarten)</span>
        </a>
        <button type="button" className="btn btn--quiet" onClick={() => shareText(e.t, `${e.t} · ${when} · ${v.n}, ${v.city}`, url)}>
          Deel show
        </button>
        <ProposalToggle e={e} big />
      </div>
      {note && <p className="show__note">{note}</p>}

      <h2 className="h2">Line-up</h2>
      <ul className="follows" aria-label="Line-up">
        {e.a.map((name) => (
          <li key={name}>
            <a href={artistHref(name)}>{name}</a> <FollowButton name={name} />
          </li>
        ))}
      </ul>

      {sameNight.length > 0 && (
        <section aria-labelledby="night-h">
          <h2 id="night-h" className="h2">
            {e.st === "u" ? "Uitverkocht? Ook die avond in de buurt" : "Ook die avond in de buurt"}
          </h2>
          <div className="list list--plain">
            {sameNight.map((x) => (
              <EventCard key={x.id} e={x} venue={venues.get(x.v)!} data={data} />
            ))}
          </div>
        </section>
      )}
      {others.length > 0 && (
        <section aria-labelledby="other-h">
          <h2 id="other-h" className="h2">
            Andere avonden
          </h2>
          <div className="list list--plain">
            {others.map((x) => (
              <EventCard key={x.id} e={x} venue={venues.get(x.v)!} data={data} />
            ))}
          </div>
        </section>
      )}
    </article>
  );
}
