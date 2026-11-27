import { startTransition, useCallback, useEffect, useMemo, useRef, useState } from "react";
import { type CompactSiteData, expandSiteData, type SiteData, type SiteVenue } from "../lib/site-data";
import { artistIndex, type Bill, DEFAULT_FILTERS, indexShows, migrateFilters, type Filters, formatDate, formatDateTime, hoursOld, load, monthsFrom, parseRoute, type Route, save } from "./lib";
import { BillView, LineUp } from "./LineUp";
import { Overview } from "./Overview";
import { Agenda, ArtistPage, NotFound, PageHead, Sources, VenuePage } from "./Pages";
import { getFollowState } from "./follow";
import { navigated, rememberLink, replaceHash, startNav } from "./nav";
import { ProposalBar } from "./Proposal";
import { Radar } from "./Radar";
import { ShowPage } from "./ShowPage";
import { flush } from "./sync";
import { createSearch } from "./search";
import { SearchBox } from "./SearchBox";

const FILTER_KEY = "pr.filters";
/**
 * Runs a second after the first screen, once the browser has nothing urgent to do, so the rest of the year does not
 * compete with the first shows for bandwidth on a slow connection. Safari has no requestIdleCallback.
 */
const afterIdle = (task: () => void) =>
  setTimeout(() => (typeof requestIdleCallback === "function" ? requestIdleCallback(task, { timeout: 2000 }) : task()), 1000);
const currentRoute = () => (typeof location === "undefined" ? ({ view: "overzicht" } as Route) : parseRoute(location.hash));

/** `bill`: the opening line-up, computed at build time so it is in the HTML before any data loads. */
export default function App({ bill }: { bill?: Bill }) {
  const [data, setData] = useState<SiteData | null>(null);
  const [error, setError] = useState(false);
  const [partial, setPartial] = useState(false);
  const [route, setRoute] = useState<Route>({ view: "overzicht" });
  const [filters, setFiltersState] = useState<Filters>(DEFAULT_FILTERS);
  const restoreY = useRef<{ y: number; focus?: string; index: number } | undefined>(undefined);

  useEffect(() => {
    setRoute(currentRoute());
    // Stored filters from an older version may miss newer fields: fill them with the defaults.
    setFiltersState({ ...migrateFilters(load<Partial<Filters>>(FILTER_KEY, {})), when: "", day: "" });
    startNav();
    const onHash = () => {
      const nav = navigated(window.scrollY);
      restoreY.current = nav.restore === undefined ? undefined : { y: nav.restore, focus: nav.link?.href ?? nav.from, index: nav.link?.index ?? 0 };
      setRoute(currentRoute());
      if (nav.restore !== undefined) return; // focus and scroll follow once the page is back (effect below)
      window.scrollTo(0, 0);
      // Screen readers and keyboard users start at the new page, not at the link they left.
      document.getElementById("inhoud")?.focus({ preventScroll: true });
    };
    window.addEventListener("hashchange", onHash);
    // Which link was followed (a venue can be linked from many rows), so Terug puts the focus back on that one.
    const onClick = (ev: MouseEvent) => {
      const a = (ev.target as Element | null)?.closest?.<HTMLAnchorElement>('#inhoud a[href^="#"]');
      const href = a?.getAttribute("href");
      if (!a || !href) return;
      rememberLink(href, [...document.querySelectorAll(`#inhoud a[href="${CSS.escape(href)}"]`)].indexOf(a));
    };
    document.addEventListener("click", onClick, true);
    // Sticky month headings sit right under the header, whose height depends on the screen width.
    const head = document.querySelector<HTMLElement>(".top");
    const ro = head ? new ResizeObserver(() => document.documentElement.style.setProperty("--head-h", `${head.offsetHeight}px`)) : null;
    if (head) ro?.observe(head);
    // A follow change from an earlier visit that never reached the server is sent now (it stays saved here until then).
    if (getFollowState().pending) flush().catch(() => undefined);
    fetch("data/agenda.json")
      .then((r) => (r.ok ? r.json() : Promise.reject(new Error(String(r.status)))))
      // A transition lets React render the big first screen in small slices, so the phone stays responsive.
      .then((d: CompactSiteData) => {
        startTransition(() => setData(expandSiteData(d)));
        // The rest of the year comes in a second file, after the first screen (B48). If it fails, the first part stays.
        const more = d.more;
        if (more)
          afterIdle(() =>
            fetch(more)
              .then((r) => (r.ok ? r.json() : Promise.reject(new Error(String(r.status)))))
              .then((rest: { events: CompactSiteData["events"] }) => startTransition(() => setData(expandSiteData(d, rest.events))))
              .catch(() => setPartial(true)),
          );
      })
      .catch(() => setError(true));
    return () => {
      window.removeEventListener("hashchange", onHash);
      document.removeEventListener("click", onClick, true);
      ro?.disconnect();
    };
  }, []);

  const setFilters = useCallback((f: Filters) => {
    setFiltersState(f);
    save(FILTER_KEY, f);
  }, []);

  // "#regio-<id>" (from the search box) opens the agenda filtered on that region or city.
  useEffect(() => {
    if (route.view !== "agenda" || !route.place) return;
    const place = route.place;
    setFiltersState((f) => {
      const next = { ...f, venue: place, country: "" as const };
      save(FILTER_KEY, next);
      return next;
    });
    replaceHash("#agenda");
    setRoute({ view: "agenda" });
  }, [route]);

  // "Terug": once the page you return to has rendered, scroll to where you were.
  useEffect(() => {
    const r = restoreY.current;
    if (r === undefined || !data) return;
    restoreY.current = undefined;
    requestAnimationFrame(() =>
      requestAnimationFrame(() => {
        window.scrollTo(0, r.y);
        // Keyboard and screen reader: continue at the link you followed, not at the top of the list.
        const links = r.focus ? document.querySelectorAll<HTMLElement>(`#inhoud a[href="${CSS.escape(r.focus)}"]`) : [];
        const link = links[r.index] ?? links[0];
        (link ?? document.getElementById("inhoud"))?.focus({ preventScroll: true });
      }),
    );
  }, [route, data]);

  // The period lives in the address ("#agenda/weekend", "#agenda/week"), so a shared or bookmarked link keeps it
  // and "Naar de agenda" always means the whole agenda (B54). It is not stored with the other filters.
  const agendaFilters = useMemo<Filters>(
    () => ({ ...filters, when: route.view === "agenda" ? (route.when ?? "") : "", day: route.view === "agenda" ? (route.day ?? "") : "" }),
    [filters, route],
  );
  const setAgendaFilters = useCallback(
    (f: Filters) => {
      setFilters({ ...f, when: "", day: "" });
      const hash = f.day ? `#agenda/dag-${f.day}` : f.when ? `#agenda/${f.when}` : "#agenda";
      if (location.hash !== hash) {
        replaceHash(hash); // a filter change is not a new page: no extra Back step, no jump to the top
        setRoute(parseRoute(hash));
      }
    },
    [setFilters],
  );

  const venues = useMemo(() => {
    if (data) indexShows(data.events); // show links need to know which titles play twice a day
    return new Map<string, SiteVenue>((data?.venues ?? []).map((v) => [v.id, v]));
  }, [data]);
  const months = useMemo(() => (data ? monthsFrom(data.generatedAt) : []), [data]);
  const search = useMemo(() => {
    if (!data) return null;
    // Built on first use, so opening the page does not wait for the search index.
    let run: ReturnType<typeof createSearch> | undefined;
    return (q: string) => (run ??= createSearch(artistIndex(data.events), data.venues, (a) => `${a.count} ${a.count === 1 ? "show" : "shows"} · vanaf ${formatDate(a.next)}`))(q);
  }, [data]);

  const stale = data && hoursOld(data.generatedAt) > 36;
  const tab = route.view === "agenda" || route.view === "overzicht" || route.view === "radar" ? route.view : "";

  return (
    <>
      <a
        className="skip"
        href="#inhoud"
        onClick={(ev) => {
          ev.preventDefault(); // "#inhoud" is not a page: jump to the content without changing the route
          document.getElementById("inhoud")?.focus();
        }}
      >
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
            <span className="brand__name">Podiumradar</span>
          </a>
          <nav aria-label="Hoofdmenu" className="tabs">
            <a href="#overzicht" aria-current={tab === "overzicht" ? "page" : undefined}>
              Overzicht
            </a>
            <a href="#agenda" aria-current={tab === "agenda" ? "page" : undefined}>
              Agenda
            </a>
            <a href="#radar" aria-current={tab === "radar" ? "page" : undefined}>
              <span className="tab-long">Mijn radar</span>
              <span className="tab-short">Radar</span>
            </a>
          </nav>
          <SearchBox search={search} failed={error} />
        </div>
      </header>
      {partial && (
        <p className="stale" role="status">
          Alleen de komende maand is geladen. Herlaad de pagina voor de rest van het jaar.
        </p>
      )}
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
            <>
              {bill && (
                <div className="bill-ssr">
                  <BillView b={bill} />
                </div>
              )}
              <Loading />
            </>
          )
        ) : !data ? (
          <Loading title={route.view === "agenda" ? "Agenda" : route.view === "radar" ? "Mijn radar" : undefined} />
        ) : route.view === "agenda" ? (
          <Agenda data={data} venues={venues} months={months} filters={agendaFilters} setFilters={setAgendaFilters} />
        ) : route.view === "show" ? (
          <ShowPage data={data} venues={venues} showKey={route.key} />
        ) : route.view === "artiest" ? (
          <ArtistPage data={data} venues={venues} artistSlug={route.slug} />
        ) : route.view === "zaal" ? (
          <VenuePage data={data} venues={venues} id={route.id} filters={filters} setFilters={setFilters} />
        ) : route.view === "radar" ? (
          <Radar data={data} venues={venues} joinCode={route.join} />
        ) : route.view === "bronnen" ? (
          <Sources data={data} venues={venues} />
        ) : (
          <NotFound />
        )}
      </main>
      {data && <ProposalBar data={data} venues={venues} />}
      <footer className="foot">
        <p>
          {data ? <>Laatst bijgewerkt {formatDateTime(data.generatedAt)} · </> : null}
          <a href="#bronnen">Bronnen</a>
        </p>
      </footer>
    </>
  );
}

/** While the agenda downloads, the page title is already there instead of an empty screen. */
function Loading({ title }: { title?: string }) {
  return (
    <>
      {title && <PageHead title={title} />}
      <div className="loading" role="status">
        <span className="sr-only">Agenda laden…</span>
        {Array.from({ length: 6 }, (_, i) => (
          <div key={i} className="loading__row" aria-hidden="true" />
        ))}
      </div>
    </>
  );
}
