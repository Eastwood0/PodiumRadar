import { fetchText } from "../lib/http";
import { extractJsonLdEvents } from "../lib/jsonld";
import { fromJsonLd } from "./sitemap-jsonld";
import type { Adapter, SourceEvent } from "./types";

/**
 * Generic level-1 adapter: one agenda page that carries all events as schema.org JSON-LD
 * (checked per venue in the probe/snapshot first; some sites ship broken template JSON-LD).
 */
interface JsonLdPage {
  venueId: string;
  country: "NL" | "BE" | "DE";
  url: string;
  /** Keep only events whose location name matches (for sites that list several halls). */
  location?: RegExp;
}

export function parseJsonLdPage(html: string, page: JsonLdPage): SourceEvent[] {
  const { events } = extractJsonLdEvents(html);
  if (!events.length) throw new Error(`${page.url}: geen JSON-LD-events gevonden`);
  const out: SourceEvent[] = [];
  for (const e of events) {
    if (page.location && e.locationName && !page.location.test(e.locationName)) continue;
    // The page lists many events; the event's own URL is the stable id (not the agenda page).
    const ev = fromJsonLd(e, page.url, page.venueId, page.country);
    if (ev) out.push({ ...ev, sourceId: e.url ?? e.offersUrl ?? `${ev.title}|${ev.start}` });
  }
  return out;
}

/**
 * Same, over numbered pages (`pageUrl(1)`, `pageUrl(2)`, …) until a page has no events or `maxPages` is reached.
 */
export function jsonLdPagesAdapter(name: string, page: Omit<JsonLdPage, "url">, pageUrl: (n: number) => string, maxPages = 12): Adapter {
  return {
    name,
    venues: [page.venueId],
    async fetch() {
      const out: SourceEvent[] = [];
      for (let n = 1; n <= maxPages; n++) {
        const url = pageUrl(n);
        const res = await fetchText(url).catch((e: unknown) => {
          if (n > 1) return null; // past the last page some sites answer 404
          throw e;
        });
        if (!res) break;
        const { events } = extractJsonLdEvents(res.body);
        if (!events.length) {
          if (n === 1) throw new Error(`${url}: geen JSON-LD-events gevonden`);
          break;
        }
        out.push(...parseJsonLdPage(res.body, { ...page, url }));
      }
      return out;
    },
  };
}

export function jsonLdPageAdapter(name: string, page: JsonLdPage): Adapter {
  return {
    name,
    venues: [page.venueId],
    async fetch() {
      return parseJsonLdPage((await fetchText(page.url)).body, page);
    },
  };
}

export const muziekgieterij = jsonLdPageAdapter("muziekgieterij.nl", { venueId: "muziekgieterij", country: "NL", url: "https://muziekgieterij.nl/" });

/** Paard (Den Haag): every event in the English agenda list carries JSON-LD; halls (Grote Zaal, GR8, Café) are all Paard. */
export const paard = jsonLdPageAdapter("paard.nl", { venueId: "paard", country: "NL", url: "https://www.paard.nl/en/event/" });

/**
 * Palladium (Köln): its own site shows no readable dates, so we use the venue page of koeln.de, the city
 * portal (same route as the city agendas for Ahoy and Tivoli, B23/B34). 16 events per page, /seite/N/.
 */
export const palladiumKoeln = jsonLdPagesAdapter(
  "koeln.de (Palladium)",
  { venueId: "palladium-koeln", country: "DE", location: /palladium/i },
  (n) => `https://www.koeln.de/veranstaltungsort/palladium-koeln/${n > 1 ? `seite/${n}/` : ""}`,
);
