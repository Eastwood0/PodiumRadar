import type { SiteData } from "../lib/site-data";
import { MUSIC_GENRES } from "../lib/genres";
import { DEFAULT_FILTERS, type Filters, MONTHS_LONG } from "./lib";

/** Filter controls shared by Overzicht and Agenda. Choices are remembered per browser by the parent. */
export function FilterBar({ data, filters, setFilters, show, count, months = [] }: { data: SiteData; filters: Filters; setFilters: (f: Filters) => void; show: { venue: boolean; month: boolean }; count: number; months?: string[] }) {
  const set = (patch: Partial<Filters>) => setFilters({ ...filters, ...patch });
  const venues = data.venues.filter((v) => (!filters.country || v.cc === filters.country) && data.events.some((e) => e.v === v.id));
  const changed = JSON.stringify({ ...filters }) !== JSON.stringify(DEFAULT_FILTERS);
  return (
    <div className="filters" role="group" aria-label="Filters">
      <div className="seg" role="group" aria-label="Land">
        {(["", "NL", "BE", "DE"] as const).map((cc) => (
          <button key={cc || "all"} type="button" aria-pressed={filters.country === cc} onClick={() => set({ country: cc, venue: "" })}>
            {cc || "Alle landen"}
          </button>
        ))}
      </div>
      <div className="seg" role="group" aria-label="Grootte">
        <button type="button" aria-pressed={filters.tier === ""} onClick={() => set({ tier: "" })}>
          Alle zalen
        </button>
        <button type="button" aria-pressed={filters.tier === "A"} onClick={() => set({ tier: "A" })}>
          Groot
        </button>
        <button type="button" aria-pressed={filters.tier === "B"} onClick={() => set({ tier: "B" })}>
          Middelgroot
        </button>
      </div>
      {show.venue && (
        <label className="sel">
          <span className="sr-only">Zaal</span>
          <select value={filters.venue} onChange={(e) => set({ venue: e.target.value })}>
            <option value="">Alle zalen</option>
            {venues.map((v) => (
              <option key={v.id} value={v.id}>
                {v.n} ({v.city})
              </option>
            ))}
          </select>
        </label>
      )}
      {show.month && (
        <label className="sel">
          <span className="sr-only">Maand</span>
          <select value={filters.month} onChange={(e) => set({ month: e.target.value })}>
            <option value="">Alle maanden</option>
            {months.map((m) => (
              <option key={m} value={m}>
                {MONTHS_LONG[+m.slice(5) - 1]} {m.slice(0, 4)}
              </option>
            ))}
          </select>
        </label>
      )}
      <div className="chips" role="group" aria-label="Genre">
        <button type="button" aria-pressed={!filters.genres.length} onClick={() => set({ genres: [] })}>
          Alle genres
        </button>
        {MUSIC_GENRES.map((g) => {
          const on = filters.genres.includes(g);
          return (
            <button key={g} type="button" aria-pressed={on} onClick={() => set({ genres: on ? filters.genres.filter((x) => x !== g) : [...filters.genres, g] })}>
              {g}
            </button>
          );
        })}
      </div>
      <label className="toggle">
        <input type="checkbox" checked={filters.all} onChange={(e) => set({ all: e.target.checked })} />
        <span>Ook shows, sport en beurzen</span>
      </label>
      <p className="filters__count" aria-live="polite">
        {count} {count === 1 ? "event" : "events"}
        {changed && (
          <>
            {" · "}
            <button type="button" className="link" onClick={() => setFilters(DEFAULT_FILTERS)}>
              filters wissen
            </button>
          </>
        )}
      </p>
    </div>
  );
}
