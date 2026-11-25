import { fetchText } from "../lib/http";
import { normalizeIso, TZ_BY_COUNTRY } from "../lib/dates";
import type { Adapter, SourceEvent } from "./types";

/**
 * Uitagenda Rotterdam (the city's cultural agenda, run by Rotterdam Festivals) publishes per location the same
 * JSON its own website loads. Used for Rotterdam Ahoy, whose own site blocks all automated visitors (B23).
 * Level 2 (shared platform, JSON).
 */
const BASE = "https://www.uitagendarotterdam.nl";
const PAGE_SIZE = 100;

/** Uitagenda location page id → our venue. RTM Stage is a hall inside the Ahoy complex. */
export const UITAGENDA_ROTTERDAM_LOCATIONS: { id: number; key: string; venueId: string }[] = [
  { id: 49648, key: "rotterdam-ahoy", venueId: "rotterdam-ahoy" },
  { id: 49189, key: "rtm-stage", venueId: "rotterdam-ahoy" },
];

interface Item {
  id: number;
  parentId?: number;
  title?: string;
  date?: string;
  timeBeautified?: string;
  soldout?: boolean;
  url?: string;
  image?: string;
  genres?: { title?: string }[];
  location?: { key?: string; title?: string };
}

export function parseUitagendaRotterdam(json: string, venueId: string, locationKey: string): { events: SourceEvent[]; totalPages: number } {
  const data = JSON.parse(json) as { pagedList?: { items?: Item[]; paginator?: { totalPages?: number } } };
  const items = data.pagedList?.items;
  if (!Array.isArray(items)) throw new Error("Uitagenda Rotterdam: onverwacht antwoord");
  const events: SourceEvent[] = [];
  for (const it of items) {
    if (!it.title || !it.date || !it.url) continue;
    if (it.location?.key && it.location.key !== locationKey) continue; // the API can mix in other places
    const when = normalizeIso(it.date, TZ_BY_COUNTRY.NL);
    if (!when) continue;
    const hasTime = /T\d{2}:\d{2}/.test(it.date) && !/T00:00/.test(it.date);
    events.push({
      venueId,
      title: it.title.trim(),
      start: when.start,
      hasTime,
      status: it.soldout ? "uitverkocht" : undefined,
      sourceCategory: it.genres?.map((g) => g.title).filter(Boolean).join(", ") || undefined,
      url: new URL(it.url, BASE).href,
      sourceId: String(it.id),
      imageUrl: it.image ? new URL(it.image, BASE).href : undefined,
    });
  }
  return { events, totalPages: data.pagedList?.paginator?.totalPages ?? 1 };
}

export const uitagendaRotterdam: Adapter = {
  name: "uitagendarotterdam.nl",
  venues: [...new Set(UITAGENDA_ROTTERDAM_LOCATIONS.map((l) => l.venueId))],
  async fetch() {
    const all: SourceEvent[] = [];
    for (const loc of UITAGENDA_ROTTERDAM_LOCATIONS) {
      for (let p = 1, total = 1; p <= total && p <= 20; p++) {
        const url = `${BASE}/umbraco/api/Entity/GetProductions?id=${loc.id}&pageSize=${PAGE_SIZE}&isMobile=false&culture=nl-NL&p=${p}`;
        const { body } = await fetchText(url, "application/json");
        const { events, totalPages } = parseUitagendaRotterdam(body, loc.venueId, loc.key);
        all.push(...events);
        total = totalPages;
      }
    }
    return all;
  },
};
