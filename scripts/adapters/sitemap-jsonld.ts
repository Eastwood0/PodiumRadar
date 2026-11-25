import { fetchText } from "../lib/http";
import { normalizeIso, TZ_BY_COUNTRY } from "../lib/dates";
import { extractJsonLdEvents, type RawJsonLdEvent } from "../lib/jsonld";
import { statusFrom } from "../lib/normalize";
import type { Adapter, SourceEvent } from "./types";

/**
 * Generic level-1 adapter: the site lists event pages in its sitemap and each event page carries
 * schema.org Event data (JSON-LD). Reads the sitemap, then every event page (max 1 request/s).
 */
interface SitemapSite {
  venueId: string;
  country: "NL" | "BE" | "DE";
  sitemap: string;
  /** Child sitemaps to read when `sitemap` is an index. */
  childPattern: RegExp;
  /** Event page URLs. */
  pagePattern: RegExp;
  maxPages?: number;
}

const locs = (xml: string) => [...xml.matchAll(/<loc>\s*([^<\s]+)\s*<\/loc>/g)].map((m) => m[1].replace(/&amp;/g, "&"));

export async function sitemapUrls(site: SitemapSite): Promise<string[]> {
  const { body } = await fetchText(site.sitemap, "application/xml,text/xml");
  let urls = locs(body);
  if (/<sitemapindex/i.test(body)) {
    const children = urls.filter((u) => site.childPattern.test(u));
    if (!children.length) throw new Error(`${site.sitemap}: geen event-sitemap gevonden`);
    urls = [];
    for (const c of children) urls.push(...locs((await fetchText(c, "application/xml,text/xml")).body));
  }
  return [...new Set(urls.filter((u) => site.pagePattern.test(u)))];
}

/** Maps a JSON-LD event to a SourceEvent; undefined when it lacks a usable date or name. */
export function fromJsonLd(e: RawJsonLdEvent, pageUrl: string, venueId: string, country: string): SourceEvent | undefined {
  if (!e.name || !e.startDate) return undefined;
  const when = normalizeIso(e.startDate, TZ_BY_COUNTRY[country]);
  if (!when) return undefined;
  const hasTime = /T\d{2}:\d{2}/.test(e.startDate) && !/T00:00(:00)?/.test(e.startDate) ? when.hasTime : false;
  return {
    venueId,
    title: e.name.trim(),
    artists: e.performers.length ? e.performers : undefined,
    start: when.start,
    hasTime,
    status: statusFrom(e.eventStatus?.replace(/^https?:\/\/schema\.org\//, "")) ,
    url: e.url?.startsWith("http") ? e.url : pageUrl,
    ticketUrl: e.offersUrl?.startsWith("http") ? e.offersUrl : undefined,
    sourceId: pageUrl,
    imageUrl: e.image,
    sourceCategory: e.type === "MusicEvent" ? "music" : e.type === "SportsEvent" ? "sport" : e.type === "ComedyEvent" ? "comedy" : undefined,
  };
}

export function sitemapJsonLdAdapter(name: string, site: SitemapSite): Adapter {
  return {
    name,
    venues: [site.venueId],
    async fetch() {
      const urls = (await sitemapUrls(site)).slice(0, site.maxPages ?? 250);
      const out: SourceEvent[] = [];
      let failed = 0;
      for (const u of urls) {
        try {
          const { body } = await fetchText(u);
          for (const e of extractJsonLdEvents(body).events) {
            const ev = fromJsonLd(e, u, site.venueId, site.country);
            if (ev) out.push(ev);
          }
        } catch {
          failed++;
        }
      }
      if (urls.length && failed > urls.length / 2) throw new Error(`${name}: ${failed} van ${urls.length} pagina's mislukt`);
      return out;
    },
  };
}

export const veltinsArena = sitemapJsonLdAdapter("veltins-arena.de", {
  venueId: "veltins-arena",
  country: "DE",
  sitemap: "https://veltins-arena.de/sitemap_index.xml",
  childPattern: /event/i,
  pagePattern: /\/events\/[^/]+\/?$/,
});

export const rheinEnergieStadion = sitemapJsonLdAdapter("rheinenergiestadion.de", {
  venueId: "rheinenergiestadion",
  country: "DE",
  sitemap: "https://www.rheinenergiestadion.de/sitemap.xml",
  childPattern: /event/i,
  pagePattern: /\/events\/[^/]+\/?$/,
});
