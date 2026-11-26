import { load, type CheerioAPI } from "cheerio";
import { fetchText } from "../lib/http";
import { extractJsonLdEvents } from "../lib/jsonld";
import { fromJsonLd, sitemapUrls } from "./sitemap-jsonld";
import type { Adapter, SourceEvent } from "./types";

/**
 * Theatres on one shared ASP.NET site platform with Ticketmatic ticketing (Munttheater Weert, Stadsschouwburg
 * Utrecht, Schouwburg Concertzaal Tilburg). The agenda shows the first 10–30 shows and loads the rest from /mvc/,
 * which their robots.txt disallows. So: the sitemap lists every show page, and each show page carries schema.org
 * TheaterEvent JSON-LD (one per performance). Level 1, one request per show page (max 1/s).
 */
export interface TicketmaticSite {
  name: string;
  venueId: string;
  sitemap: string;
  /** Show pages in the sitemap. */
  pagePattern: RegExp;
  /** The theatre's own genre label on a show page, if the site has one. */
  genre?: ($: CheerioAPI) => string | undefined;
  maxPages?: number;
}

const text = ($: CheerioAPI, selector: string) => $(selector).first().text().trim() || undefined;

/** Company/performer from the page header (`data-info='{"titel":…,"gezelschap":…}'`). */
function company($: CheerioAPI): string | undefined {
  try {
    const info = JSON.parse($("[data-info]").first().attr("data-info") ?? "{}") as { gezelschap?: unknown };
    return typeof info.gezelschap === "string" && info.gezelschap.trim() ? info.gezelschap.trim() : undefined;
  } catch {
    return undefined; // no or malformed header data: the JSON-LD performer is used instead
  }
}

export function parseTicketmaticPage(html: string, pageUrl: string, site: Pick<TicketmaticSite, "venueId" | "genre">): SourceEvent[] {
  const $ = load(html);
  const genre = site.genre?.($);
  const performer = company($);
  const out: SourceEvent[] = [];
  for (const e of extractJsonLdEvents(html).events) {
    const ev = fromJsonLd(e, pageUrl, site.venueId, "NL");
    if (!ev) continue;
    const artist = performer ?? ev.artists?.[0];
    out.push({
      ...ev,
      title: artist && !ev.title.toLowerCase().includes(artist.toLowerCase()) ? `${artist}: ${ev.title}` : ev.title,
      artists: [artist ?? ev.title],
      sourceCategory: genre ?? ev.sourceCategory,
      sourceId: `${pageUrl}|${ev.start}`,
    });
  }
  return out;
}

export function ticketmaticAdapter(site: TicketmaticSite): Adapter {
  return {
    name: site.name,
    venues: [site.venueId],
    async fetch() {
      const urls = await sitemapUrls({ venueId: site.venueId, country: "NL", sitemap: site.sitemap, childPattern: /./, pagePattern: site.pagePattern });
      const out: SourceEvent[] = [];
      let failed = 0;
      for (const u of urls.slice(0, site.maxPages ?? 400)) {
        try {
          out.push(...parseTicketmaticPage((await fetchText(u)).body, u, site));
        } catch (e) {
          failed++;
          console.warn(`${site.name}: ${u} overgeslagen (${String(e)})`);
        }
      }
      if (failed > urls.length / 2) throw new Error(`${site.name}: ${failed} van ${urls.length} pagina's mislukt`);
      if (!out.length) throw new Error(`${site.name}: geen voorstellingen gevonden`);
      return out;
    },
  };
}

export const munttheater = ticketmaticAdapter({
  name: "munttheater.nl",
  venueId: "munttheater",
  sitemap: "https://www.munttheater.nl/sitemap.xml",
  pagePattern: /^https:\/\/www\.munttheater\.nl\/agenda\/(?!koop-ticket)[^/?#]+$/,
  // First pill is the genre; later pills are series ("Lachen is gezond", "Matineevoorstelling").
  genre: ($) => text($, ".event-tags-wrapper .tag-pill"),
});

export const stadsschouwburgUtrecht = ticketmaticAdapter({
  name: "stadsschouwburg-utrecht.nl",
  venueId: "stadsschouwburg-utrecht",
  sitemap: "https://stadsschouwburg-utrecht.nl/sitemap.xml",
  pagePattern: /^https:\/\/stadsschouwburg-utrecht\.nl\/agenda\/seizoen-[^/]+\/(?!inleiding-)[^/?#]+$/, // "inleiding" pages are listed but answer 404
  genre: ($) => text($, ".event-info-wrapper p.item.lowercase"),
});

export const theatersTilburg = ticketmaticAdapter({
  name: "schouwburgconcertzaaltilburg.nl",
  venueId: "theaters-tilburg",
  sitemap: "https://www.schouwburgconcertzaaltilburg.nl/sitemap.xml",
  pagePattern: /^https:\/\/www\.schouwburgconcertzaaltilburg\.nl\/nl\/agenda\/(?!koop-ticket)[^/?#]+$/,
  maxPages: 700,
});
