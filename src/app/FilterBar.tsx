import { useMemo } from "react";
import type { SiteData, SiteVenue } from "../lib/site-data";
import { DANCE_STYLES, MUSIC_GENRES } from "../lib/genres";
import { applyFilters, DEFAULT_FILTERS, type Filters, type Kind, MONTHS_LONG, parts, todayLocal, type When, WHEN_LABEL, whenRange } from "./lib";
import { areaWords, PLACE_PREFIX, placesFor } from "./places";
import { type VenueOption, VenuePicker } from "./VenuePicker";

const KINDS: { kind: Kind; label: string }[] = [
  { kind: "muziek", label: "Muziek" },
  { kind: "theater", label: "Theater & cabaret" },
  { kind: "alles", label: "Alles" },
];

/** Music, theatre & cabaret, or everything (also sport and fairs). Shared with the venue page. */
export function KindSwitch({ kind, onChange }: { kind: Kind; onChange: (k: Kind) => void }) {
  return (
    <div className="seg seg--kind" role="group" aria-label="Soort">
      {KINDS.map((k) => (
        <button key={k.kind} type="button" aria-pressed={kind === k.kind} onClick={() => onChange(k.kind)}>
          {k.label}
        </button>
      ))}
    </div>
  );
}

const shortDay = (iso: string) => {
  const p = parts(`${iso}T12:00:00Z`);
  return `${p.d} ${MONTHS_LONG[p.m - 1].slice(0, 3)}`;
};
/** "za 28 nov": one chosen day. */
export const dayLabel = (day: string) => `${["zo", "ma", "di", "wo", "do", "vr", "za"][new Date(`${day}T12:00:00Z`).getUTCDay()]} ${shortDay(day)}`;

/** "28 nov – 30 nov": the exact days behind "Dit weekend" or "7 dagen". */
function rangeLabel(when: Exclude<When, "">): string {
  const [from, to] = whenRange(when, todayLocal());
  return from === to ? shortDay(from) : `${shortDay(from)} – ${shortDay(to)}`;
}

type Show = { venue: boolean; month: boolean; when: boolean };

/** The fields a screen shows; "Wis filters" resets only those, so the other screen keeps its choices. */
const fieldsOf = (show: Show): (keyof Filters)[] => [
  "kind",
  "country",
  "tier",
  "genres",
  "dance",
  ...(show.venue ? (["venue"] as const) : []),
  ...(show.month ? (["month"] as const) : []),
  ...(show.when ? (["when", "day"] as const) : []),
];

/**
 * Filter controls shared by Overzicht and Agenda. First what people choose most (when, which venue, which kind),
 * the rest folded under "Meer filters" with a count of what is active there. Choices are remembered per browser.
 */
export function FilterBar({
  data,
  venues: venueMap,
  filters,
  setFilters,
  show,
  count,
  months = [],
}: {
  data: SiteData;
  venues: Map<string, SiteVenue>;
  filters: Filters;
  setFilters: (f: Filters) => void;
  show: Show;
  count: number;
  months?: string[];
}) {
  const set = (patch: Partial<Filters>) => setFilters({ ...filters, ...patch });
  const fields = fieldsOf(show);
  const changed = fields.some((k) => JSON.stringify(filters[k]) !== JSON.stringify(DEFAULT_FILTERS[k]));
  const reset = () => setFilters({ ...filters, ...Object.fromEntries(fields.map((k) => [k, DEFAULT_FILTERS[k]])) });
  const genresShown = filters.kind !== "theater";
  const extra = (filters.country ? 1 : 0) + (filters.tier ? 1 : 0) + (genresShown ? filters.genres.length + filters.dance.length : 0);

  // Venues with their number of shows under the other filters, so the picker never offers an empty venue.
  // Regions and whole cities (B54) come with the venues; each only when it has shows.
  const places = useMemo(() => placesFor(data.venues), [data.venues]);
  const venueOptions = useMemo<VenueOption[]>(() => {
    if (!show.venue) return [];
    const counts = new Map<string, number>();
    for (const e of applyFilters(data.events, venueMap, { ...filters, venue: "" })) counts.set(e.v, (counts.get(e.v) ?? 0) + 1);
    const single = data.venues.filter((v) => counts.has(v.id)).map((v) => ({ id: v.id, n: v.n, city: v.city, cc: v.cc, count: counts.get(v.id)!, alt: areaWords(v.city) }));
    const areas = places
      .map((p) => {
        const inside = single.filter((v) => p.cities.includes(v.city));
        return { id: p.id, n: p.name, city: "", cc: p.cc, kind: p.kind, venues: inside.length, alt: p.aliases.join(" "), count: inside.reduce((n, v) => n + v.count, 0) };
      })
      .filter((p) => p.count > 0);
    return [...areas, ...single];
  }, [show.venue, data, venueMap, filters, places]);
  const place = places.find((p) => p.id === filters.venue);
  const selected = place ? { id: place.id, n: place.name, city: "", kind: place.kind } : venueMap.get(filters.venue);

  /** Changing country or size keeps the chosen venue only if it still fits. */
  const keepVenue = (patch: Partial<Filters>) => {
    const v = venueMap.get(filters.venue);
    const next = { ...filters, ...patch };
    const fitsPlace = !next.country || next.country === place?.cc;
    const fitsVenue = !v || ((!next.country || v.cc === next.country) && (!next.tier || v.tier === next.tier));
    const fits = !show.venue || (filters.venue.startsWith(PLACE_PREFIX) ? fitsPlace : fitsVenue);
    setFilters(fits ? next : { ...next, venue: "" });
  };

  return (
    <div className="filters" role="group" aria-label="Filters">
      {(show.when || show.month) && (
        <div className="filters__row">
          {show.when && (
            <div className="seg" role="group" aria-label="Wanneer">
              {(["", "weekend", "week"] as When[]).map((w) => (
                <button key={w || "all"} type="button" aria-pressed={filters.when === w && !(w === "" && (filters.month || filters.day))} onClick={() => set({ when: w, month: "", day: "" })}>
                  {w === "week" ? "7 dagen" : w ? WHEN_LABEL[w] : "Alles"}
                </button>
              ))}
            </div>
          )}
          {show.month && (
            <label className="sel">
              <span className="sr-only">Maand</span>
              <select value={filters.month} onChange={(e) => set({ month: e.target.value, when: "", day: "" })}>
                <option value="">Maand</option>
                {months.map((m) => (
                  <option key={m} value={m}>
                    {MONTHS_LONG[+m.slice(5) - 1]} {m.slice(0, 4)}
                  </option>
                ))}
              </select>
            </label>
          )}
          {show.when && (
            <label className={`sel sel--day${filters.day ? " has-value" : ""}`}>
              <span className="sel__label" aria-hidden="true">
                Dag
              </span>
              <input
                type="date"
                aria-label="Dag"
                value={filters.day}
                min={todayLocal()}
                max={data.complete ? data.events.at(-1)?.s.slice(0, 10) : new Date(Date.now() + 366 * 86_400_000).toISOString().slice(0, 10)}
                onChange={(e) => set({ day: e.target.value, when: "", month: "" })}
              />
            </label>
          )}
        </div>
      )}
      {show.venue && (
        <div className="filters__row">
          <VenuePicker venues={venueOptions} selected={selected} onChange={(venue) => set({ venue })} />
        </div>
      )}
      <div className="filters__row">
        <KindSwitch kind={filters.kind} onChange={(kind) => set({ kind })} />
        <p className="filters__count" aria-live="polite">
          {count} {count === 1 ? "show" : "shows"}
          {show.when && filters.when && !filters.month && <> · {rangeLabel(filters.when)}</>}
          {show.when && filters.day && <> · {dayLabel(filters.day)}</>}
          {changed && (
            <>
              {" · "}
              <button type="button" className="link" onClick={reset}>
                Wis filters
              </button>
            </>
          )}
        </p>
      </div>
      <details className="fold" open={extra > 0 ? true : undefined}>
        <summary>
          Meer filters
          {extra > 0 && <span className="fold__n"> ({extra} aan)</span>}
        </summary>
        <div className="fold__body">
          <div className="seg" role="group" aria-label="Land">
            {(["", "NL", "BE", "DE"] as const).map((cc) => (
              <button key={cc || "all"} type="button" aria-pressed={filters.country === cc} onClick={() => keepVenue({ country: cc })}>
                {cc || "Alle landen"}
              </button>
            ))}
          </div>
          <div className="seg" role="group" aria-label="Zaalgrootte">
            {([
              ["", "Elke grootte"],
              ["A", "Groot"],
              ["B", "Middelgroot"],
            ] as const).map(([t, label]) => (
              <button key={t || "all"} type="button" aria-pressed={filters.tier === t} onClick={() => keepVenue({ tier: t })}>
                {label}
              </button>
            ))}
          </div>
          {genresShown && (
            <>
              <div className="chips" role="group" aria-label="Genre">
                <button type="button" aria-pressed={!filters.genres.length} onClick={() => set({ genres: [], dance: [] })}>
                  Alle genres
                </button>
                {MUSIC_GENRES.map((g) => {
                  const on = filters.genres.includes(g);
                  return (
                    <button
                      key={g}
                      type="button"
                      aria-pressed={on}
                      onClick={() => set({ genres: on ? filters.genres.filter((x) => x !== g) : [...filters.genres, g], ...(on && g === "Dance & DJ" ? { dance: [] } : {}) })}
                    >
                      {g}
                    </button>
                  );
                })}
              </div>
              {filters.genres.includes("Dance & DJ") && (
                <div className="chips chips--sub" role="group" aria-label="Dance-stijl">
                  <button type="button" aria-pressed={!filters.dance.length} onClick={() => set({ dance: [] })}>
                    Alle dance-stijlen
                  </button>
                  {DANCE_STYLES.map((d) => {
                    const on = filters.dance.includes(d);
                    return (
                      <button key={d} type="button" aria-pressed={on} onClick={() => set({ dance: on ? filters.dance.filter((x) => x !== d) : [...filters.dance, d] })}>
                        {d}
                      </button>
                    );
                  })}
                </div>
              )}
              {filters.genres.length > 0 && <p className="fold__note">Shows waarvan het genre onbekend is, vallen weg bij een genrekeuze.</p>}
            </>
          )}
        </div>
      </details>

    </div>
  );
}
