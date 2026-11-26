import { load } from "cheerio";
import { fetchText } from "../lib/http";
import { localDate, localToIso, TZ_BY_COUNTRY } from "../lib/dates";
import { statusFrom } from "../lib/normalize";
import type { Adapter, SourceEvent } from "./types";

const BASE = "https://www.effenaar.nl";

interface Hit {
  title?: string;
  slug?: string;
  date?: number;
  state?: string | string[];
  genres?: { title?: string }[];
  thumbnail_image?: { image?: { src?: string } };
  objectID?: string;
}

/**
 * Effenaar's agenda page embeds its full event list (search-index results) in the Next.js page data.
 * Level 1: structured JSON, no HTML scraping.
 */
/** Follows a path of keys/indexes through unknown JSON; undefined as soon as a step is missing. */
function dig(value: unknown, ...path: (string | number)[]): unknown {
  let cur = value;
  for (const key of path) {
    if (cur === null || typeof cur !== "object") return undefined;
    cur = (cur as Record<string | number, unknown>)[key];
  }
  return cur;
}

export function parseEffenaar(html: string): SourceEvent[] {
  const raw = load(html)("#__NEXT_DATA__").text();
  if (!raw) throw new Error("Effenaar: page data ontbreekt");
  const data = JSON.parse(raw);
  const queries: { queryKey: unknown; state: { data: unknown } }[] = data?.props?.pageProps?.dehydrated?.queries ?? [];
  const q = queries.find((x) => JSON.stringify(x.queryKey).includes("events-collection"));
  const results = dig(q?.state?.data, "pageData", "algolia", "serverState", "initialResults", "production_events", "results", 0);
  const rawHits = dig(results, "hits");
  const hits: Hit[] = Array.isArray(rawHits) ? rawHits : [];
  if (!q || !results) throw new Error("Effenaar: eventlijst niet gevonden in page data");
  const out: SourceEvent[] = [];
  for (const h of hits) {
    if (!h.title || !h.slug || !h.date) continue;
    // The index stores only the day (always 12:00 UTC), so no start time is known.
    const [y, mo, d] = localDate(new Date(h.date * 1000).toISOString(), TZ_BY_COUNTRY.NL).split("-").map(Number);
    const when = localToIso(y, mo, d, undefined, TZ_BY_COUNTRY.NL);
    const state = Array.isArray(h.state) ? h.state.join(" ") : h.state;
    out.push({
      venueId: "effenaar",
      title: h.title.replace(/\s*\((nieuwe datum|extra show)\)\s*$/i, "").trim(),
      start: when.start,
      hasTime: when.hasTime,
      status: statusFrom(state) ?? statusFrom(h.title),
      sourceCategory: h.genres?.map((g) => g.title).join(", ") ? "muziek" : undefined,
      url: BASE + h.slug,
      sourceId: h.objectID ?? h.slug,
      imageUrl: h.thumbnail_image?.image?.src,
    });
  }
  return out;
}

export const effenaar: Adapter = {
  name: "effenaar.nl",
  venues: ["effenaar"],
  async fetch() {
    const { body } = await fetchText(`${BASE}/agenda`);
    return parseEffenaar(body);
  },
};
