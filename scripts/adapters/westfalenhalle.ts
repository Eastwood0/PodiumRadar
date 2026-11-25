import { load } from "cheerio";
import { fetchText } from "../lib/http";
import { localToIso, TZ_BY_COUNTRY } from "../lib/dates";
import type { Adapter, SourceEvent } from "./types";

const BASE = "https://www.westfalenhalle.de";
const URL_FINDER = `${BASE}/events-tickets/eventfinder/`;

/** Category ids from the finder's filter (checked 25 Nov 2026). Music wins when an event has both kinds. */
const MUSIC_IDS = new Set(["2", "9", "11", "13", "15", "17", "19", "21", "25", "27", "29", "33", "37", "45"]);
const OTHER_IDS: Record<string, string> = { "1": "Comedy", "5": "Sport", "7": "Showveranstaltung", "23": "Musicals", "31": "Speaker Event", "39": "Ballett", "41": "Familie und Kinder", "43": "Theaterproduktion" };

export function westfalenhalleCategory(ids: string | undefined): string | undefined {
  const list = (ids ?? "").split(",").map((x) => x.trim()).filter(Boolean);
  if (list.some((id) => MUSIC_IDS.has(id))) return "Musik";
  const other = list.find((id) => OTHER_IDS[id]);
  return other ? OTHER_IDS[other] : undefined;
}

/** Parses the Westfalenhalle event finder (all events on one page). Level 3 (HTML). */
export function parseWestfalenhalle(html: string): SourceEvent[] {
  const $ = load(html);
  const out: SourceEvent[] = [];
  $(".wfhevents_suchelement").each((_, el) => {
    const e = $(el);
    const title = e.find(".wfhevents_suchelement_titel").first().text().trim();
    const href = e.find('a[href*="/event-detail/"]').first().attr("href");
    // "27.11.2026", or a range "24.11. - 26.11.2026": the first day counts, the year comes from the end.
    const d = e.find(".wfhevents_suchelement_datum").first().text().replace(/\s+/g, " ").trim();
    const m = d.match(/^(\d{1,2})\.(\d{1,2})\.(\d{4})?/);
    const year = m?.[3] ?? d.match(/(\d{4})\s*$/)?.[1];
    if (!title || !href || !m || !year) return;
    const { start, hasTime } = localToIso(+year, +m[2], +m[1], undefined, TZ_BY_COUNTRY.DE);
    const ticket = e.find('a[href*="ticket."]').attr("href");
    out.push({
      venueId: "westfalenhalle",
      title,
      start,
      hasTime,
      sourceCategory: westfalenhalleCategory(e.attr("data-kategorien-slick")),
      url: new URL(href, BASE).href,
      ticketUrl: ticket?.startsWith("http") ? ticket : undefined,
      sourceId: e.attr("data-event-uid") ?? href,
    });
  });
  return out;
}

export const westfalenhalle: Adapter = {
  name: "westfalenhalle.de",
  venues: ["westfalenhalle"],
  async fetch() {
    const { body } = await fetchText(URL_FINDER);
    return parseWestfalenhalle(body);
  },
};
