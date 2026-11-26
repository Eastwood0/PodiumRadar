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
