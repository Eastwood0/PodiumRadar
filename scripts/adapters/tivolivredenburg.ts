import { load } from "cheerio";
import { fetchText } from "../lib/http";
import { localToIso, monthNumber, TZ_BY_COUNTRY } from "../lib/dates";
import { statusFrom } from "../lib/normalize";
import type { Adapter, SourceEvent } from "./types";

const BASE = "https://www.tivolivredenburg.nl/agenda/";
const MAX_PAGES = 40; // 20 events per page; ~12 months fit well within this

/** Parses one TivoliVredenburg agenda page. Level 3 (HTML). */
export function parseTivoli(html: string): { events: SourceEvent[]; hasNext: boolean } {
  const $ = load(html);
  const events: SourceEvent[] = [];
  $(".agenda-list-item__time").each((_, t) => {
    const item = $(t).closest(".agenda-list-item, li, article").length ? $(t).closest(".agenda-list-item, li, article") : $(t).parent().parent();
    const link = item.find("a.agenda-list-item__title-link").first();
    const title = link.text().trim();
    const url = link.attr("href") ?? "";
    const m = $(t).text().trim().match(/(\d{1,2})\s+([a-z]+)\.?\s+(\d{4})/i); // "wo 25 nov 2026"
    const mo = m ? monthNumber(m[2]) : undefined;
    if (!title || !url || !m || !mo) return;
    const { start, hasTime } = localToIso(+m[3], mo, +m[1], undefined, TZ_BY_COUNTRY.NL);
    events.push({
      venueId: "tivolivredenburg",
      title,
      start,
      hasTime,
      status: statusFrom(item.find(".agenda-list-item__label").text()),
      sourceCategory: item.find("[data-genre]").attr("data-genre"),
      url,
      sourceId: url.match(/agenda\/(\d+)\//)?.[1] ?? url,
      imageUrl: item.find("img.agenda-list-item__image").attr("src"),
    });
  });
  const hasNext = $('a[href*="/agenda/page/"]').toArray().some((a) => /next|volgende|›|»/i.test($(a).text() + ($(a).attr("rel") ?? "") + ($(a).attr("class") ?? ""))) || $('link[rel="next"]').length > 0;
  return { events, hasNext };
}

export const tivoliVredenburg: Adapter = {
  name: "tivolivredenburg.nl",
  venues: ["tivolivredenburg"],
  async fetch() {
    const all: SourceEvent[] = [];
    const horizon = Date.now() + 366 * 86_400_000;
    for (let page = 1; page <= MAX_PAGES; page++) {
      const { body } = await fetchText(page === 1 ? BASE : `${BASE}page/${page}/`);
      const { events, hasNext } = parseTivoli(body);
      all.push(...events);
      const last = events.at(-1);
      if (!hasNext || !events.length || (last && Date.parse(last.start) > horizon)) break;
    }
    return all;
  },
};
