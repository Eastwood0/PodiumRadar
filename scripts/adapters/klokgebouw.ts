import { load } from "cheerio";
import { fetchText } from "../lib/http";
import { localToIso, monthNumber, TZ_BY_COUNTRY } from "../lib/dates";
import { statusFrom } from "../lib/normalize";
import { inferYear } from "./uitagenda-utrecht";
import type { Adapter, SourceEvent } from "./types";

const AGENDA = "https://www.klokgebouw.nl/agenda";

/**
 * Klokgebouw (Eindhoven): agenda cards with day and month ("do. 31 dec."), a kind ("Dance", "Beurs", "Sport")
 * and the title. No year and no time; the year is the first one in which that day is still to come
 * (a slug ending in "-2027" confirms it). Level 3 HTML.
 */
export function parseKlokgebouw(html: string, today: Date): SourceEvent[] {
  const $ = load(html);
  const out: SourceEvent[] = [];
  $("article.agenda-item, artilce.agenda-item").each((_, el) => {
    const item = $(el);
    const link = item.find("a[href]").first();
    const url = link.attr("href");
    const title = (link.attr("data-api-title") || item.find("h3").first().text()).trim();
    const m = item.find(".date").first().text().trim().match(/(\d{1,2})\s+([a-z]{3,})/i);
    const month = m && monthNumber(m[2]);
    if (!url || !title || !m || !month) return;
    const day = Number(m[1]);
    const slugYear = url.match(/-(20\d{2})(?:-\d+)?$/)?.[1];
    const year = slugYear && Number(slugYear) >= today.getFullYear() ? Number(slugYear) : inferYear(day, month, today);
    const when = localToIso(year, month, day, undefined, TZ_BY_COUNTRY.NL);
    out.push({
      venueId: "klokgebouw",
      title,
      start: when.start,
      hasTime: false,
      status: statusFrom(item.text()) ?? "gepland",
      sourceCategory: item.find(".genre").first().text().trim() || undefined,
      url,
      sourceId: link.attr("data-id") ?? url,
    });
  });
  if (!out.length) throw new Error("Klokgebouw: geen agenda-items gevonden");
  return out;
}

export const klokgebouw: Adapter = {
  name: "klokgebouw.nl",
  venues: ["klokgebouw"],
  async fetch() {
    return parseKlokgebouw((await fetchText(AGENDA)).body, new Date());
  },
};
