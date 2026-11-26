import { Fragment, useEffect, useMemo, useRef, useState } from "react";
import type { SiteData, SiteEvent, SiteVenue } from "../lib/site-data";
import { Flag } from "./EventCard";
import { EventList } from "./EventList";
import { FilterBar } from "./FilterBar";
import { followedCells, useFollows } from "./follow";
import { applyFilters, type Filters, LEVELS, level, MONTHS_LONG, monthKey, monthShort, venueHref } from "./lib";

const COUNTRIES = [
  { cc: "NL", label: "Nederland" },
  { cc: "BE", label: "België" },
  { cc: "DE", label: "Duitsland" },
] as const;

/**
 * The wall chart: venues down, months across. Each cell shows how many shows that venue has that month;
 * the colour gets stronger with the number. Tap a cell to see the shows.
 */
export function Overview({ data, venues, months, filters, setFilters }: { data: SiteData; venues: Map<string, SiteVenue>; months: string[]; filters: Filters; setFilters: (f: Filters) => void }) {
  const [picked, setPicked] = useState<{ v: string; m: string } | null>(null);
  const dialog = useRef<HTMLDialogElement>(null);
  useEffect(() => {
    const d = dialog.current;
    if (picked && d && !d.open) d.showModal();
  }, [picked]);
  const filtered = useMemo(() => applyFilters(data.events, venues, { ...filters, venue: "", month: "" }), [data, venues, filters]);

  const counts = useMemo(() => {
    const map = new Map<string, SiteEvent[]>();
    for (const e of filtered) {
      const k = `${e.v}|${monthKey(e.s)}`;
      const list = map.get(k);
      if (list) list.push(e);
      else map.set(k, [e]);
    }
    return map;
  }, [filtered]);
  const withSource = new Set(data.events.map((e) => e.v));
  const follows = useFollows();
  // Cells with a show of an artist you follow get a star (B27).
  const starred = useMemo(() => followedCells(filtered, follows.artists, monthKey), [filtered, follows.artists]);

  const rows = data.venues.filter((v) => (!filters.country || v.cc === filters.country) && (!filters.tier || v.tier === filters.tier));
  const pickedEvents = picked ? counts.get(`${picked.v}|${picked.m}`) ?? [] : [];
  const pickedVenue = picked ? venues.get(picked.v) : undefined;

  return (
    <section className="wall" aria-labelledby="wall-h">
      <h2 id="wall-h" className="h2">Per zaal, per maand</h2>
      <p className="sub">Tik op een vakje voor de shows.</p>
      <FilterBar data={data} filters={filters} setFilters={setFilters} show={{ venue: false, month: false }} count={filtered.length} />
      <div className="board" role="region" aria-label="Overzicht per zaal en maand" tabIndex={0}>
        <table className="tl">
          <thead>
            <tr>
              <th scope="col" className="tl__venue">
                Zaal
              </th>
              {months.map((m, i) => {
                const [y, mm] = m.split("-");
                return (
                  <th scope="col" key={m} title={`${MONTHS_LONG[+mm - 1]} ${y}`}>
                    {monthShort(+mm)}
                    {(i === 0 || mm === "01") && <span className="tl__y">’{y.slice(2)}</span>}
                  </th>
                );
              })}
            </tr>
          </thead>
          <tbody>
            {COUNTRIES.filter((c) => rows.some((v) => v.cc === c.cc)).map((c) => (
              <Fragment key={c.cc}>
                <tr className="tl__group">
                  <th colSpan={months.length + 1} scope="colgroup">
                    <Flag cc={c.cc} /> {c.label}
                  </th>
                </tr>
                {rows
                  .filter((v) => v.cc === c.cc)
                  .map((v) => (
                    <tr key={v.id}>
                      <th scope="row" className="tl__venue">
                        <a href={venueHref(v.id)}>{v.n}</a>
                        <span>
                          {v.city}
                          {v.tier === "B" ? ", middelgroot" : ""}
                        </span>
                      </th>
                      {!withSource.has(v.id) ? (
                        <td colSpan={months.length} className="tl__nosrc">
                          <a href="#bronnen">nog geen bron</a>
                        </td>
                      ) : (
                        months.map((m) => {
                          const n = counts.get(`${v.id}|${m}`)?.length ?? 0;
                          const sel = picked?.v === v.id && picked.m === m;
                          const star = starred.has(`${v.id}|${m}`);
                          return (
                            <td key={m}>
                              {n > 0 && (
                                <button
                                  type="button"
                                  className={`cell cell--l${level(n)}${sel ? " is-sel" : ""}${star ? " is-star" : ""}`}
                                  aria-haspopup="dialog"
                                  aria-label={`${v.n}, ${MONTHS_LONG[+m.slice(5) - 1]}: ${n} ${n === 1 ? "event" : "events"}${star ? ", met een artiest die je volgt" : ""}`}
                                  onClick={() => setPicked({ v: v.id, m })}
                                >
                                  {n}
                                </button>
                              )}
                            </td>
                          );
                        })
                      )}
                    </tr>
                  ))}
              </Fragment>
            ))}
          </tbody>
        </table>
      </div>
      <div className="legend" aria-hidden="true">
        <span>Events per maand</span>
        {LEVELS.map((l, i) => (
          <span key={l.label} className="legend__item">
            <i className={`cell cell--l${i + 1}`} />
            {l.label}
          </span>
        ))}
        {starred.size > 0 && (
          <span className="legend__item">
            <i className="cell cell--l1 is-star" />
            met een artiest die je volgt
          </span>
        )}
      </div>
      <dialog
        ref={dialog}
        className="sheet"
        aria-labelledby="sheet-title"
        onClose={() => setPicked(null)}
        onClick={(ev) => {
          if (ev.target === ev.currentTarget) ev.currentTarget.close(); // tap on the backdrop
        }}
      >
        {picked && pickedVenue && (
          <div className="sheet__in">
            <header className="sheet__h">
              <div>
                <h2 id="sheet-title">
                  <a href={venueHref(pickedVenue.id)} onClick={() => dialog.current?.close()}>
                    {pickedVenue.n}
                  </a>
                </h2>
                <p className="sheet__sub">
                  {MONTHS_LONG[+picked.m.slice(5) - 1]} {picked.m.slice(0, 4)}, {pickedEvents.length} {pickedEvents.length === 1 ? "event" : "events"}
                </p>
              </div>
              <button type="button" className="close" onClick={() => dialog.current?.close()}>
                <span aria-hidden="true">×</span>
                <span className="sr-only">Sluiten</span>
              </button>
            </header>
            <EventList key={`${picked.v}${picked.m}`} events={pickedEvents} venues={venues} data={data} showVenue={false} empty="Geen events." />
          </div>
        )}
      </dialog>
    </section>
  );
}
