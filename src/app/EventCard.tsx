import type { SiteData, SiteEvent, SiteVenue } from "../lib/site-data";
import { FollowButton } from "./FollowButton";
import { artistHref, dayName, GENRE_LABEL, formatDate, formatTime, isNew, parts, venueHref } from "./lib";

const STATUS_LABEL = { u: "Uitverkocht", v: "Verplaatst", g: "Geannuleerd" } as const;
const COUNTRY = { NL: "Nederland", BE: "België", DE: "Duitsland", GB: "Verenigd Koninkrijk", FR: "Frankrijk" } as const;

export function Flag({ cc }: { cc: SiteVenue["cc"] }) {
  return <span className={`flag flag--${cc}`} role="img" aria-label={COUNTRY[cc]} title={COUNTRY[cc]} />;
}

/**
 * One line of the agenda, set like the tour dates on the back of a shirt: day, act (with ☆), where, tickets.
 * `fresh`: the rule for the "Nieuw" label; default: first seen in the last 7 days. Mijn radar uses "since the previous visit".
 */
export function EventCard({ e, venue, data, showVenue = true, fresh: isFresh }: { e: SiteEvent; venue: SiteVenue; data: SiteData; showVenue?: boolean; fresh?: (e: SiteEvent) => boolean }) {
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
          {single ? (
            <>
              <a href={artistHref(e.a[0])}>{e.t}</a> <FollowButton name={e.a[0]} />
            </>
          ) : (
            e.t
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
            {e.h ? formatTime(e.s) : "tijd volgt"}
          </time>
        </p>
        {(fresh || e.st || e.o || e.mg || (e.g && e.g !== "Concert")) && (
          <ul className="tags" aria-label="Kenmerken">
            {fresh && <li className="tag tag--new">Nieuw</li>}
            {e.st && <li className={`tag tag--${e.st}`}>{STATUS_LABEL[e.st]}</li>}
            {e.o && <li className="tag tag--sale">Voorverkoop vanaf {formatDate(e.o)}</li>}
            {e.mg?.map((g) =>
              g === "Dance & DJ" && e.ds?.length ? (
                e.ds.map((d) => (
                  <li key={d} className="tag tag--genre">
                    {d}
                  </li>
                ))
              ) : (
                <li key={g} className="tag tag--genre">
                  {g}
                </li>
              ),
            )}
            {e.g && e.g !== "Concert" && !(e.mg && (e.g === "Dance" || e.g === "Klassiek")) && <li className="tag">{GENRE_LABEL[e.g] ?? e.g}</li>}
          </ul>
        )}
      </div>
      {!cancelled && (
        <a className="row__tix" href={e.u} target="_blank" rel="noopener noreferrer">
          Tickets<span className="sr-only"> voor {e.t} (opent de site van de verkoper)</span>
        </a>
      )}
    </article>
  );
}
