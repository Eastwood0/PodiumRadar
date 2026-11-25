import { load } from "cheerio";
import { fetchText } from "../lib/http";
import { normalizeIso, TZ_BY_COUNTRY } from "../lib/dates";
import type { Adapter, SourceEvent } from "./types";

const BASE = "https://www.johancruijffarena.nl";

/** Parses the Johan Cruijff ArenA calendar (cards with <time datetime>). Level 3 (HTML, machine-readable dates). */
export function parseJca(html: string): SourceEvent[] {
  const $ = load(html);
  const out: SourceEvent[] = [];
  $("time[datetime]").each((_, t) => {
    const card = $(t).closest("a, article, .card");
    const href = card.is("a") ? card.attr("href") : card.find('a[href*="/kalender/"]').attr("href") ?? card.closest("a").attr("href");
    const title = card.find(".card__title h3, h3").first().text().trim();
    const when = normalizeIso($(t).attr("datetime") ?? "", TZ_BY_COUNTRY.NL);
    if (!href || !title || !when || !/\/kalender\/\d+/.test(href)) return;
    const url = new URL(href, BASE).href;
    out.push({
      venueId: "johan-cruijff-arena",
      title,
      start: when.start,
      hasTime: when.hasTime,
      sourceCategory: card.find(".card__meta").text().trim() || undefined,
      url,
      sourceId: url.match(/kalender\/(\d+)/)?.[1] ?? url,
    });
  });
  return out;
}

export const johanCruijffArena: Adapter = {
  name: "johancruijffarena.nl",
  venues: ["johan-cruijff-arena"],
  async fetch() {
    const { body } = await fetchText(`${BASE}/kalender/`);
    return parseJca(body);
  },
};
