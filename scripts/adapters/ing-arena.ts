import { load } from "cheerio";
import { fetchText } from "../lib/http";
import { localToIso, monthNumber, TZ_BY_COUNTRY } from "../lib/dates";
import type { Adapter, SourceEvent } from "./types";

/**
 * ING Arena (Brussels, the former Palais 12): the WordPress API lists the shows; the show date is only on the
 * show page itself (a French date like "3 octobre 2027"). Level 1 (list) + level 3 (date per page).
 */
const BASE = "https://ing.arena.brussels";

interface WpShow {
  id: number;
  link?: string;
  title?: { rendered?: string };
}

/** First French or Dutch date ("3 octobre 2027") in the show page's dynamic fields. */
export function parseIngShowDate(html: string): { y: number; mo: number; d: number } | undefined {
  const $ = load(html);
  const texts = $(".elementor-widget-jet-listing-dynamic-field").map((_, el) => $(el).text().replace(/\s+/g, " ").trim()).get();
  for (const t of texts) {
    const m = t.match(/\b(\d{1,2})(?:er)?\s+([a-zéû]+)\s+(\d{4})\b/i);
    const mo = m ? monthNumber(m[2]) : undefined;
    if (m && mo) return { y: +m[3], mo, d: +m[1] };
  }
  return undefined;
}

export function parseIngShowList(json: string): { id: number; url: string; title: string }[] {
  const list = JSON.parse(json) as WpShow[];
  if (!Array.isArray(list)) throw new Error("ING Arena: onverwacht antwoord van de WordPress-API");
  return list
    .filter((s) => s.link?.startsWith(BASE) && s.title?.rendered)
    .map((s) => ({ id: s.id, url: s.link!, title: load(`<p>${s.title!.rendered}</p>`)("p").text().trim() }));
}

export const ingArena: Adapter = {
  name: "ing.arena.brussels",
  venues: ["palais-12"],
  async fetch() {
    const shows = parseIngShowList((await fetchText(`${BASE}/wp-json/wp/v2/show?per_page=100&_fields=id,link,title`, "application/json")).body);
    const out: SourceEvent[] = [];
    for (const s of shows) {
      const date = parseIngShowDate((await fetchText(s.url)).body);
      if (!date) continue;
      const { start, hasTime } = localToIso(date.y, date.mo, date.d, undefined, TZ_BY_COUNTRY.BE);
      out.push({ venueId: "palais-12", title: s.title, start, hasTime, url: s.url, sourceId: String(s.id) });
    }
    return out;
  },
};
