import type { SiteData, SiteEvent, SiteVenue } from "../lib/site-data";
import { FollowButton } from "./FollowButton";
import { artistHref, dayName, GENRE_LABEL, formatDate, formatTime, isNew, parts, showHref, venueHref } from "./lib";
import { ProposalToggle } from "./Proposal";

const STATUS_LABEL = { u: "Uitverkocht", v: "Verplaatst", g: "Geannuleerd" } as const;
const COUNTRY = { NL: "Nederland", BE: "België", DE: "Duitsland", GB: "Verenigd Koninkrijk", FR: "Frankrijk" } as const;

export function Flag({ cc }: { cc: SiteVenue["cc"] }) {
  return <span className={`flag flag--${cc}`} role="img" aria-label={COUNTRY[cc]} title={COUNTRY[cc]} />;
}

/** Genre labels: the music genres (with the dance style when known); for other events the kind (Comedy, Sport…). */
function genreItems(e: SiteEvent) {
  // "Dance & DJ" and its style both, so the labels match the filter and its sub-filter (Techno, House…).
  const items = (e.mg ?? []).flatMap((g) => (g === "Dance & DJ" && e.ds?.length ? [g, ...e.ds] : [g]));
  if (e.g && e.g !== "Concert" && !(e.mg && (e.g === "Dance" || e.g === "Klassiek"))) items.push(GENRE_LABEL[e.g] ?? e.g);
  return [...new Set(items)].map((g) => (
    <li key={g} className="tag tag--genre">
      {g}
    </li>
  ));
}

/** Status and genre labels on their own (the show page). */
export function GenreTags({ e }: { e: SiteEvent }) {
  const items = genreItems(e);
  if (!items.length && !e.st) return null;
  return (
    <ul className="tags" aria-label="Kenmerken">
      {e.st && <li className={`tag tag--${e.st}`}>{STATUS_LABEL[e.st]}</li>}
      {items}
    </ul>
  );
}

/**
 * Where the button leads, said before you tap (Codex): the ticket seller, or the venue's page when the source gives
 * no ticket link; a sold-out show leads to the venue page. Cancelled shows get no button.
 */
export function TicketLink({ e, big = false }: { e: SiteEvent; big?: boolean }) {
  if (e.st === "g") return null;
  const soldOut = e.st === "u";
  const seller = !soldOut && e.u !== e.p;
  const label = soldOut ? (big ? "Uitverkocht, bekijk bij de zaal" : "Uitverkocht") : seller ? (big ? "Naar kaartverkoop" : "Kaarten") : big ? "Bekijk bij de zaal" : "Bij de zaal";
  return (
    <a className={`${big ? "btn btn--tix" : "row__tix"}${soldOut ? " row__tix--quiet" : ""}`} href={soldOut ? e.p : e.u} target="_blank" rel="noopener noreferrer">
      {label}
      <span className="sr-only">
        {" "}
        {e.t} ({seller ? "opent de kaartverkoop" : "opent de site van de zaal"})
      </span>
    </a>
  );
}

/**
 * One line of the agenda, set like the tour dates on the back of a shirt: day, act (with ☆), where, tickets.
 * `fresh`: the rule for the "Nieuw" label; default: first seen in the last 7 days. Mijn radar uses "since the previous visit".
 */
export function EventCard({
  e,
  venue,
  data,
  showVenue = true,
  fresh: isFresh,
  note,
}: {
  e: SiteEvent;
  venue: SiteVenue;
  data: SiteData;
  showVenue?: boolean;
  fresh?: (e: SiteEvent) => boolean;
  /** A change to point out, e.g. "Nu uitverkocht" in Mijn radar. */
  note?: (e: SiteEvent) => string | undefined;
}) {
  const changed = note?.(e);
  const p = parts(e.s);
  const cancelled = e.st === "g";
  const fresh = isFresh ? isFresh(e) : isNew(e, data);
  const single = e.a.length === 1;
  return (
    <article className={`row${cancelled ? " row--cancelled" : ""}`} aria-label={`${e.t}, ${formatDate(e.s)}, ${venue.n}`}>
      <p className="row__date" aria-hidden="true">
        <span className="row__wd">{dayName(e.s)}</span>
        <span className="row__d">{p.d}</span>
      </p>
      <div className="row__main">
        <h3 className="row__act">
          <a href={showHref(e)}>{e.t}</a>
          {single && (
            <>
              {" "}
              <FollowButton name={e.a[0]} />
            </>
          )}
        </h3>
        {!single && e.a.length > 0 && (
          <p className="row__with">
            {e.a.map((name, i) => (
              <span key={name}>
                {i > 0 && (i === e.a.length - 1 ? " en " : ", ")}
                <a href={artistHref(name)}>{name}</a> <FollowButton name={name} />
              </span>
            ))}
          </p>
        )}
        <p className="row__where">
          {showVenue && (
            <>
              <a href={venueHref(venue.id)}>{venue.n}</a> <span className="row__city">{venue.city}</span> <Flag cc={venue.cc} />{" "}
            </>
          )}
          <time dateTime={e.s}>
            <span className="sr-only">{formatDate(e.s)}, </span>
            {e.h ? formatTime(e.s) : "tijd nog onbekend"}
          </time>
        </p>
        {(fresh || changed || e.st || e.o || e.mg || (e.g && e.g !== "Concert")) && (
          <ul className="tags" aria-label="Kenmerken">
            {fresh && <li className="tag tag--new">Nieuw</li>}
            {changed && <li className="tag tag--new">{changed}</li>}
            {e.st && !changed && <li className={`tag tag--${e.st}`}>{STATUS_LABEL[e.st]}</li>}
            {e.o && <li className="tag tag--sale">Voorverkoop vanaf {formatDate(e.o)}</li>}
            {genreItems(e)}
          </ul>
        )}
      </div>
      <div className="row__act-col">
        <TicketLink e={e} />
        <ProposalToggle e={e} />
      </div>
    </article>
  );
}
