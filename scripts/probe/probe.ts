/**
 * Bron-inventarisatie (bouwplan §4.2, fase 1): bekijkt per venue welke manier van uitlezen mogelijk is.
 * Draait in GitHub Actions (de bouwomgeving mag de sites vaak niet bereiken). Schrijft reports/probe.json
 * en reports/bronnen-per-venue.md. Leest alleen pagina's die robots.txt toestaat, max 1 verzoek/s per site.
 */
import { mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { load } from "cheerio";
import { loadVenues } from "../../src/lib/venues";
import { getRobots, politeGet, type FetchResult } from "../lib/http";
import { extractJsonLdEvents, type RawJsonLdEvent } from "../lib/jsonld";

interface Candidates {
  venues: Record<string, string[]>;
  eventimSearch: Record<string, string>;
}

interface PageReport {
  url: string;
  status: number;
  finalUrl?: string;
  robotsBlocked?: boolean;
  error?: string;
  title?: string;
  bytes?: number;
  jsonLdBlocks?: number;
  jsonLdEvents?: number;
  jsonLdSample?: Pick<RawJsonLdEvent, "type" | "name" | "startDate" | "url">[];
  nextData?: boolean;
  nuxt?: boolean;
  dateKeyHits?: number;
  icsLinks?: string[];
  feedLinks?: string[];
  wordpress?: boolean;
  generator?: string;
  ticketLinks?: Record<string, number>;
  apiHints?: string[];
  agendaLinks?: string[];
  nextPage?: string;
  visibleDates?: number;
}

interface VenueReport {
  id: string;
  name: string;
  country: string;
  pages: PageReport[];
  robots: "ok" | "none" | "error";
  sitemap?: { url: string; eventUrls: number; sample: string[]; detailJsonLd?: number; detailUrl?: string; note?: string };
  wpNamespaces?: string[];
  eventim?: { market: string; status: number; locations?: { name: string; city: string; id: string }[]; productGroups?: number; error?: string };
  verdict: { level: "1" | "2" | "3" | "geen" | "?"; how: string };
}

const TICKET_DOMAINS = ["ticketmaster", "eventim", "livenation", "seetickets", "paylogic", "ticketswap", "ticketcorner", "adticket", "reservix", "eventbrite", "proxy"];
const AGENDA_WORDS = /\b(agenda|programma|programm|events?|evenementen|veranstaltungen|kalender|calendar|concerts?|konzerte|shows?|tickets)\b/i;
const EVENT_PATH = /(agenda|event|programma|programm|veranstaltung|concert|konzert|kalender|calendar|show)/i;
const DATE_TEXT = /\b(\d{1,2}[./-]\d{1,2}[./-]\d{2,4}|\d{1,2}\s+(jan|feb|mrt|maa|apr|mei|mai|jun|jul|aug|sep|okt|oct|nov|dec|dez)[a-z]*\.?\s+20\d\d)\b/gi;

function analysePage(r: FetchResult, base: string): PageReport {
  const rep: PageReport = { url: r.url, status: r.status, finalUrl: r.finalUrl !== r.url ? r.finalUrl : undefined, bytes: r.body.length };
  if (!r.ok || !/html/i.test(r.contentType)) return rep;
  const $ = load(r.body);
  rep.title = $("title").first().text().trim().slice(0, 120);
  const ld = extractJsonLdEvents(r.body);
  rep.jsonLdBlocks = ld.blocks;
  rep.jsonLdEvents = ld.events.length;
  rep.jsonLdSample = ld.events.slice(0, 3).map(({ type, name, startDate, url }) => ({ type, name, startDate, url }));
  const nd = $("#__NEXT_DATA__").text();
  rep.nextData = nd.length > 0;
  rep.nuxt = /window\.__NUXT__|__NUXT_DATA__/.test(r.body);
  rep.dateKeyHits = (r.body.match(/"(startDate|start_date|startsAt|eventDate|dateFrom|date)"\s*:/g) ?? []).length;
  const abs = (h: string) => {
    try {
      return new URL(h, base).href;
    } catch {
      return "";
    }
  };
  const hrefs = $("a[href]").map((_, a) => $(a).attr("href") ?? "").get();
  rep.icsLinks = [...new Set(hrefs.filter((h) => /\.ics(\?|$)|^webcal:/i.test(h)).map(abs))].slice(0, 3);
  rep.feedLinks = $('link[type="application/rss+xml"],link[type="application/atom+xml"]').map((_, l) => abs($(l).attr("href") ?? "")).get().slice(0, 3);
  rep.wordpress = $('link[rel="https://api.w.org/"]').length > 0 || /wp-content\//.test(r.body);
  rep.generator = $('meta[name="generator"]').attr("content")?.slice(0, 60);
  const tickets: Record<string, number> = {};
  for (const h of hrefs) {
    const d = TICKET_DOMAINS.find((t) => h.includes(t + "."));
    if (d) tickets[d] = (tickets[d] ?? 0) + 1;
  }
  rep.ticketLinks = tickets;
  const scripts = $("script").map((_, s) => $(s).attr("src") ?? $(s).text()).get().join("\n");
  rep.apiHints = [...new Set(scripts.match(/https?:\/\/[^\s"'`<>]*(\/api\/|graphql|wp-json|\/v\d\/)[^\s"'`<>]*/gi) ?? [])].slice(0, 5);
  const origin = new URL(base).origin;
  rep.agendaLinks = [
    ...new Set(
      $("a[href]")
        .filter((_, a) => AGENDA_WORDS.test($(a).text()) || EVENT_PATH.test($(a).attr("href") ?? ""))
        .map((_, a) => abs($(a).attr("href") ?? ""))
        .get()
        .filter((h) => h.startsWith(origin) && !h.includes("#")),
    ),
  ].slice(0, 8);
  const next = $('link[rel="next"], a[rel="next"]').attr("href") ?? hrefs.find((h) => /[?&](page|p|pagina|seite)=2\b/.test(h));
  rep.nextPage = next ? abs(next) : undefined;
  rep.visibleDates = ($("body").text().match(DATE_TEXT) ?? []).length;
  return rep;
}

async function probeSitemap(origin: string, robotsSitemaps: string[]): Promise<VenueReport["sitemap"]> {
  const first = robotsSitemaps[0] ?? `${origin}/sitemap.xml`;
  const r = await politeGet(first, "application/xml,text/xml");
  if (!r.ok) return { url: first, eventUrls: 0, sample: [], note: r.robotsBlocked ? "robots.txt" : `status ${r.status}` };
  let locs = [...r.body.matchAll(/<loc>\s*([^<\s]+)\s*<\/loc>/g)].map((m) => m[1]);
  let note: string | undefined;
  if (/<sitemapindex/i.test(r.body)) {
    const children = locs.filter((l) => EVENT_PATH.test(l)).slice(0, 2);
    note = `index met ${locs.length} sitemaps${children.length ? `, gelezen: ${children.length}` : ", geen event-sitemap herkend"}`;
    locs = [];
    for (const c of children) {
      const cr = await politeGet(c, "application/xml,text/xml");
      if (cr.ok) locs.push(...[...cr.body.matchAll(/<loc>\s*([^<\s]+)\s*<\/loc>/g)].map((m) => m[1]));
    }
  }
  const eventUrls = locs.filter((l) => EVENT_PATH.test(new URL(l, origin).pathname) && new URL(l, origin).pathname.split("/").filter(Boolean).length >= 2);
  const out: NonNullable<VenueReport["sitemap"]> = { url: first, eventUrls: eventUrls.length, sample: eventUrls.slice(0, 3), note };
  if (eventUrls.length) {
    const detailUrl = eventUrls[Math.floor(eventUrls.length / 2)];
    const d = await politeGet(detailUrl);
    out.detailUrl = detailUrl;
    out.detailJsonLd = d.ok ? extractJsonLdEvents(d.body).events.length : -1;
  }
  return out;
}

async function probeWp(origin: string): Promise<string[] | undefined> {
  const r = await politeGet(`${origin}/wp-json/`, "application/json");
  if (!r.ok) return undefined;
  try {
    return (JSON.parse(r.body).namespaces as string[]) ?? [];
  } catch {
    return undefined;
  }
}

const EVENTIM_MARKET: Record<string, string> = { NL: "web__eventim-nl", DE: "web__eventim-de" };
async function probeEventim(term: string, country: string): Promise<VenueReport["eventim"]> {
  const market = EVENTIM_MARKET[country];
  if (!market) return undefined;
  const base = "https://public-api.eventim.com/websearch/search/api/exploration";
  const qs = (extra: Record<string, string>) => new URLSearchParams({ webId: market, language: "en", ...extra }).toString();
  const loc = await politeGet(`${base}/v1/locations?${qs({ search_term: term, page: "1" })}`, "application/json");
  const out: NonNullable<VenueReport["eventim"]> = { market, status: loc.status };
  if (!loc.ok) {
    out.error = loc.robotsBlocked ? "robots.txt" : loc.error ?? `status ${loc.status}`;
    return out;
  }
  try {
    const j = JSON.parse(loc.body);
    out.locations = (j.locations ?? []).slice(0, 3).map((l: { name: string; city: string; location_id: string }) => ({ name: l.name, city: l.city, id: l.location_id }));
  } catch (e) {
    out.error = `json: ${e}`;
  }
  const pg = await politeGet(`${base}/v2/productGroups?${qs({ search_term: term, sort: "DateAsc", page: "1" })}`, "application/json");
  if (pg.ok) {
    try {
      out.productGroups = JSON.parse(pg.body).totalResults ?? undefined;
    } catch {
      /* ignore */
    }
  }
  return out;
}

function verdict(v: VenueReport): VenueReport["verdict"] {
  const best = v.pages.reduce((m, p) => Math.max(m, p.jsonLdEvents ?? 0), 0);
  if (best >= 3) return { level: "1", how: `JSON-LD op agendapagina (${best} events)` };
  if ((v.sitemap?.detailJsonLd ?? 0) > 0) return { level: "1", how: `sitemap (${v.sitemap!.eventUrls} event-URL's) + JSON-LD op detailpagina` };
  if (v.pages.some((p) => (p.icsLinks?.length ?? 0) > 0)) return { level: "1", how: "iCal-feed" };
  if (v.wpNamespaces?.some((n) => /tribe|events|event/i.test(n))) return { level: "1", how: `WordPress-API (${v.wpNamespaces.filter((n) => /event/i.test(n)).join(", ")})` };
  if (v.pages.some((p) => p.nextData && (p.dateKeyHits ?? 0) > 3)) return { level: "1", how: "Next.js-data in pagina (JSON)" };
  if (v.pages.some((p) => (p.visibleDates ?? 0) >= 5)) return { level: "3", how: "HTML-agenda met zichtbare datums" };
  if (v.pages.every((p) => p.status === 0 || p.status >= 400 || p.robotsBlocked)) return { level: "geen", how: "site niet bereikbaar of geweigerd" };
  return { level: "?", how: "agenda gevonden maar geen data herkend (mogelijk JavaScript)" };
}

async function probeVenue(id: string, name: string, country: string, urls: string[], eventimTerm?: string): Promise<VenueReport> {
  const rep: VenueReport = { id, name, country, pages: [], robots: "none", verdict: { level: "?", how: "" } };
  if (!urls.length) {
    rep.verdict = { level: "geen", how: "geen eigen agenda-site bekend" };
    return rep;
  }
  const origin = new URL(urls[0]).origin;
  const robots = await getRobots(origin).catch(() => null);
  rep.robots = robots ? "ok" : "none";
  const seen = new Set<string>();
  const queue = [...urls];
  while (queue.length && rep.pages.length < 5) {
    const url = queue.shift()!;
    if (seen.has(url)) continue;
    seen.add(url);
    const r = await politeGet(url);
    const page = r.robotsBlocked ? { url, status: 0, robotsBlocked: true } : analysePage(r, r.finalUrl || url);
    if (r.error) page.error = r.error.slice(0, 120);
    rep.pages.push(page);
    // Follow agenda links from a page without events, at most 2 extra.
    if ((page.jsonLdEvents ?? 0) < 3 && page.agendaLinks) {
      for (const l of page.agendaLinks.slice(0, 2)) if (!seen.has(l)) queue.push(l);
    }
  }
  rep.sitemap = await probeSitemap(origin, robots?.sitemaps ?? []).catch((e) => ({ url: "", eventUrls: 0, sample: [], note: String(e).slice(0, 80) }));
  if (rep.pages.some((p) => p.wordpress)) rep.wpNamespaces = await probeWp(origin);
  if (eventimTerm) rep.eventim = await probeEventim(eventimTerm, country).catch((e) => ({ market: "?", status: 0, error: String(e).slice(0, 80) }));
  rep.verdict = verdict(rep);
  return rep;
}

function toMarkdown(reports: VenueReport[], at: string): string {
  const rows = reports.map((v) => {
    const best = v.pages.find((p) => (p.jsonLdEvents ?? 0) > 0) ?? v.pages.find((p) => p.status === 200) ?? v.pages[0];
    const statuses = v.pages.map((p) => (p.robotsBlocked ? "robots" : p.status || "fout")).join(", ") || "—";
    const sm = v.sitemap ? `${v.sitemap.eventUrls}${v.sitemap.detailJsonLd !== undefined ? ` (detail JSON-LD: ${v.sitemap.detailJsonLd})` : ""}` : "—";
    const ev = v.eventim ? (v.eventim.error ? `fout: ${v.eventim.error}` : `${v.eventim.locations?.map((l) => `${l.name} (${l.city})`).join("; ") || "geen locatie"} · ${v.eventim.productGroups ?? "?"} resultaten`) : "—";
    return `| ${v.name} | ${v.country} | **${v.verdict.level}** ${v.verdict.how} | ${statuses} | ${best?.finalUrl ?? best?.url ?? "—"} | ${sm} | ${ev} |`;
  });
  return [
    `# Bronnen per venue`,
    ``,
    `Automatisch gegenereerd door \`scripts/probe/probe.ts\` op ${at} (GitHub Actions). Niveaus volgens bouwplan §4.2: **1** = gestructureerde data, **3** = HTML-scraper nodig, **geen** = niet bereikbaar, **?** = handmatig bekijken.`,
    ``,
    `| Venue | Land | Oordeel | HTTP | Agenda-URL | Event-URL's in sitemap | Eventim (onofficieel) |`,
    `|---|---|---|---|---|---|---|`,
    ...rows,
    ``,
    `Details per pagina: \`reports/probe.json\`.`,
    ``,
  ].join("\n");
}

async function main() {
  const cand: Candidates = JSON.parse(readFileSync("scripts/probe/candidates.json", "utf8"));
  const venues = loadVenues();
  const only = process.env.PROBE_ONLY?.split(",").filter(Boolean);
  const list = venues.filter((v) => !only || only.includes(v.id));
  const reports = await Promise.all(list.map((v) => probeVenue(v.id, v.name, v.country, cand.venues[v.id] ?? [], cand.eventimSearch[v.id])));
  const at = new Date().toISOString();
  mkdirSync("reports", { recursive: true });
  writeFileSync("reports/probe.json", JSON.stringify({ at, reports }, null, 2));
  writeFileSync("reports/bronnen-per-venue.md", toMarkdown(reports, at));
  console.log(toMarkdown(reports, at));
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
