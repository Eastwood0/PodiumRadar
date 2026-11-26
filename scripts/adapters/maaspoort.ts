import { load } from "cheerio";
import { fetchText } from "../lib/http";
import { localToIso, TZ_BY_COUNTRY } from "../lib/dates";
import { statusFrom } from "../lib/normalize";
import type { Adapter, SourceEvent } from "./types";

const BASE = "https://www.maaspoort.nl";
const MAX_PAGES = 30;

/**
 * Maaspoort (Venlo): server-rendered programme pages `/programma/?page=N`, 24 shows each. Every
 * `.program-block` links to `/programma/<slug>/dd-mm-yyyy-hh-mm/` and holds title, subtitle, genre, hall
 * and an optional label ("geannuleerd", "uitverkocht"). Level 3 HTML. Shows in Grenswerk (sold through
 * Maaspoort) are skipped: Grenswerk has its own adapter.
 */
export function parseMaaspoort(html: string): SourceEvent[] {
  const $ = load(html);
  const out: SourceEvent[] = [];
  $(".program-block").each((_, el) => {
    const block = $(el);
    const path = block.attr("onclick")?.match(/href='([^']+)'/)?.[1];
    const m = path?.match(/\/(\d{2})-(\d{2})-(\d{4})-(\d{2})-(\d{2})\/?$/);
    const title = block.find(".program-block-title .title").first().text().trim();
    if (!path || !m || !title) return;
    const hall = block.find(".program-block-location").first().text().trim();
    if (/grenswerk/i.test(hall)) return;
    const subtitle = block.find(".program-block-title .subtitle").first().text().trim();
    const genre = block.find("a.program-block-genre").first().text().trim();
    const label = block.find(".program-block-label").first().text().trim();
    const when = localToIso(Number(m[3]), Number(m[2]), Number(m[1]), `${m[4]}:${m[5]}`, TZ_BY_COUNTRY.NL);
    const url = BASE + path;
    out.push({
      venueId: "maaspoort",
      title: subtitle && subtitle.toLowerCase() !== title.toLowerCase() ? `${title}: ${subtitle}` : title,
      artists: [title],
      start: when.start,
      hasTime: when.hasTime,
      status: statusFrom(label) ?? "gepland",
      sourceCategory: genre || undefined,
      url,
      sourceId: url,
    });
  });
  return out;
}

export const maaspoort: Adapter = {
  name: "maaspoort.nl",
  venues: ["maaspoort"],
  async fetch() {
    const byUrl = new Map<string, SourceEvent>();
    // The page count in the HTML (data-ssr-pages) lags behind the real one: read on until a page adds nothing new.
    for (let n = 1; n <= MAX_PAGES; n++) {
      const page = parseMaaspoort((await fetchText(n === 1 ? `${BASE}/programma/` : `${BASE}/programma/?page=${n}`)).body);
      const before = byUrl.size;
      for (const e of page) byUrl.set(e.sourceId, e);
      if (byUrl.size === before) break;
    }
    if (!byUrl.size) throw new Error("Maaspoort: geen voorstellingen gevonden");
    return [...byUrl.values()];
  },
};
