import { load } from "cheerio";
import { fetchText } from "../lib/http";
import { localToIso, TZ_BY_COUNTRY } from "../lib/dates";
import type { Adapter, SourceEvent } from "./types";

const BASE = "https://www.pinkpop.nl/";
const DAY_OFFSET: Record<string, number> = { friday: 0, saturday: 1, sunday: 2 };
const DAY_NL: Record<string, string> = { friday: "vrijdag", saturday: "zaterdag", sunday: "zondag" };

/**
 * Megaland (Landgraaf) has no agenda of its own; its big yearly event is Pinkpop. The festival site lists each
 * act with its day (data-day="friday") and a countdown to the first day (data-due). We make one event per
 * festival day with that day's acts, so searching for an act finds its Pinkpop day. Level 3 HTML.
 */
export function parsePinkpop(html: string): SourceEvent[] {
  const $ = load(html);
  const due = $("[data-due]").first().attr("data-due")?.match(/^(\d{4})-(\d{2})-(\d{2})/);
  if (!due) throw new Error("Pinkpop: festivaldatum niet gevonden");
  const firstDay = Date.UTC(Number(due[1]), Number(due[2]) - 1, Number(due[3]));
  const acts: Record<string, string[]> = {};
  $('a[href*="/line-up/"][data-day]').each((_, a) => {
    const day = $(a).attr("data-day")!;
    const name = $(a).find("h2, h3, h4").first().text().trim();
    if (!name || !(day in DAY_OFFSET)) return;
    const list = (acts[day] ??= []);
    if (!list.includes(name)) list.push(name);
  });
  const year = due[1];
  const out = Object.entries(acts).map(([day, names]): SourceEvent => {
    const d = new Date(firstDay + DAY_OFFSET[day] * 86_400_000);
    const when = localToIso(d.getUTCFullYear(), d.getUTCMonth() + 1, d.getUTCDate(), undefined, TZ_BY_COUNTRY.NL);
    return {
      venueId: "megaland",
      title: `Pinkpop ${year} (${DAY_NL[day]})`,
      artists: names,
      start: when.start,
      hasTime: false,
      status: "gepland",
      sourceCategory: "festival",
      url: BASE,
      sourceId: `pinkpop-${year}-${day}`,
    };
  });
  if (!out.length) throw new Error("Pinkpop: geen line-up gevonden");
  return out.sort((a, b) => a.start.localeCompare(b.start));
}

export const pinkpop: Adapter = {
  name: "pinkpop.nl (Megaland)",
  venues: ["megaland"],
  async fetch() {
    return parsePinkpop((await fetchText(BASE)).body);
  },
};
