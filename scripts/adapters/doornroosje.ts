import { load } from "cheerio";
import { fetchText } from "../lib/http";
import { localToIso, monthNumber, TZ_BY_COUNTRY } from "../lib/dates";
import { statusFrom } from "../lib/normalize";
import type { Adapter, SourceEvent } from "./types";

const BASE = "https://www.doornroosje.nl/";

/** Doornroosje also programmes shows in other Nijmegen venues; those carry the place in the info line. */
const ELSEWHERE = /\b(de vereeniging|stadsschouwburg|lindenberg|goffert|park|kerk)\b/i;

/**
 * Doornroosje (Nijmegen): the home page holds the whole programme under month headings with a year
 * ("januari 2027"), each item with day, title, subtitle and an optional status ("Uitverkocht"). Level 3 HTML.
 */
export function parseDoornroosje(html: string): SourceEvent[] {
  const $ = load(html);
  const out: SourceEvent[] = [];
  let year = 0;
  let month = 0;
  let last: { d: string; mon: string } | undefined; // items marked "--samedate" print no date of their own
  $(".c-program__month, a.c-program__item").each((_, el) => {
    const node = $(el);
    if (node.hasClass("c-program__month")) {
      const m = node.text().trim().match(/^([a-z]+)\s+(\d{4})$/i);
      if (m && monthNumber(m[1])) {
        month = monthNumber(m[1])!;
        year = Number(m[2]);
      }
      return;
    }
    const url = node.attr("href");
    const title = node.find(".c-program__title--main").text().trim();
    const spans = node.find(".c-program__date span").map((_, s) => $(s).text().trim()).get();
    const date = spans.length >= 3 ? { d: spans[1], mon: spans[2] } : node.hasClass("c-program__item--samedate") ? last : undefined;
    if (date) last = date;
    const d = date?.d;
    const m = monthNumber(date?.mon ?? "") ?? month;
    if (!url || !title || !d || !year) return;
    const info = node.find(".c-program__info").map((_, s) => $(s).text().trim()).get().join(" / ");
    if (ELSEWHERE.test(info)) return;
    const when = localToIso(m < month ? year + 1 : year, m, Number(d), undefined, TZ_BY_COUNTRY.NL);
    const small = node.find(".c-program__title--small").text().trim();
    out.push({
      venueId: "doornroosje",
      title,
      // "+ Anthonie Tonnon" lists support acts; other small titles are taglines ("Industrial special").
      artists: small.startsWith("+") ? [title, ...small.slice(1).split(/\s*(?:\+|,)\s*/).map((s) => s.trim()).filter((s) => s.length > 1)] : undefined,
      start: when.start,
      hasTime: false,
      status: statusFrom(node.find(".c-program__status").text()) ?? "gepland",
      sourceCategory: info || undefined,
      url,
      sourceId: url,
    });
  });
  if (!out.length) throw new Error("Doornroosje: geen programma gevonden");
  return out;
}

export const doornroosje: Adapter = {
  name: "doornroosje.nl",
  venues: ["doornroosje"],
  async fetch() {
    return parseDoornroosje((await fetchText(BASE)).body);
  },
};
