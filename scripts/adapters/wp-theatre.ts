import { load } from "cheerio";
import { fetchText } from "../lib/http";
import { localToIso, monthNumber, TZ_BY_COUNTRY } from "../lib/dates";
import type { Adapter, SourceEvent } from "./types";

/**
 * Generic adapter for theatres whose site runs the WordPress plugin "Theater for WordPress": every show is a
 * <div class="wp_theatre_event"> with title, subtitle, categories ("Cabaret"), date "do 26 nov ‘26",
 * time "20:30" and a tickets link or a sold-out label. Level 3 HTML, same markup on every such site.
 */
export function parseWpTheatre(html: string, venueId: string): SourceEvent[] {
  const $ = load(html);
  const out: SourceEvent[] = [];
  $("div.wp_theatre_event").each((_, el) => {
    const ev = $(el);
    const link = ev.find(".wp_theatre_event_title a").first();
    const title = link.text().trim();
    const url = link.attr("href");
    const m = ev.find(".startdate_date").first().text().trim().match(/(\d{1,2})\s+([a-z]{3,})\.?\s+[‘'’]?(\d{2,4})/i);
    const month = m && monthNumber(m[2]);
    if (!title || !url || !m || !month) return;
    const year = m[3].length === 2 ? 2000 + Number(m[3]) : Number(m[3]);
    const time = ev.find(".wp_theatre_event_starttime").first().text().trim().match(/^\d{1,2}:\d{2}$/)?.[0];
    const when = localToIso(year, month, Number(m[1]), time, TZ_BY_COUNTRY.NL);
    const categories = ev.find(".wpt_production_category").map((_, c) => $(c).text().trim()).get();
    const tickets = ev.find("a.wp_theatre_event_tickets_url").attr("href");
    const soldOut = ev.find(".wp_theatre_event_tickets_status_soldout").length > 0;
    const cancelled = ev.find(".wp_theatre_event_tickets_status_cancelled").length > 0;
    out.push({
      venueId,
      title,
      artists: [title],
      start: when.start,
      hasTime: when.hasTime,
      status: cancelled ? "geannuleerd" : soldOut ? "uitverkocht" : "gepland",
      // Only the theatre's own categories: subtitles are show names ("€ 472.000,-") and would mislead the genre rules.
      sourceCategory: categories.join(", ") || undefined,
      url,
      ticketUrl: tickets?.startsWith("http") ? tickets : undefined,
      sourceId: `${url}|${when.start}`,
    });
  });
  if (!out.length) throw new Error(`${venueId}: geen voorstellingen gevonden (Theater for WordPress)`);
  return out;
}

export function wpTheatreAdapter(name: string, venueId: string, url: string): Adapter {
  return {
    name,
    venues: [venueId],
    async fetch() {
      return parseWpTheatre((await fetchText(url)).body, venueId);
    },
  };
}

export const kattendans = wpTheatreAdapter("kattendans.nl", "kattendans", "https://kattendans.nl/programma/");
