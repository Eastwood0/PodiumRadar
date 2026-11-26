import { useCallback, useEffect, useMemo, useState } from "react";
import type { SiteData, SiteVenue } from "../lib/site-data";
import { artistIndex, DEFAULT_FILTERS, type Filters, formatDate, formatDateTime, hoursOld, load, monthsFrom, parseRoute, type Route, save } from "./lib";
import { LineUp } from "./LineUp";
import { Overview } from "./Overview";
import { Agenda, ArtistPage, NotFound, Sources, VenuePage } from "./Pages";
import { createSearch } from "./search";
import { SearchBox } from "./SearchBox";

const FILTER_KEY = "pr.filters";
const currentRoute = () => (typeof location === "undefined" ? ({ view: "overzicht" } as Route) : parseRoute(location.hash));

export default function App() {
  const [data, setData] = useState<SiteData | null>(null);
  const [error, setError] = useState(false);
  const [route, setRoute] = useState<Route>({ view: "overzicht" });
  const [filters, setFiltersState] = useState<Filters>(DEFAULT_FILTERS);

  useEffect(() => {
    setRoute(currentRoute());
    // Stored filters from an older version may miss newer fields: fill them with the defaults.
    setFiltersState({ ...DEFAULT_FILTERS, ...load<Partial<Filters>>(FILTER_KEY, {}) });
    const onHash = () => {
      setRoute(currentRoute());
      window.scrollTo(0, 0);
    };
    window.addEventListener("hashchange", onHash);
    // Sticky month headings sit right under the header, whose height depends on the screen width.
    const head = document.querySelector<HTMLElement>(".top");
    const ro = head ? new ResizeObserver(() => document.documentElement.style.setProperty("--head-h", `${head.offsetHeight}px`)) : null;
    if (head) ro?.observe(head);
    fetch("data/agenda.json")
      .then((r) => (r.ok ? r.json() : Promise.reject(new Error(String(r.status)))))
      .then((d: SiteData) => setData(d))
      .catch(() => setError(true));
    return () => {
      window.removeEventListener("hashchange", onHash);
      ro?.disconnect();
    };
  }, []);

  const setFilters = useCallback((f: Filters) => {
    setFiltersState(f);
    save(FILTER_KEY, f);
  }, []);

  const venues = useMemo(() => new Map<string, SiteVenue>((data?.venues ?? []).map((v) => [v.id, v])), [data]);
  const months = useMemo(() => (data ? monthsFrom(data.generatedAt) : []), [data]);
  const search = useMemo(() => {
    if (!data) return null;
    // Built on first use, so opening the page does not wait for the search index.
    let run: ReturnType<typeof createSearch> | undefined;
    return (q: string) => (run ??= createSearch(artistIndex(data.events), data.venues, (a) => `${a.count} ${a.count === 1 ? "show" : "shows"} · vanaf ${formatDate(a.next)}`))(q);
  }, [data]);

  const stale = data && hoursOld(data.generatedAt) > 36;
  const tab = route.view === "agenda" ? "agenda" : route.view === "overzicht" ? "overzicht" : "";

  return (
    <>
      <a className="skip" href="#inhoud">
        Naar de inhoud
      </a>
      <header className="top">
        <div className="top__in">
          <a className="brand" href="#overzicht" aria-label="Podiumradar, naar het overzicht">
            <svg viewBox="0 0 32 32" aria-hidden="true" className="brand__mark">
              <circle cx="16" cy="16" r="14" />
              <circle cx="16" cy="16" r="8.5" />
              <g className="brand__sweep">
                <path d="M16 16 L27 9" />
              </g>
              <circle cx="22.5" cy="9.5" r="2.6" className="brand__blip" />
            </svg>
            <span>Podiumradar</span>
          </a>
          <nav aria-label="Hoofdmenu" className="tabs">
            <a href="#overzicht" aria-current={tab === "overzicht" ? "page" : undefined}>
              Overzicht
            </a>
            <a href="#agenda" aria-current={tab === "agenda" ? "page" : undefined}>
              Agenda
            </a>
          </nav>
          <SearchBox search={search} />
        </div>
      </header>
      {stale && (
        <p className="stale" role="status">
          Gegevens niet actueel, laatst bijgewerkt {formatDateTime(data.generatedAt)}.
        </p>
      )}
      <main id="inhoud" className="main" tabIndex={-1}>
        {error ? (
          <div className="note">
            <strong>De agenda kon niet geladen worden.</strong> Controleer je verbinding en probeer het opnieuw.
          </div>
        ) : route.view === "overzicht" ? (
          data ? (
            <>
              <LineUp data={data} venues={venues} />
              <Overview data={data} venues={venues} months={months} filters={filters} setFilters={setFilters} />
            </>
          ) : (
            <Loading />
          )
        ) : !data ? (
          <Loading />
        ) : route.view === "agenda" ? (
          <Agenda data={data} venues={venues} months={months} filters={filters} setFilters={setFilters} />
        ) : route.view === "artiest" ? (
          <ArtistPage data={data} venues={venues} artistSlug={route.slug} />
        ) : route.view === "zaal" ? (
          <VenuePage data={data} venues={venues} id={route.id} filters={filters} setFilters={setFilters} />
        ) : route.view === "bronnen" ? (
          <Sources data={data} venues={venues} />
        ) : (
          <NotFound />
        )}
      </main>
      <footer className="foot">
        <p>
          {data ? <>Laatst bijgewerkt {formatDateTime(data.generatedAt)}. </> : null}
          De agenda komt elke nacht uit de officiële agenda's van de zalen, Uitagenda Rotterdam en UITagenda Utrecht. <a href="#bronnen">Bekijk alle bronnen</a>.
        </p>
        <p>Een privé-site voor een kleine vriendenkring. Datum en tijd kunnen wijzigen: kijk bij het kopen van tickets altijd bij de verkoper.</p>
      </footer>
    </>
  );
}

function Loading() {
  return (
    <div className="loading" role="status">
      <span className="sr-only">Agenda laden…</span>
      {Array.from({ length: 6 }, (_, i) => (
        <div key={i} className="loading__row" aria-hidden="true" />
      ))}
    </div>
  );
}
