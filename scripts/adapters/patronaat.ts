import { load } from "cheerio";
import { fetchText } from "../lib/http";
import { localToIso, monthNumber, TZ_BY_COUNTRY } from "../lib/dates";
import { statusFrom } from "../lib/normalize";
import type { Adapter, SourceEvent } from "./types";

const AGENDA = "https://patronaat.nl/programma/";

/**
 * Patronaat (Haarlem): programme page with one card per event (date "do 26 nov 2026", title, genre tags,
 * "UITVERKOCHT" label). No start times in the list. Level 3 HTML.
 */
export function parsePatronaat(html: string): SourceEvent[] {
  const $ = load(html);
  const out: SourceEvent[] = [];
  $(".overview__list-item--event .event-program").each((_, el) => {
    const card = $(el);
    const link = card.find(".event-program__name a");
    const url = link.attr("href");
    const title = link.text().trim();
    const m = card.find(".event-program__date").text().trim().match(/(\d{1,2})\s+([a-z]{3,})\.?\s+(\d{4})/i);
    const month = m && monthNumber(m[2]);
    if (!url || !title || !m || !month) return;
    const when = localToIso(Number(m[3]), month, Number(m[1]), undefined, TZ_BY_COUNTRY.NL);
    out.push({
      venueId: "patronaat",
      title,
      start: when.start,
      hasTime: false,
      status: statusFrom(card.find(".event-program__status-tag").text()) ?? "gepland",
      sourceCategory: card.find(".event__tags-item--genre").map((_, t) => $(t).text().trim()).get().join(", ") || undefined,
      url,
      sourceId: url,
    });
  });
  if (!out.length) throw new Error("Patronaat: geen events gevonden");
  return out;
}

export const patronaat: Adapter = {
  name: "patronaat.nl",
  venues: ["patronaat"],
  async fetch() {
    return parsePatronaat((await fetchText(AGENDA)).body);
  },
};
