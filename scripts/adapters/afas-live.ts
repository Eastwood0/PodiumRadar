import { load } from "cheerio";
import { fetchText } from "../lib/http";
import { localToIso, monthNumber, TZ_BY_COUNTRY } from "../lib/dates";
import type { Adapter, SourceEvent } from "./types";

const URL_AGENDA = "https://www.afaslive.nl/agenda";

/** Parses the AFAS Live agenda page (all events on one page, grouped by month). Level 3 (HTML). */
export function parseAfasLive(html: string): SourceEvent[] {
  const $ = load(html);
  const out: SourceEvent[] = [];
  $("article.agendaV2-item").each((_, el) => {
    const a = $(el);
    const title = a.find(".rowMain h4").first().text().trim();
    const url = a.find("a.rowMain").attr("href") ?? "";
    const dateText = a.find(".date .d").first().text().trim(); // "woensdag 25 november 2026"
    const m = dateText.match(/(\d{1,2})\s+([a-z]+)\s+(\d{4})/i);
    if (!title || !url || !m) return;
    const mo = monthNumber(m[2]);
    if (!mo) return;
    const ticketUrl = a.find("a.btnV2.tickets").attr("href");
    const time = ticketUrl?.match(/\/(\d{2}:\d{2})(?:$|[/?])/)?.[1];
    const { start, hasTime } = localToIso(+m[3], mo, +m[1], time, TZ_BY_COUNTRY.NL);
    const cls = a.attr("class") ?? "";
    const status = /st-soldout/.test(cls) ? "uitverkocht" : /st-moved/.test(cls) ? "verplaatst" : /st-cancel/.test(cls) ? "geannuleerd" : undefined;
    out.push({
      venueId: "afas-live",
      title,
      start,
      hasTime,
      status,
      url,
      ticketUrl: ticketUrl?.startsWith("http") ? ticketUrl : undefined,
      sourceId: (a.attr("id") ?? url).replace(/^_agenda_/, ""),
      imageUrl: a.find(".rowImg img").attr("src"),
    });
  });
  return out;
}

export const afasLive: Adapter = {
  name: "afaslive.nl",
  venues: ["afas-live"],
  async fetch() {
    const { body } = await fetchText(URL_AGENDA);
    return parseAfasLive(body);
  },
};
