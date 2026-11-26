import { load } from "cheerio";
import { fetchText } from "../lib/http";
import { localToIso, TZ_BY_COUNTRY } from "../lib/dates";
import type { Adapter, SourceEvent } from "./types";

const BASE = "https://www.plt.nl/programma";
const MAX_PAGES = 80;

/** The three houses of Parkstad Limburg Theaters, by the logo name on each tile. */
const HOUSES: [RegExp, string][] = [
  [/heerlen/i, "plt-heerlen"],
  [/kerkrade/i, "plt-kerkrade"],
  [/sittard|toon hermans/i, "toon-hermans-theater"],
];

/**
 * Parkstad Limburg Theaters (plt.nl): programme pages `/programma?page=N`, 12 tiles each. A tile links to
 * `/programma/<slug>/dd-mm-yyyy-hh-mm` and holds "Muziek - Do 26 nov. 2026 - 20:00 uur", title, subtitle and
 * the logo of the house (Heerlen, Kerkrade or Toon Hermans Theater Sittard). Level 3 HTML.
 */
export function parsePlt(html: string): SourceEvent[] {
  const $ = load(html);
  const out: SourceEvent[] = [];
  $("a.show-tile").each((_, el) => {
    const tile = $(el);
    const url = tile.attr("href") ?? "";
    const m = url.match(/^https:\/\/www\.plt\.nl\/programma\/[^/]+\/(\d{2})-(\d{2})-(\d{4})-(\d{2})-(\d{2})$/);
    const title = tile.find(".show-tile__content .h4").first().text().trim();
    const house = tile.find("img.show-tile__logo").attr("alt") ?? "";
    const venueId = HOUSES.find(([re]) => re.test(house))?.[1];
    if (!m || !title || !venueId) return;
    const subtitle = tile.find(".show-tile__content .h3").first().text().trim();
    const genre = tile.find(".show-tile__content p").first().text().split(/\s+-\s+/)[0].trim();
    const label = tile.find(".show-tile__label").attr("data-label") ?? "";
    const when = localToIso(Number(m[3]), Number(m[2]), Number(m[1]), `${m[4]}:${m[5]}`, TZ_BY_COUNTRY.NL);
    out.push({
      venueId,
      title: subtitle ? `${title}: ${subtitle}` : title,
      artists: [title],
      start: when.start,
      hasTime: when.hasTime,
      status: /soldout|uitverkocht/i.test(label) ? "uitverkocht" : /cancel/i.test(label) ? "geannuleerd" : "gepland",
      sourceCategory: genre || undefined,
      url,
      sourceId: url,
    });
  });
  return out;
}

/** Highest page number in the pagination select. */
export function pltPages(html: string): number {
  const nums = [...html.matchAll(/programma\?page=(\d+)/g)].map((m) => Number(m[1]));
  return Math.min(Math.max(1, ...nums), MAX_PAGES);
}

export const plt: Adapter = {
  name: "plt.nl",
  venues: HOUSES.map(([, id]) => id),
  async fetch() {
    const first = (await fetchText(BASE)).body;
    const out = parsePlt(first);
    const pages = pltPages(first);
    for (let n = 2; n <= pages; n++) out.push(...parsePlt((await fetchText(`${BASE}?page=${n}`)).body));
    if (!out.length) throw new Error("PLT: geen voorstellingen gevonden");
    return out;
  },
};
