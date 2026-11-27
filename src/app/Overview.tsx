import { Fragment, useEffect, useMemo, useRef, useState } from "react";
import type { SiteData, SiteEvent, SiteVenue } from "../lib/site-data";
import { Flag } from "./EventCard";
import { EventList } from "./EventList";
import { FilterBar } from "./FilterBar";
import { followedCells, useFollows } from "./follow";
import { applyFilters, type Filters, LEVELS, level, MONTHS_LONG, monthKey, monthShort, venueHref } from "./lib";
import { areaWords } from "./places";
import { sortVenues, venueScore } from "./VenuePicker";

const COUNTRIES = [
  { cc: "NL", label: "Nederland" },
  { cc: "BE", label: "België" },
  { cc: "DE", label: "Duitsland" },
] as const;

const monthName = (m: string) => `${MONTHS_LONG[+m.slice(5) - 1]} ${m.slice(0, 4)}`;

/** True on screens of 48rem (768 px) and wider: there the whole year fits as a table. */
function useWide(): boolean {
  const [wide, setWide] = useState(false);
  useEffect(() => {
    const mq = window.matchMedia("(min-width: 48rem)");
    const on = () => setWide(mq.matches);
    on();
    mq.addEventListener("change", on);
    return () => mq.removeEventListener("change", on);
  }, []);
  return wide;
}

/**
 * Per venue, per month. On a laptop the wall chart (venues down, months across, the colour gets stronger with the
 * number of shows, B27); on a phone one month at a time with a venue search, because 77 rows × 12 months does not
 * fit a phone (B53). Venues are A–Z per country; venues without a source are one line pointing to Bronnen.
 */
export function Overview({ data, venues, months, filters, setFilters }: { data: SiteData; venues: Map<string, SiteVenue>; months: string[]; filters: Filters; setFilters: (f: Filters) => void }) {
  const [picked, setPicked] = useState<{ v: string; m: string } | null>(null);
  const dialog = useRef<HTMLDialogElement>(null);
  const opener = useRef<HTMLElement | null>(null);
  const wide = useWide();
  useEffect(() => {
    const d = dialog.current;
    if (picked && d && !d.open) d.showModal();
  }, [picked]);
  const filtered = useMemo(() => applyFilters(data.events, venues, { ...filters, venue: "", month: "", when: "" }), [data, venues, filters]);

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
  const follows = useFollows();
  // Cells with a show of an artist you follow get a star (B27/B44).
  const starred = useMemo(() => followedCells(filtered, follows.artists, monthKey), [filtered, follows.artists]);

  const withSource = new Set(data.sources.flatMap((s) => s.venues));
  const inScope = data.venues.filter((v) => (!filters.country || v.cc === filters.country) && (!filters.tier || v.tier === filters.tier));
  const rows = sortVenues(inScope.filter((v) => withSource.has(v.id)).map((v) => ({ ...v, count: 0 }))).map((v) => venues.get(v.id)!);
  const noSource = inScope.filter((v) => !withSource.has(v.id)).length;

  const open = (v: string, m: string, el: HTMLElement) => {
    opener.current = el;
    setPicked({ v, m });
  };
  const pickedEvents = picked ? counts.get(`${picked.v}|${picked.m}`) ?? [] : [];
  const pickedVenue = picked ? venues.get(picked.v) : undefined;

  return (
    <section className="wall" aria-labelledby="wall-h">
      <h2 id="wall-h" className="h2">
        Per zaal, per maand
      </h2>
      <FilterBar data={data} venues={venues} filters={filters} setFilters={setFilters} show={{ venue: false, month: false, when: false }} count={filtered.length} />
      {wide ? (
        <YearTable rows={rows} months={months} counts={counts} starred={starred} picked={picked} open={open} />
      ) : (
        <MonthList rows={rows} months={months} counts={counts} starred={starred} open={open} complete={data.complete} />
      )}
      {noSource > 0 && (
        <p className="wall__nosrc">
          {noSource} {noSource === 1 ? "zaal heeft" : "zalen hebben"} nog geen bron. <a href="#bronnen">Welke en waarom</a>
        </p>
      )}
      <div className="legend" aria-hidden="true">
        <span>Shows per maand</span>
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
        onClose={() => {
          setPicked(null);
          opener.current?.focus(); // back to the cell that opened it
        }}
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
                  {monthName(picked.m)}, {pickedEvents.length} {pickedEvents.length === 1 ? "show" : "shows"}
                </p>
              </div>
              <button type="button" className="close" autoFocus onClick={() => dialog.current?.close()}>
                <span aria-hidden="true">×</span>
                <span className="sr-only">Sluiten</span>
              </button>
            </header>
            <EventList key={`${picked.v}${picked.m}`} events={pickedEvents} venues={venues} data={data} showVenue={false} empty="Geen shows." />
          </div>
        )}
      </dialog>
    </section>
  );
}

type Grid = {
  rows: SiteVenue[];
  months: string[];
  counts: Map<string, SiteEvent[]>;
  starred: Set<string>;
  open: (v: string, m: string, el: HTMLElement) => void;
};

/** Laptop: the whole year as a wall chart, grouped per country. */
function YearTable({ rows, months, counts, starred, picked, open }: Grid & { picked: { v: string; m: string } | null }) {
  return (
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
                <th scope="col" key={m} title={monthName(m)}>
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
                    {months.map((m) => {
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
                              aria-label={`${v.n}, ${monthName(m)}: ${n} ${n === 1 ? "show" : "shows"}${star ? ", met een artiest die je volgt" : ""}`}
                              onClick={(ev) => open(v.id, m, ev.currentTarget)}
                            >
                              {n}
                            </button>
                          )}
                        </td>
                      );
                    })}
                  </tr>
                ))}
            </Fragment>
          ))}
        </tbody>
      </table>
    </div>
  );
}

/** Phone: one month at a time, venues with shows that month, a search on venue or city. */
function MonthList({ rows, months, counts, starred, open, complete }: Grid & { complete: boolean }) {
  const [i, setI] = useState(0);
  const [q, setQ] = useState("");
  const m = months[i];
  const list = rows
    .map((v) => ({ v, n: counts.get(`${v.id}|${m}`)?.length ?? 0 }))
    .filter((x) => x.n > 0 && venueScore(q, { ...x.v, count: x.n, alt: areaWords(x.v.city) }) !== undefined);
  const max = Math.max(1, ...list.map((x) => x.n));
  if (!m) return null;
  return (
    <div className="mlist">
      <div className="mlist__bar">
        <button type="button" className="mlist__step" disabled={i === 0} onClick={() => setI(i - 1)}>
          <span aria-hidden="true">‹</span>
          <span className="sr-only">Vorige maand</span>
        </button>
        <label className="mlist__month">
          <span className="sr-only">Maand</span>
          <select value={m} onChange={(e) => setI(months.indexOf(e.target.value))}>
            {months.map((x) => (
              <option key={x} value={x}>
                {monthName(x)}
              </option>
            ))}
          </select>
        </label>
        <button type="button" className="mlist__step" disabled={i === months.length - 1} onClick={() => setI(i + 1)}>
          <span aria-hidden="true">›</span>
          <span className="sr-only">Volgende maand</span>
        </button>
      </div>
      <label className="mlist__search">
        <span className="sr-only">Zoek zaal, stad of regio</span>
        <input type="search" value={q} onChange={(e) => setQ(e.target.value)} placeholder="Zoek zaal, stad of regio" autoComplete="off" />
      </label>
      {list.length === 0 ? (
        <p className="empty">{complete ? `Geen shows in ${monthName(m)}${q ? ` voor “${q}”` : ""}.` : "De agenda wordt nog geladen…"}</p>
      ) : (
        <ul className="mlist__rows" aria-label={`Zalen in ${monthName(m)}`}>
          {list.map(({ v, n }, k) => (
            <Fragment key={v.id}>
              {(k === 0 || list[k - 1].v.cc !== v.cc) && (
                <li className="mlist__group" aria-hidden="true">
                  <Flag cc={v.cc} /> {COUNTRIES.find((c) => c.cc === v.cc)?.label}
                </li>
              )}
              <li>
                <button type="button" className="mlist__row" aria-haspopup="dialog" onClick={(ev) => open(v.id, m, ev.currentTarget)}>
                  <span className="mlist__name">
                    {v.n}
                    {starred.has(`${v.id}|${m}`) && (
                      <span className="mlist__star" aria-label="met een artiest die je volgt">
                        ★
                      </span>
                    )}
                  </span>
                  <span className="mlist__city">{v.city}</span>
                  <span className={`mlist__n cell--l${level(n)}`}>
                    {n}
                    <span className="sr-only"> {n === 1 ? "show" : "shows"}</span>
                  </span>
                  <span className="mlist__bar-fill" style={{ width: `${(n / max) * 100}%` }} aria-hidden="true" />
                </button>
              </li>
            </Fragment>
          ))}
        </ul>
      )}
    </div>
  );
}
