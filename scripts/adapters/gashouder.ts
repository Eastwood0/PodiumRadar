import { load } from "cheerio";
import { fetchText } from "../lib/http";
import { localToIso, monthNumber, TZ_BY_COUNTRY } from "../lib/dates";
import { statusFrom } from "../lib/normalize";
import type { Adapter, SourceEvent } from "./types";

const BASE = "https://gashouder.nl";

/**
 * Gashouder (Amsterdam) prints its whole programme on the home page, grouped under month headings without
 * a year ("DI 1 DEC", "20:00", "live"/"dance"); the first month of a new year carries the year ("2027 FEBRUARI").
 * Level 3 HTML. Without a printed year, a month lower than the one before starts a new year.
 */
export function parseGashouder(html: string, today: Date): SourceEvent[] {
  const $ = load(html);
  const out: SourceEvent[] = [];
  const seen = new Set<string>();
  let year = today.getFullYear();
  let lastMonth = 0;
  $("h2").each((_, h2) => {
    const text = $(h2).text().trim();
    const month = monthNumber(text);
    if (!month || !/^(\d{4})?\s*[A-Za-z]+$/.test(text)) return;
    const printed = text.match(/^\d{4}/);
    if (printed) year = Number(printed[0]);
    else if (lastMonth && month < lastMonth) year++;
    lastMonth = month;
    $(h2)
      .nextAll("ul")
      .first()
      .find('a[href^="/programma/"]')
      .each((_, a) => {
        const link = $(a);
        const href = link.attr("href")!;
        if (seen.has(href)) return;
        const block = link.find("div").first();
        const labels = block.find(".label-small").map((_, s) => $(s).text().trim()).get();
        const dayLabel = labels.find((l) => /^[A-Z]{2}\s+\d{1,2}\s+[A-Z]{3}$/.test(l));
        const time = labels.find((l) => /^\d{2}:\d{2}$/.test(l));
        const kind = labels.find((l) => /^[a-z]+$/.test(l));
        const title = block.find("h3").attr("data-original")?.trim();
        if (!dayLabel || !title) return; // multi-day exhibitions ("VR 30 OKT - ZO 3 JAN") are not shows
        const [, d, mon] = dayLabel.split(/\s+/);
        const m = monthNumber(mon) ?? month;
        const when = localToIso(m < month ? year + 1 : year, m, Number(d), time === "00:00" ? undefined : time, TZ_BY_COUNTRY.NL);
        seen.add(href);
        out.push({
          venueId: "gashouder",
          title,
          start: when.start,
          hasTime: when.hasTime,
          status: statusFrom(link.text()),
          sourceCategory: kind,
          url: BASE + href,
          sourceId: href,
        });
      });
  });
  if (!out.length) throw new Error("Gashouder: geen programma gevonden");
  return out;
}

export const gashouder: Adapter = {
  name: "gashouder.nl",
  venues: ["gashouder"],
  async fetch() {
    return parseGashouder((await fetchText(`${BASE}/`)).body, new Date());
  },
};
