import { load } from "cheerio";
import { fetchText } from "../lib/http";
import { localToIso, monthNumber, TZ_BY_COUNTRY } from "../lib/dates";
import type { Adapter, SourceEvent } from "./types";

/**
 * UITagenda Utrecht (the city's cultural agenda) lists TivoliVredenburg's programme. Used because
 * tivolivredenburg.nl blocks all automated visitors (B23). The agenda covers all of Utrecht in date order,
 * 40 per page; we keep only items at the configured locations. Level 2 (shared platform, HTML).
 */
const BASE = "https://www.uitagendautrecht.nl/agenda/";
const MAX_PAGES = 120;

export const UITAGENDA_UTRECHT_LOCATIONS: Record<string, string> = { TivoliVredenburg: "tivolivredenburg" };

/** Picks the year for a day/month without year: the first occurrence on or after `today`. */
export function inferYear(day: number, month: number, today: Date): number {
  const y = today.getFullYear();
  const candidate = Date.UTC(y, month - 1, day);
  const startOfToday = Date.UTC(y, today.getMonth(), today.getDate());
  return candidate >= startOfToday - 86_400_000 ? y : y + 1;
}

export function parseUitagendaUtrecht(html: string, today: Date): { events: SourceEvent[]; lastPage: number; itemCount: number } {
  const $ = load(html);
  const events: SourceEvent[] = [];
  const items = $("a.event-overview--item");
  items.each((_, a) => {
    const item = $(a);
    const venueName = item.find(".post-location span").first().text().trim();
    const venueId = UITAGENDA_UTRECHT_LOCATIONS[venueName];
    if (!venueId) return;
    const title = item.find(".post-title").first().text().trim();
    const url = item.attr("href") ?? "";
    // Date cell: "wo 25 nov"; a range ("wo 25 nov - wo 2 dec") is a multi-day course or exhibition: skipped.
    const dateText = item.closest(".item").find("th").eq(1).text().trim() || item.find("th").eq(1).text().trim();
    const timeText = item.closest(".item").find("td").eq(1).text().trim() || item.find("td").eq(1).text().trim();
    const m = dateText.match(/^[a-z]{2}\s+(\d{1,2})\s+([a-z]+)$/i);
    const mo = m ? monthNumber(m[2]) : undefined;
    if (!title || !url || !m || !mo) return;
    const time = timeText.match(/^(\d{1,2}:\d{2})/)?.[1];
    const { start, hasTime } = localToIso(inferYear(+m[1], mo, today), mo, +m[1], time, TZ_BY_COUNTRY.NL);
    events.push({
      venueId,
      title,
      start,
      hasTime,
      sourceCategory: item.find(".genre-label").first().text().trim() || undefined,
      url,
      sourceId: url.match(/evenement\/(\d+)/)?.[1] ?? url,
      imageUrl: item.find("img").attr("src"),
    });
  });
  const pages = $('a[href*="/agenda/?page="]').map((_, a) => Number($(a).attr("href")!.match(/page=(\d+)/)?.[1] ?? 0)).get();
  return { events, lastPage: Math.max(1, ...pages), itemCount: items.length };
}

export const uitagendaUtrecht: Adapter = {
  name: "uitagendautrecht.nl",
  venues: [...new Set(Object.values(UITAGENDA_UTRECHT_LOCATIONS))],
  async fetch() {
    const today = new Date();
    const all: SourceEvent[] = [];
    let last = 1;
    for (let page = 1; page <= Math.min(last, MAX_PAGES); page++) {
      const { body } = await fetchText(page === 1 ? BASE : `${BASE}?page=${page}`);
      const r = parseUitagendaUtrecht(body, today);
      if (!r.itemCount) break;
      all.push(...r.events);
      last = Math.max(last, r.lastPage);
    }
    return all;
  },
};
