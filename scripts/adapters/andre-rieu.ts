import { load } from "cheerio";
import { fetchText } from "../lib/http";
import { localToIso, TZ_BY_COUNTRY } from "../lib/dates";
import type { Adapter, SourceEvent } from "./types";

const BASE = "https://www.andrerieu.com";

/**
 * Vrijthof (Maastricht) has no agenda of its own; its concerts are André Rieu's summer series. His site lists
 * every tour date as <li data-date-ordering="unix time"> with city and location; we keep those on the Vrijthof
 * (B34). Level 3 HTML.
 */
export function parseAndreRieu(html: string): SourceEvent[] {
  const $ = load(html);
  const out: SourceEvent[] = [];
  const seen = new Set<string>();
  $("li[data-date-ordering]").each((_, el) => {
    const li = $(el);
    if (!/vrijthof/i.test(li.find(".location").text())) return;
    const ts = Number(li.attr("data-date-ordering"));
    if (!ts) return;
    // The timestamp is local midnight; read the day in Amsterdam time.
    const day = new Intl.DateTimeFormat("en-CA", { timeZone: TZ_BY_COUNTRY.NL, year: "numeric", month: "2-digit", day: "2-digit" }).format(new Date(ts * 1000));
    if (seen.has(day)) return;
    seen.add(day);
    const [y, m, d] = day.split("-").map(Number);
    const when = localToIso(y, m, d, undefined, TZ_BY_COUNTRY.NL);
    const href = li.find("a.concert[href], a[href*='/tour/']").first().attr("href");
    out.push({
      venueId: "vrijthof",
      title: "André Rieu",
      start: when.start,
      hasTime: false,
      status: "gepland",
      sourceCategory: "Klassiek, orkest",
      url: href ? new URL(href, BASE).href : `${BASE}/nl/tour`,
      ticketUrl: href ? new URL(href, BASE).href : undefined,
      sourceId: `andre-rieu-vrijthof-${day}`,
    });
  });
  if (!out.length) throw new Error("André Rieu: geen Vrijthof-concerten gevonden");
  return out;
}

export const andreRieu: Adapter = {
  name: "andrerieu.com (Vrijthof)",
  venues: ["vrijthof"],
  async fetch() {
    return parseAndreRieu((await fetchText(`${BASE}/nl/`)).body);
  },
};
