import { load } from "cheerio";
import { fetchText } from "../lib/http";
import { localToIso, TZ_BY_COUNTRY } from "../lib/dates";
import type { Adapter, SourceEvent } from "./types";

const URL_LIST = "https://www.grugahalle.de/multipurpose-hall/events-dates/";

/** Parses the Grugahalle list view (server-rendered, next ~3 years by default). Level 3 (HTML). */
export function parseGrugahalle(html: string): SourceEvent[] {
  const $ = load(html);
  const out: SourceEvent[] = [];
  $("#date_entries a.entry-link").each((_, el) => {
    const a = $(el);
    const url = a.attr("href") ?? "";
    const title = a.find("h2").first().text().trim();
    const m = a.find(".meta").first().text().trim().match(/^(\d{1,2})\.(\d{1,2})\.(\d{4})/);
    if (!url.startsWith("http") || !title || !m) return;
    // Only events in the Grugahalle itself (the site also lists other halls of the same operator).
    if (!a.find(".tags .gh").length) return;
    const { start, hasTime } = localToIso(+m[3], +m[2], +m[1], undefined, TZ_BY_COUNTRY.DE);
    out.push({ venueId: "grugahalle", title, start, hasTime, url, sourceId: a.attr("data-entry-id") ?? url });
  });
  return out;
}

export const grugahalle: Adapter = {
  name: "grugahalle.de",
  venues: ["grugahalle"],
  async fetch() {
    const { body } = await fetchText(URL_LIST);
    return parseGrugahalle(body);
  },
};
