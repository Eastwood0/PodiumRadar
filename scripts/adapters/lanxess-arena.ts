import { load } from "cheerio";
import { fetchText } from "../lib/http";
import { findTime, localToIso, monthNumber, TZ_BY_COUNTRY } from "../lib/dates";
import { statusFrom } from "../lib/normalize";
import type { Adapter, SourceEvent } from "./types";

const URL_CAL = "https://www.lanxess-arena.de/events-tickets/eventkalender";

/** Category ids from the filter bar on the page (cat2 = Konzert). */
const CATEGORY: Record<string, string> = { cat1: "Sport", cat2: "Konzert", cat3: "Entertainment", cat4: "Eishockey", cat5: "Comedy" };

/** Parses the LANXESS arena event calendar (one page, data-day/month/year attributes). Level 3 (HTML). */
export function parseLanxess(html: string): SourceEvent[] {
  const $ = load(html);
  const out: SourceEvent[] = [];
  $("div.eventlistitem[data-year]").each((_, el) => {
    const e = $(el);
    const title = e.find(".eventlistinfotitle").first().text().replace(/\s+/g, " ").trim();
    const url = e.find('a[href*="/eventdetail/"]').attr("href") ?? "";
    const y = Number(e.attr("data-year"));
    const d = Number(e.attr("data-day"));
    const mo = monthNumber(e.attr("data-month") ?? "");
    if (!title || !url || !y || !d || !mo) return;
    const time = findTime(e.find(".eventlistColDate").text());
    const { start, hasTime } = localToIso(y, mo, d, time, TZ_BY_COUNTRY.DE);
    const cls = e.attr("class") ?? "";
    const cat = Object.keys(CATEGORY).find((c) => new RegExp(`\\b${c}\\b`).test(cls));
    const status = statusFrom(e.find(".eventlistColStatus").text()) ?? (/\binactive\b/.test(cls) ? statusFrom(e.text()) : undefined);
    out.push({
      venueId: "lanxess-arena",
      title,
      start,
      hasTime,
      status,
      sourceCategory: cat ? CATEGORY[cat] : undefined,
      url,
      sourceId: url.match(/eventdetail\/(\d+)/)?.[1] ?? url,
      imageUrl: undefined,
    });
  });
  return out;
}

export const lanxessArena: Adapter = {
  name: "lanxess-arena.de",
  venues: ["lanxess-arena"],
  async fetch() {
    const { body } = await fetchText(URL_CAL);
    return parseLanxess(body);
  },
};
