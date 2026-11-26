import { load } from "cheerio";
import { fetchText } from "../lib/http";
import { localToIso, TZ_BY_COUNTRY } from "../lib/dates";
import { statusFrom } from "../lib/normalize";
import { inferYear } from "./uitagenda-utrecht";
import type { Adapter, SourceEvent } from "./types";

const AGENDA = "https://www.grenswerk.nl/agenda/";

/** Other places in Venlo that Grenswerk programmes (Maaspoort theatre, a church): not at Grenswerk itself. */
const ELSEWHERE = /maaspoort|joriskerk|kerk\b|theater|schouwburg/i;

/**
 * Grenswerk (Venlo): agenda list items with "05.12", a line like "Pop / Open 19:30 / Aanvang 20:30 / € 29,-"
 * and a tickets or "Uitverkocht" button. No year: the first year in which the day is still to come. Level 3 HTML.
 */
export function parseGrenswerk(html: string, today: Date): SourceEvent[] {
  const $ = load(html);
  const out: SourceEvent[] = [];
  $("li.item[data-target]").each((_, el) => {
    const item = $(el);
    const url = item.attr("data-target")!;
    const title = item.find(".text h3").first().text().trim();
    const dm = item.find(".date strong").text().trim().match(/^(\d{1,2})\.(\d{1,2})$/);
    if (!title || !dm) return;
    const info = item.find(".text p").first().text().replace(/\s+/g, " ").trim();
    const note = item.find(".text h4, .text").text();
    if (ELSEWHERE.test(info) || /locatie:\s*(?!grenswerk)/i.test(note)) return;
    const parts = info.split(" / ").map((p) => p.trim());
    const start = parts.find((p) => /^aanvang\s+\d{1,2}:\d{2}$/i.test(p))?.replace(/aanvang\s+/i, "");
    const day = Number(dm[1]);
    const month = Number(dm[2]);
    const when = localToIso(inferYear(day, month, today), month, day, start, TZ_BY_COUNTRY.NL);
    const genre = parts.filter((p) => !/^(open|aanvang)\s|€|&euro;|gratis|grenswerk/i.test(p)).join(", ");
    out.push({
      venueId: "grenswerk",
      title,
      start: when.start,
      hasTime: when.hasTime,
      status: statusFrom(item.find(".ticket_cont").text()) ?? "gepland",
      sourceCategory: [item.attr("data-filter"), genre].filter(Boolean).join(", ") || undefined,
      url,
      ticketUrl: item.find(".ticket_cont a[href^='http']").attr("href"),
      sourceId: url,
    });
  });
  if (!out.length) throw new Error("Grenswerk: geen agenda-items gevonden");
  return out;
}

export const grenswerk: Adapter = {
  name: "grenswerk.nl",
  venues: ["grenswerk"],
  async fetch() {
    return parseGrenswerk((await fetchText(AGENDA)).body, new Date());
  },
};
