import { useMemo } from "react";
import type { SiteData, SiteVenue } from "../lib/site-data";
import { BackLink } from "./BackLink";
import { sourceNote } from "./sources";
import { EventList } from "./EventList";
import { FollowButton } from "./FollowButton";
import { Flag, TicketLink } from "./EventCard";
import { FilterBar, KindSwitch } from "./FilterBar";
import { applyFilters, DEFAULT_FILTERS, type Filters, kindOf, formatDateTime, isNew, monthShort, parts, showHref, slug, venueHref } from "./lib";

const STATUS = { u: "Uitverkocht", v: "Verplaatst", g: "Geannuleerd" } as const;

type Common = { data: SiteData; venues: Map<string, SiteVenue> };

/** Screen 2: the full list with filters (country, venue, size, month, everything). */
export function Agenda({ data, venues, months, filters, setFilters }: Common & { months: string[]; filters: Filters; setFilters: (f: Filters) => void }) {
  const events = useMemo(() => applyFilters(data.events, venues, filters), [data, venues, filters]);
  return (
    <>
      <PageHead title="Agenda" />
      <FilterBar data={data} venues={venues} filters={filters} setFilters={setFilters} show={{ venue: true, month: true, when: true }} months={months} count={events.length} />
      {venues.get(filters.venue) && sourceNote(data, venues.get(filters.venue)!) && <p className="show__note">{sourceNote(data, venues.get(filters.venue)!)}</p>}
      <EventList
        key={JSON.stringify(filters)}
        memo={`agenda ${JSON.stringify(filters)}`}
        events={events}
        venues={venues}
        data={data}
        empty={<Widen data={data} venues={venues} filters={filters} setFilters={setFilters} />}
      />
    </>
  );
}

/** One filter less, with what it would give: so "nothing on Saturday in Limburg" leads somewhere in one tap. */
const WIDEN: { label: string; active: (f: Filters) => boolean; patch: Partial<Filters> }[] = [
  { label: "Alle dagen", active: (f) => !!(f.day || f.when || f.month), patch: { day: "", when: "", month: "" } },
  { label: "Alle zalen en regio’s", active: (f) => !!f.venue, patch: { venue: "" } },
  { label: "Alle genres", active: (f) => f.genres.length > 0, patch: { genres: [], dance: [] } },
  { label: "Alle landen", active: (f) => !!f.country, patch: { country: "" } },
  { label: "Elke zaalgrootte", active: (f) => !!f.tier, patch: { tier: "" } },
  { label: "Ook theater en overig", active: (f) => f.kind !== "alles", patch: { kind: "alles" } },
];

function Widen({ data, venues, filters, setFilters }: Common & { filters: Filters; setFilters: (f: Filters) => void }) {
  const options = WIDEN.filter((w) => w.active(filters))
    .map((w) => ({ ...w, n: applyFilters(data.events, venues, { ...filters, ...w.patch }).length }))
    .filter((w) => w.n > 0);
  return (
    <>
      <p>{data.complete ? "Geen shows met deze filters." : "Nog niets gevonden; de rest van de agenda wordt nog geladen…"}</p>
      <div className="widen">
        {options.map((w) => (
          <button key={w.label} type="button" className="btn btn--quiet" onClick={() => setFilters({ ...filters, ...w.patch })}>
            {w.label}{" "}
            <span className="widen__n">
              ({w.n}
              {data.complete ? "" : "+"})
            </span>
          </button>
        ))}
        <button type="button" className="btn" onClick={() => setFilters(DEFAULT_FILTERS)}>
          Wis alle filters
        </button>
      </div>
    </>
  );
}

const COUNTRY_NAME = { NL: "Nederland", BE: "België", DE: "Duitsland", GB: "het Verenigd Koninkrijk", FR: "Frankrijk" } as const;
const joinNl = (xs: string[]) => (xs.length < 2 ? xs.join("") : `${xs.slice(0, -1).join(", ")} en ${xs.at(-1)}`);

/** Screen 3: every show of one artist, printed like the tour dates on the back of a tour shirt. */
export function ArtistPage({ data, venues, artistSlug }: Common & { artistSlug: string }) {
  const events = useMemo(() => data.events.filter((e) => e.a.some((a) => slug(a) === artistSlug)), [data, artistSlug]);
  const name = events[0]?.a.find((a) => slug(a) === artistSlug) ?? artistSlug.replace(/-/g, " ");
  if (!events.length)
    return (
      <section className="tour">
        <BackLink />
        <h1 className="tour__name">{name}</h1>
        <FollowButton name={name} big />
        <div className="empty">
          {!data.complete ? (
            <p>De rest van de agenda wordt nog geladen…</p>
          ) : (
            <p>{name} staat nu in geen enkele agenda van de zalen op Podiumradar.</p>
          )}
          <p>Volg deze artiest, dan zie je het in Mijn radar zodra er een show bijkomt (na de volgende nachtelijke update).</p>
        </div>
      </section>
    );
  const countries = [...new Set(events.map((e) => venues.get(e.v)!.cc))].map((cc) => COUNTRY_NAME[cc]);
  const years = [...new Set(events.map((e) => parts(e.s).y))];
  return (
    <section className="tour" aria-labelledby="tour-h">
      <BackLink />
      <h1 id="tour-h" className="tour__name">
        {name}
      </h1>
      <p className="tour__sub">
        Live in {joinNl(countries)}, {years.length > 1 ? `${years[0]}–${years.at(-1)}` : years[0]}
      </p>
      <FollowButton name={name} big />
      <ol className="tour__dates">
        {events.map((e) => {
          const v = venues.get(e.v)!;
          const p = parts(e.s);
          const support = e.a.length > 1 || e.a[0] !== name ? e.t : "";
          return (
            <li key={e.id} className={e.st === "g" ? "is-cancelled" : undefined}>
              <a href={showHref(e)} className="tour__date">
                <time dateTime={e.s}>
                  {p.d} {monthShort(p.m)} {p.y}
                </time>
              </a>
              <span className="tour__city">{v.city}</span>
              <span className="tour__venue">
                <a href={venueHref(v.id)}>{v.n}</a>
                {support && <span className="tour__bill"> ({support})</span>}
                {e.st && <span className={`tag tag--${e.st}`}>{STATUS[e.st]}</span>}
                {isNew(e, data) && <span className="tag tag--new">Nieuw</span>}
              </span>
              <span className="tour__tix">
                <TicketLink e={e} />
              </span>
            </li>
          );
        })}
      </ol>
    </section>
  );
}

/** Screen 4: one venue's agenda plus where the data comes from. */
export function VenuePage({ data, venues, id, filters, setFilters }: Common & { id: string; filters: Filters; setFilters: (f: Filters) => void }) {
  const v = venues.get(id);
  const all = useMemo(() => data.events.filter((e) => e.v === id), [data, id]);
  if (!v) return <NotFound />;
  const events = filters.kind === "alles" ? all : all.filter((e) => kindOf(e) === filters.kind);
  const source = data.sources.find((s) => s.venues.includes(id));
  return (
    <>
      <BackLink />
      <PageHead title={v.n}>
        <p className="sub">
          <Flag cc={v.cc} /> {v.city}, {COUNTRY_NAME[v.cc]}
          {v.tier === "B" ? ". Middelgrote zaal" : ""}
        </p>
      </PageHead>
      {all.length > 0 && (
        <div className="venuebar">
          <KindSwitch kind={filters.kind} onChange={(kind) => setFilters({ ...filters, kind })} />
        </div>
      )}
      {v.ns && (
        <div className="note">
          <strong>Nog geen agenda voor deze zaal.</strong> {v.ns}
          {v.web && (
            <>
              {" "}
              <a href={v.web} target="_blank" rel="noopener noreferrer">
                Naar de site van {v.n}
              </a>
            </>
          )}
        </div>
      )}
      {source && (
        <p className="srcline">
          Bron: {source.name}
          {source.lastSuccess ? `, bijgewerkt ${formatDateTime(source.lastSuccess)}` : ""}
          {!source.ok && " · laatste ophaalpoging mislukt, dit is de vorige stand"}
          {source.partial && " (stadsagenda: niet altijd volledig)"}
          {v.web && (
            <>
              {" · "}
              <a href={v.web} target="_blank" rel="noopener noreferrer">
                officiële agenda
              </a>
            </>
          )}
        </p>
      )}
      {!v.ns && (
        <EventList key={`${id}${filters.kind}`} memo={`zaal ${id} ${filters.kind}`} events={events} venues={venues} data={data} showVenue={false} empty={<p>Niets van deze soort in deze zaal. Kies hierboven een andere soort of “Alles”.</p>} />
      )}
    </>
  );
}

/** Where the data comes from, per source: the "bronvermelding" from §9. */
export function Sources({ data, venues }: Common) {
  const noSource = data.venues.filter((v) => v.ns);
  return (
    <>
      <BackLink />
      <PageHead title="Bronnen" />
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
      <PageHead title="Deze pagina bestaat niet" />
      <p>
        <a href="#overzicht">Terug naar het overzicht</a>
      </p>
    </>
  );
}

export function PageHead({ title, sub, children }: { title: string; sub?: string; children?: React.ReactNode }) {
  return (
    <header className="pagehead">
      <h1 className="h1">{title}</h1>
      {sub && <p className="sub">{sub}</p>}
      {children}
    </header>
  );
}
