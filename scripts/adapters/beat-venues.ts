import { load } from "cheerio";
import { fetchText } from "../lib/http";
import { normalizeIso, TZ_BY_COUNTRY } from "../lib/dates";
import { decodeCompactJson } from "../lib/compact-json";
import { statusFrom } from "../lib/normalize";
import type { Adapter, SourceEvent } from "./types";

/**
 * be•at venues (Sportpaleis group): AFAS Dome, Lotto Arena, Vorst Nationaal and Trixxo Arena share one platform.
 * Each site lists its event pages in its sitemap; each event page carries its tickets (date, time, ticket link,
 * venue) in the page data. Level 2 (shared platform, structured page data).
 */
interface BeatSite {
  host: string;
  /** venueId used inside the page data, e.g. "afas-dome". */
  beatVenueId: string;
  venueId: string;
}

export const BEAT_SITES: BeatSite[] = [
  { host: "https://www.afas-dome.be", beatVenueId: "afas-dome", venueId: "sportpaleis" },
  { host: "https://www.lotto-arena.be", beatVenueId: "lotto-arena", venueId: "lotto-arena" },
  { host: "https://www.vorst-nationaal.be", beatVenueId: "forest-national", venueId: "vorst-nationaal" },
  { host: "https://www.trixxo-arena.be", beatVenueId: "trixxo-arena", venueId: "arena-hasselt" },
];

interface Ticket {
  venueId?: string;
  dateOriginal?: string;
  times?: { id?: string | number; time?: string; cta?: { url?: string; label?: string; isDisabled?: boolean } }[];
}
interface EventContent {
  name?: string;
  title?: string;
  eventTimeStatus?: string;
  tickets?: Ticket[];
  genres?: { name?: string; id?: string }[];
  image?: { url?: string };
}

/** Parses one be•at event page into one SourceEvent per show at this site's venue. */
export function parseBeatEvent(html: string, pageUrl: string, site: BeatSite): SourceEvent[] {
  const raw = load(html)("#__NEXT_DATA__").text();
  if (!raw) throw new Error(`${pageUrl}: page data ontbreekt`);
  const pageData = JSON.parse(raw)?.props?.pageProps?.pageData;
  const root = decodeCompactJson(pageData) as { content?: EventContent };
  const c = root.content;
  if (!c?.tickets) return []; // not an event page (or no shows announced yet)
  const title = (c.name ?? c.title ?? "").trim();
  if (!title) return [];
  const status = statusFrom(c.eventTimeStatus?.replace(/-/g, " "));
  const genres = c.genres?.map((g) => g.name).filter(Boolean).join(", ") || undefined;
  const out: SourceEvent[] = [];
  for (const t of c.tickets) {
    if (t.venueId !== site.beatVenueId || !t.dateOriginal) continue;
    const times = t.times?.length ? t.times : [{}];
    for (const time of times) {
      const when = normalizeIso(t.dateOriginal, TZ_BY_COUNTRY.BE);
      if (!when) continue;
      // dateOriginal is the first show of the day; a second "time" on the same day gets its own entry.
      const start = time.time && /^\d{1,2}:\d{2}$/.test(time.time) ? when.start.replace(/T\d{2}:\d{2}/, `T${time.time.padStart(5, "0")}`) : when.start;
      out.push({
        venueId: site.venueId,
        title,
        start,
        hasTime: true,
        status: c.eventTimeStatus === "ended" ? undefined : status,
        sourceCategory: genres,
        url: pageUrl,
        ticketUrl: time.cta?.url?.startsWith("http") ? time.cta.url : undefined,
        sourceId: `${pageUrl.split("-").pop()}-${time.id ?? t.dateOriginal}`,
        imageUrl: c.image?.url?.startsWith("http") ? c.image.url : undefined,
      });
    }
  }
  return out;
}

/** Dutch event pages from a be•at sitemap (other languages are duplicates). */
export function beatEventUrls(xml: string, host: string): string[] {
  const urls = [...xml.matchAll(/<loc>\s*([^<\s]+)\s*<\/loc>/g)].map((m) => m[1]);
  return [...new Set(urls.filter((u) => u.startsWith(`${host}/evenement/`) || u.startsWith(`${host}/nl/evenement/`)).map((u) => u.replace("/nl/evenement/", "/evenement/")))];
}

export function beatAdapter(site: BeatSite): Adapter {
  return {
    name: new URL(site.host).hostname.replace(/^www\./, ""),
    venues: [site.venueId],
    async fetch() {
      const { body } = await fetchText(`${site.host}/sitemap.xml`, "application/xml,text/xml");
      const urls = beatEventUrls(body, site.host);
      if (!urls.length) throw new Error(`${site.host}: geen evenementen in sitemap`);
      const out: SourceEvent[] = [];
      let failed = 0;
      for (const u of urls) {
        try {
          out.push(...parseBeatEvent((await fetchText(u)).body, u, site));
        } catch {
          failed++;
        }
      }
      if (failed > urls.length / 2) throw new Error(`${site.host}: ${failed} van ${urls.length} pagina's mislukt`);
      return out;
    },
  };
}

export const beatVenues = BEAT_SITES.map(beatAdapter);
