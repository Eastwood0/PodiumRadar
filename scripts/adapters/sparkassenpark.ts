import { load } from "cheerio";
import { fetchText } from "../lib/http";
import { localToIso, TZ_BY_COUNTRY } from "../lib/dates";
import type { Adapter, SourceEvent } from "./types";

/**
 * SparkassenPark Mönchengladbach: the operator's WordPress lists events for many venues; venue term 3 is the
 * SparkassenPark itself. The date is only in the title ("PUR 04.06.2027 SparkassenPark Mönchengladbach").
 * Level 1 (API) with the date taken from the title; events without a date in the title are skipped.
 */
const API = "https://sparkassenpark.de/wp-json/wp/v2/event?venue=3&per_page=100&_fields=id,title,link";

const PLACE_WORDS = /\b(sparkassen ?park|skp|m[öo]nchengladbach|mg)\b[,\s]*/gi;

export function parseSparkassenparkTitle(raw: string): { title: string; y: number; mo: number; d: number } | undefined {
  const text = load(`<p>${raw}</p>`)("p").text().replace(/\s+/g, " ").trim();
  const m = text.match(/(?<!\d)(\d{1,2})\.(\d{1,2})\.(\d{4}|\d{2})(?!\d)/);
  if (!m) return undefined;
  const y = m[3].length === 2 ? 2000 + Number(m[3]) : Number(m[3]);
  const title = (text.slice(0, m.index) + " " + text.slice(m.index! + m[0].length))
    .replace(PLACE_WORDS, " ")
    .replace(/[|,–-]\s*$/g, "")
    .replace(/\s+/g, " ")
    .trim()
    .replace(/[|,–-]$/, "")
    .trim();
  return title ? { title, y, mo: Number(m[2]), d: Number(m[1]) } : undefined;
}

export function parseSparkassenpark(json: string): SourceEvent[] {
  const list = JSON.parse(json) as { id: number; link?: string; title?: { rendered?: string } }[];
  if (!Array.isArray(list)) throw new Error("SparkassenPark: onverwacht antwoord van de WordPress-API");
  const out: SourceEvent[] = [];
  for (const e of list) {
    const parsed = e.title?.rendered ? parseSparkassenparkTitle(e.title.rendered) : undefined;
    if (!parsed || !e.link?.startsWith("http")) continue;
    const { start, hasTime } = localToIso(parsed.y, parsed.mo, parsed.d, undefined, TZ_BY_COUNTRY.DE);
    out.push({ venueId: "sparkassenpark", title: parsed.title, start, hasTime, url: e.link, sourceId: String(e.id) });
  }
  return out;
}

export const sparkassenpark: Adapter = {
  name: "sparkassenpark.de",
  venues: ["sparkassenpark"],
  async fetch() {
    return parseSparkassenpark((await fetchText(API, "application/json")).body);
  },
};
