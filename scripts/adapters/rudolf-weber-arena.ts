import { load } from "cheerio";
import { fetchText } from "../lib/http";
import { findTime, localToIso, TZ_BY_COUNTRY } from "../lib/dates";
import { statusFrom } from "../lib/normalize";
import type { Adapter, SourceEvent } from "./types";

const URL_EVENTS = "https://www.rudolf-weber-arena.de/events/";

/** Parses the Rudolf Weber-Arena event list (all dates on one page). Level 3 (HTML). */
export function parseRudolfWeberArena(html: string): SourceEvent[] {
  const $ = load(html);
  const out: SourceEvent[] = [];
  const seen = new Set<string>();
  $(".event-items.list-version .event-item[data-href]").each((_, el) => {
    const e = $(el);
    const url = e.attr("data-href") ?? "";
    const title = e.find(".event-content h3").first().text().trim();
    const when = e.find(".event-content h5").first().text().replace(/\s+/g, " ").trim(); // "29.11.2026 18:00 Uhr"
    const m = when.match(/(\d{1,2})\.(\d{1,2})\.(\d{4})/);
    if (!url.startsWith("http") || !title || !m || seen.has(url)) return;
    seen.add(url);
    const { start, hasTime } = localToIso(+m[3], +m[2], +m[1], findTime(when.slice(m.index! + m[0].length)), TZ_BY_COUNTRY.DE);
    out.push({
      venueId: "arena-oberhausen",
      title,
      start,
      hasTime,
      status: statusFrom(e.find(".event-content p").first().text()),
      url,
      sourceId: url.match(/eventdate=(\d+)/)?.[1] ?? url,
    });
  });
  return out;
}

export const rudolfWeberArena: Adapter = {
  name: "rudolf-weber-arena.de",
  venues: ["arena-oberhausen"],
  async fetch() {
    const { body } = await fetchText(URL_EVENTS);
    return parseRudolfWeberArena(body);
  },
};
