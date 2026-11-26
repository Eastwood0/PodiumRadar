import { load } from "cheerio";
import { fetchText } from "../lib/http";
import { localToIso, monthNumber, TZ_BY_COUNTRY } from "../lib/dates";
import { statusFrom } from "../lib/normalize";
import type { Adapter, SourceEvent } from "./types";

const AGENDA = "https://www.debosuil.nl/programma";

/**
 * De Bosuil (Weert): programme page with month headings ("december 2026") and one link per show holding
 * the day ("di 1 dec"), a genre ("Hardrock"), the title and a label ("Uitverkocht", "Membercard"). Level 3 HTML.
 */
export function parseBosuil(html: string): SourceEvent[] {
  const $ = load(html);
  const out: SourceEvent[] = [];
  const seen = new Set<string>();
  let year = 0;
  let month = 0;
  $("body *").each((_, el) => {
    const node = $(el);
    const href = node.is("a") ? node.attr("href") ?? "" : "";
    if (/^https:\/\/www\.debosuil\.nl\/programma\/[^/]+\/?$/.test(href)) {
      const spans = node.find(".flex.uppercase span").map((_, s) => $(s).text().trim()).get();
      const dm = spans[0]?.match(/(\d{1,2})\s+([a-z]{3,})/i);
      const title = node.find("h2").first().text().trim();
      const m = dm && monthNumber(dm[2]);
      if (!dm || !m || !title || !year || seen.has(href)) return;
      seen.add(href);
      const when = localToIso(m < month ? year + 1 : year, m, Number(dm[1]), undefined, TZ_BY_COUNTRY.NL);
      out.push({
        venueId: "de-bosuil",
        title,
        start: when.start,
        hasTime: false,
        status: statusFrom(node.text()) ?? "gepland",
        sourceCategory: spans[1] || undefined,
        url: href,
        sourceId: href,
      });
      return;
    }
    if (node.children().length) return;
    const heading = node.text().trim().match(/^([a-z]+)\s+(\d{4})$/i);
    if (heading && monthNumber(heading[1])) {
      month = monthNumber(heading[1])!;
      year = Number(heading[2]);
    }
  });
  if (!out.length) throw new Error("De Bosuil: geen programma gevonden");
  return out;
}

export const bosuil: Adapter = {
  name: "debosuil.nl",
  venues: ["de-bosuil"],
  async fetch() {
    return parseBosuil((await fetchText(AGENDA)).body);
  },
};
