import { load } from "cheerio";
import { fetchText } from "../lib/http";
import { localToIso, monthNumber, TZ_BY_COUNTRY } from "../lib/dates";
import { statusFrom } from "../lib/normalize";
import { inferYear } from "./uitagenda-utrecht";
import type { Adapter, SourceEvent } from "./types";

const AGENDA = "https://www.theaterroermond.nl/agenda";

/**
 * TheaterHotel De Oranjerie (Roermond), site theaterroermond.nl. The agenda page lists every production once
 * (`.event` with link, genre and first date); a production page lists all performances in its ticket block as
 * "Vr <b>27 nov</b> om <b>20:00</b>" with an optional status label. The dates carry no year: the nearest coming
 * date is used (inferYear). Rows under "TheaterDiner" and "Parkeerticket" are extras, not performances. Level 3.
 */
export function parseRoermondAgenda(html: string): { url: string; genre?: string }[] {
  const $ = load(html);
  const out = new Map<string, string | undefined>();
  $(".event").each((_, el) => {
    const ev = $(el);
    const url = ev.find("a.event-title").attr("href") ?? ev.find("a.event-image").attr("href");
    if (!url?.startsWith("https://www.theaterroermond.nl/agenda/")) return;
    const genre = ev.find(".event-genre").first().text().trim() || ev.find(".overlay-genre").first().text().trim();
    if (!out.has(url)) out.set(url, genre || undefined);
  });
  return [...out].map(([url, genre]) => ({ url, genre }));
}

export function parseRoermondProduction(html: string, pageUrl: string, genre: string | undefined, today = new Date()): SourceEvent[] {
  const $ = load(html);
  const title = $("h1").first().text().trim();
  if (!title) return [];
  const out: SourceEvent[] = [];
  $(".event-sticky-menu .event-date .date-row").each((_, el) => {
    const row = $(el);
    const m = row.find("span").first().text().replace(/\s+/g, " ").match(/(\d{1,2})\s+([a-z]{3,})\.?\s+om\s+(\d{1,2}:\d{2})/i);
    const month = m && monthNumber(m[2]);
    if (!m || !month) return;
    const day = Number(m[1]);
    const when = localToIso(inferYear(day, month, today), month, day, m[3], TZ_BY_COUNTRY.NL);
    out.push({
      venueId: "oranjerie-roermond",
      title,
      artists: [title],
      start: when.start,
      hasTime: when.hasTime,
      status: statusFrom(row.find(".status-label").text()) ?? "gepland",
      sourceCategory: genre,
      url: pageUrl,
      sourceId: `${pageUrl}|${when.start}`,
    });
  });
  return out;
}

export const theaterRoermond: Adapter = {
  name: "theaterroermond.nl",
  venues: ["oranjerie-roermond"],
  async fetch() {
    const productions = parseRoermondAgenda((await fetchText(AGENDA)).body);
    if (!productions.length) throw new Error("Theater Roermond: geen agenda gevonden");
    const out: SourceEvent[] = [];
    let failed = 0;
    for (const p of productions) {
      try {
        out.push(...parseRoermondProduction((await fetchText(p.url)).body, p.url, p.genre));
      } catch (e) {
        failed++;
        console.warn(`theaterroermond.nl: ${p.url} overgeslagen (${String(e)})`);
      }
    }
    if (failed > productions.length / 2) throw new Error(`Theater Roermond: ${failed} van ${productions.length} pagina's mislukt`);
    return out;
  },
};
