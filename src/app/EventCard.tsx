import type { SiteData, SiteEvent, SiteVenue } from "../lib/site-data";
import { artistHref, dayName, formatDate, formatTime, isNew, monthShort, parts, venueHref } from "./lib";

const STATUS_LABEL = { u: "Uitverkocht", v: "Verplaatst", g: "Geannuleerd" } as const;

export function EventCard({ e, venue, data, showVenue = true }: { e: SiteEvent; venue: SiteVenue; data: SiteData; showVenue?: boolean }) {
  const p = parts(e.s);
  const cancelled = e.st === "g";
  const fresh = isNew(e, data);
  const single = e.a.length === 1;
  return (
    <article className={`ev${cancelled ? " ev--cancelled" : ""}`} aria-label={`${e.t}, ${formatDate(e.s)}, ${venue.n}`}>
      <div className="ev__date" aria-hidden="true">
        <span className="ev__wd">{dayName(e.s)}</span>
        <span className="ev__d">{p.d}</span>
        <span className="ev__m">{monthShort(p.m)}</span>
      </div>
      <div className="ev__body">
        <h3 className="ev__title">{single ? <a href={artistHref(e.a[0])}>{e.t}</a> : e.t}</h3>
        {!single && (
          <p className="ev__acts">
            {e.a.map((name, i) => (
              <span key={name}>
                {i > 0 && " · "}
                <a href={artistHref(name)}>{name}</a>
              </span>
            ))}
          </p>
        )}
        <p className="ev__meta">
          {showVenue && (
            <>
              <a href={venueHref(venue.id)}>{venue.n}</a>, {venue.city} <span className="cc">{venue.cc}</span>
              {" · "}
            </>
          )}
          <time dateTime={e.s}>
            <span className="sr-only">{formatDate(e.s)}</span>
            {e.h ? `${formatTime(e.s)} uur` : "tijd volgt"}
          </time>
        </p>
        <ul className="tags" aria-label="Kenmerken">
          {fresh && <li className="tag tag--new">Nieuw</li>}
          {e.st && <li className={`tag tag--${e.st}`}>{STATUS_LABEL[e.st]}</li>}
          {e.o && <li className="tag tag--sale">Voorverkoop {formatDate(e.o)}</li>}
          {e.g && e.g !== "Concert" && <li className="tag">{e.g}</li>}
        </ul>
      </div>
      {!cancelled && (
        <a className="ev__cta" href={e.u} target="_blank" rel="noopener noreferrer">
          Tickets<span className="sr-only"> voor {e.t} (opent de site van de verkoper)</span>
        </a>
      )}
    </article>
  );
}
