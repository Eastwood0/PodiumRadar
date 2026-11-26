import { load } from "cheerio";
import { fetchText } from "../lib/http";
import { normalizeIso, TZ_BY_COUNTRY } from "../lib/dates";
import { statusFrom } from "../lib/normalize";
import type { Adapter, SourceEvent } from "./types";

const AGENDA = "https://www.spotgroningen.nl/programma";

/** Spot runs two halls we follow; its other locations (Machinefabriek, churches, parks) are skipped. */
const VENUE_OF: Record<string, string> = { oosterpoort: "oosterpoort", stadsschouwburg: "stadsschouwburg-groningen" };

/**
 * Spot Groningen (De Oosterpoort + Stadsschouwburg): one programme page with every show as
 * <article data-location data-genres> and a <time datetime> with offset. Its JSON-LD is broken (template
 * placeholders), so this reads the HTML, which carries the same data in attributes. Level 3 HTML.
 */
export function parseSpot(html: string): SourceEvent[] {
  const $ = load(html);
  const out: SourceEvent[] = [];
  $("article.program__item").each((_, el) => {
    const item = $(el);
    const venueId = VENUE_OF[item.attr("data-location") ?? ""];
    if (!venueId) return;
    const url = item.find("a.program__link").attr("href");
    const h3 = item.find("h3").first();
    const subtitle = h3.find("span").text().trim();
    const title = h3.clone().children("span").remove().end().text().trim();
    const when = normalizeIso(item.find("time.program__date").attr("datetime") ?? "", TZ_BY_COUNTRY.NL);
    if (!url || !title || !when) return;
    out.push({
      venueId,
      title: subtitle && /^(in concert|live|tour)/i.test(subtitle) ? `${title} – ${subtitle}` : title,
      start: when.start,
      hasTime: when.hasTime,
      status: statusFrom(item.find(".program__status").text()) ?? "gepland",
      sourceCategory: [item.attr("data-genres"), item.attr("data-subgenres")].filter(Boolean).join(", ").replace(/-/g, " ") || undefined,
      url,
      sourceId: url,
    });
  });
  if (!out.length) throw new Error("Spot Groningen: geen programma gevonden");
  return out;
}

export const spotGroningen: Adapter = {
  name: "spotgroningen.nl",
  venues: Object.values(VENUE_OF),
  async fetch() {
    return parseSpot((await fetchText(AGENDA)).body);
  },
};
