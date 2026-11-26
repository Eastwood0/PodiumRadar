import { z } from "zod";
import { fetchText } from "../lib/http";
import { normalizeIso, TZ_BY_COUNTRY } from "../lib/dates";
import { sitemapUrls } from "./sitemap-jsonld";
import type { Adapter, SourceEvent } from "./types";

/**
 * Koninklijk Theater Carré (Amsterdam): the site is a JavaScript app that loads each page as JSON from
 * `/api/render/<path>` (robots.txt allows it). The sitemap lists every production (`/voorstelling/<slug>`);
 * its JSON holds the heading, the genre ids and all performances with start time and sales status. Level 1 (B24).
 */
const CarreProduction = z.object({
  node: z.object({
    data: z.object({ heading: z.string().nullish(), title: z.string().nullish() }).passthrough(),
    filters: z.object({ genres: z.array(z.string()).optional() }).passthrough().optional(),
  }).passthrough(),
  filters: z.object({ genres: z.object({ values: z.array(z.object({ id: z.string(), data: z.object({ name: z.string() }) })) }).optional() }).passthrough().optional(),
  productions: z.record(z.string(), z.object({
    events: z.array(z.object({
      id: z.union([z.number(), z.string()]),
      start_date: z.string(),
      sales_status: z.string().nullish(),
      venue_id: z.union([z.number(), z.string()]).nullish(),
      data: z.object({ eventtype: z.string().nullish() }).passthrough().optional(),
    })),
  })).optional(),
  venues: z.record(z.string(), z.object({ data: z.object({ name: z.string() }).passthrough() })).optional(),
});

function statusOf(sales: string | null | undefined): SourceEvent["status"] {
  if (!sales) return "gepland";
  if (/cancel/i.test(sales)) return "geannuleerd";
  if (/sold_?out/i.test(sales)) return "uitverkocht";
  return "gepland";
}

export function parseCarre(json: string, pageUrl: string): SourceEvent[] {
  const page = CarreProduction.parse(JSON.parse(json));
  const title = (page.node.data.heading ?? page.node.data.title ?? "").trim();
  if (!title) return [];
  const genreNames = new Map((page.filters?.genres?.values ?? []).map((g) => [g.id, g.data.name]));
  const genre = (page.node.filters?.genres ?? []).map((id) => genreNames.get(id) ?? id.replace(/_/g, " ")).join(", ");
  const out: SourceEvent[] = [];
  for (const prod of Object.values(page.productions ?? {})) {
    for (const e of prod.events) {
      const venue = e.venue_id != null ? page.venues?.[String(e.venue_id)]?.data.name : undefined;
      if (venue && !/carr[ée]/i.test(venue)) continue;
      if (e.data?.eventtype && !/voorstelling|concert/i.test(e.data.eventtype)) continue;
      const when = normalizeIso(e.start_date, TZ_BY_COUNTRY.NL);
      if (!when) continue;
      out.push({
        venueId: "carre",
        title,
        artists: [title],
        start: when.start,
        hasTime: when.hasTime,
        status: statusOf(e.sales_status),
        sourceCategory: genre || undefined,
        url: pageUrl,
        sourceId: `carre-${e.id}`,
      });
    }
  }
  return out;
}

export const carre: Adapter = {
  name: "carre.nl",
  venues: ["carre"],
  async fetch() {
    const urls = await sitemapUrls({
      venueId: "carre",
      country: "NL",
      sitemap: "https://carre.nl/sitemap.xml",
      childPattern: /./,
      pagePattern: /^https:\/\/carre\.nl\/voorstelling\/[^/?#]+$/,
    });
    const out: SourceEvent[] = [];
    let failed = 0;
    for (const u of urls) {
      try {
        const slug = new URL(u).pathname;
        out.push(...parseCarre((await fetchText(`https://carre.nl/api/render${slug}`, "application/json")).body, u));
      } catch (e) {
        failed++;
        console.warn(`carre.nl: ${u} overgeslagen (${String(e)})`);
      }
    }
    if (failed > urls.length / 2) throw new Error(`carre.nl: ${failed} van ${urls.length} producties mislukt`);
    if (!out.length) throw new Error("carre.nl: geen voorstellingen gevonden");
    return out;
  },
};
