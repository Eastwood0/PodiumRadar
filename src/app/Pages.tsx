import { useMemo } from "react";
import type { SiteData, SiteVenue } from "../lib/site-data";
import { EventList } from "./EventList";
import { FilterBar } from "./FilterBar";
import { applyFilters, type Filters, formatDate, formatDateTime, slug } from "./lib";

type Common = { data: SiteData; venues: Map<string, SiteVenue> };

/** Screen 2: the full list with filters (country, venue, size, month, everything). */
export function Agenda({ data, venues, months, filters, setFilters }: Common & { months: string[]; filters: Filters; setFilters: (f: Filters) => void }) {
  const events = useMemo(() => applyFilters(data.events, venues, filters), [data, venues, filters]);
  return (
    <>
      <PageHead kicker="Agenda" title="Alles wat eraan komt" />
      <FilterBar data={data} filters={filters} setFilters={setFilters} show={{ venue: true, month: true }} months={months} count={events.length} />
      <EventList key={JSON.stringify(filters)} events={events} venues={venues} data={data} empty={<p>Geen events met deze filters. Zet “Ook shows, sport en beurzen” aan of wis de filters.</p>} />
    </>
  );
}

/** Screen 3: every show of one artist in the venue agendas. Following and "Elders" arrive in phase 3. */
export function ArtistPage({ data, venues, artistSlug }: Common & { artistSlug: string }) {
  const events = useMemo(() => data.events.filter((e) => e.a.some((a) => slug(a) === artistSlug)), [data, artistSlug]);
  const name = events[0]?.a.find((a) => slug(a) === artistSlug) ?? artistSlug.replace(/-/g, " ");
  const countries = new Set(events.map((e) => venues.get(e.v)?.cc));
  return (
    <>
      <PageHead
        kicker="Artiest"
        title={name}
        sub={
          events.length
            ? `${events.length} ${events.length === 1 ? "show" : "shows"} in ${countries.size === 1 ? "één land" : `${countries.size} landen`} · eerstvolgende ${formatDate(events[0].s)}`
            : undefined
        }
      />
      <EventList
        events={events}
        venues={venues}
        data={data}
        empty={
          <>
            <p>
              <strong>{name}</strong> staat nu in geen enkele agenda van de zalen op Podiumradar.
            </p>
            <p>Later kun je artiesten volgen; dan zie je het zodra er een show bijkomt.</p>
          </>
        }
      />
    </>
  );
}

/** Screen 4: one venue's agenda plus where the data comes from. */
export function VenuePage({ data, venues, id, filters, setFilters }: Common & { id: string; filters: Filters; setFilters: (f: Filters) => void }) {
  const v = venues.get(id);
  const all = useMemo(() => data.events.filter((e) => e.v === id), [data, id]);
  if (!v) return <NotFound />;
  const events = filters.all ? all : all.filter((e) => e.c === "m");
  const source = data.sources.find((s) => s.venues.includes(id));
  return (
    <>
      <PageHead kicker={`${v.city} · ${v.cc === "NL" ? "Nederland" : v.cc === "BE" ? "België" : "Duitsland"}${v.tier === "B" ? " · middelgrote zaal" : ""}`} title={v.n} />
      <div className="venuebar">
        {v.web && (
          <a className="btn" href={v.web} target="_blank" rel="noopener noreferrer">
            Officiële site<span className="sr-only"> van {v.n}</span>
          </a>
        )}
        {all.length > 0 && (
          <label className="toggle">
            <input type="checkbox" checked={filters.all} onChange={(e) => setFilters({ ...filters, all: e.target.checked })} />
            <span>
              Ook shows, sport en beurzen ({all.length - all.filter((e) => e.c === "m").length})
            </span>
          </label>
        )}
      </div>
      {v.ns && (
        <div className="note">
          <strong>Nog geen agenda voor deze zaal.</strong> {v.ns}
        </div>
      )}
      {source && (
        <p className="srcline">
          Bron: {source.name}
          {source.lastSuccess ? `, bijgewerkt ${formatDateTime(source.lastSuccess)}` : ""}
          {!source.ok && " · laatste ophaalpoging mislukt, dit is de vorige stand"}
        </p>
      )}
      {!v.ns && (
        <EventList key={`${id}${filters.all}`} events={events} venues={venues} data={data} showVenue={false} empty={<p>Geen concerten gevonden. Zet “Ook shows, sport en beurzen” aan voor de rest.</p>} />
      )}
    </>
  );
}

/** Where the data comes from, per source: the "bronvermelding" from §9. */
export function Sources({ data, venues }: Common) {
  const noSource = data.venues.filter((v) => v.ns);
  return (
    <>
      <PageHead kicker="Bronnen" title="Waar de agenda vandaan komt" sub="Elke nacht leest Podiumradar de officiële agenda's van de zalen. Tickets koop je altijd bij de zaal of de verkoper die zij noemen." />
      <ul className="srclist" aria-label="Bronnen met status">
        {data.sources.map((s) => (
          <li key={s.name}>
            <span className="srclist__name">{s.name}</span>
            <span className="srclist__count">{s.count} events</span>
            <span className="srclist__venues">{s.venues.map((id) => venues.get(id)?.n ?? id).join(", ")}</span>
            <span className={s.ok ? "ok" : "bad"}>{s.ok ? "in orde" : "storing, vorige stand"}</span>
          </li>
        ))}
      </ul>
      {noSource.length > 0 && (
        <>
          <h2 className="h2">Nog zonder bron</h2>
          <ul className="nosrc">
            {noSource.map((v) => (
              <li key={v.id}>
                <strong>{v.n}</strong> ({v.city}): {v.ns}
              </li>
            ))}
          </ul>
        </>
      )}
    </>
  );
}

export function NotFound() {
  return (
    <>
      <PageHead kicker="Niet gevonden" title="Deze pagina bestaat niet" />
      <p>
        <a href="#overzicht">Terug naar het overzicht</a>
      </p>
    </>
  );
}

export function PageHead({ kicker, title, sub }: { kicker: string; title: string; sub?: string }) {
  return (
    <header className="pagehead">
      <p className="kicker">{kicker}</p>
      <h1 className="h1">{title}</h1>
      {sub && <p className="sub">{sub}</p>}
    </header>
  );
}
