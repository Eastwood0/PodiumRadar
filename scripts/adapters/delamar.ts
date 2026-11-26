import { load } from "cheerio";
import { fetchText } from "../lib/http";
import { localToIso, TZ_BY_COUNTRY } from "../lib/dates";
import { statusFrom } from "../lib/normalize";
import { sitemapUrls } from "./sitemap-jsonld";
import type { Adapter, SourceEvent } from "./types";

/**
 * DeLaMar (Amsterdam): the sitemap lists every production (`/voorstellingen/<slug>/`). A production page has the
 * genre (`.genres .genre`), the title (h1) and subtitle, and one `.production__date[data-date]` per performance
 * with the start time and a ticket button ("Koop tickets", "Laatste tickets", "Uitverkocht"). Its JSON-LD only
 * holds the first and last day of a run, so the HTML is read. Level 3.
 */
export function parseDelamar(html: string, pageUrl: string): SourceEvent[] {
  const $ = load(html);
  const title = $(".production__title h1").first().text().trim();
  if (!title) return [];
  const subtitle = $(".production__title h1").first().next("p").text().trim();
  const genre = $(".production__title .genres .genre").map((_, g) => $(g).text().trim()).get().filter(Boolean).join(", ");
  const out: SourceEvent[] = [];
  const seen = new Set<string>();
  $(".production__dates .production__date[data-date]").each((_, el) => {
    const row = $(el);
    const d = row.attr("data-date")?.match(/^(\d{4})-(\d{2})-(\d{2})$/);
    if (!d) return;
    const time = row.find("div").first().text().match(/\b(\d{1,2}:\d{2})\b/)?.[1];
    const when = localToIso(Number(d[1]), Number(d[2]), Number(d[3]), time, TZ_BY_COUNTRY.NL);
    if (seen.has(when.start)) return;
    seen.add(when.start);
    const ticket = row.find("a[href]").attr("href");
    out.push({
      venueId: "delamar",
      title: subtitle ? `${title}: ${subtitle}` : title,
      artists: [title],
      start: when.start,
      hasTime: when.hasTime,
      status: statusFrom(row.text()) ?? "gepland",
      sourceCategory: genre || undefined,
      url: pageUrl,
      ticketUrl: ticket?.startsWith("https://") ? ticket : undefined,
      sourceId: `${pageUrl}|${when.start}`,
    });
  });
  return out;
}

export const delamar: Adapter = {
  name: "delamar.nl",
  venues: ["delamar"],
  async fetch() {
    const urls = await sitemapUrls({
      venueId: "delamar",
      country: "NL",
      sitemap: "https://delamar.nl/sitemap.xml",
      childPattern: /./,
      pagePattern: /^https:\/\/delamar\.nl\/voorstellingen\/[^/?#]+\/$/,
    });
    const out: SourceEvent[] = [];
    let failed = 0;
    for (const u of urls) {
      try {
        out.push(...parseDelamar((await fetchText(u)).body, u));
      } catch (e) {
        failed++;
        console.warn(`delamar.nl: ${u} overgeslagen (${String(e)})`);
      }
    }
    if (failed > urls.length / 2) throw new Error(`delamar.nl: ${failed} van ${urls.length} pagina's mislukt`);
    if (!out.length) throw new Error("delamar.nl: geen voorstellingen gevonden");
    return out;
  },
};
