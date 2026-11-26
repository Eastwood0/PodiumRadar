import { load } from "cheerio";
import { fetchText } from "../lib/http";
import { normalizeIso, TZ_BY_COUNTRY } from "../lib/dates";
import { extractJsonLdEvents } from "../lib/jsonld";
import { jsonLdPageAdapter } from "./jsonld-page";
import { fromJsonLd } from "./sitemap-jsonld";
import type { Adapter, SourceEvent } from "./types";

/**
 * Clubs for the DJ calendar (B49, route A: the clubs' own sites; route B: an organiser feed). Every club event gets
 * the source label "clubnacht", so it counts as Dance & DJ unless the title says otherwise. Checked 26 Nov 2026
 * (robots.txt allows the agenda paths; see docs/BRONNEN.md).
 */
const CLUB = "clubnacht";

/** Lofi (Amsterdam): the events page carries every night as JSON-LD (date only, no start time). */
export const lofi = jsonLdPageAdapter("lofi.amsterdam", { venueId: "lofi", country: "NL", url: "https://lofi.amsterdam/events/", category: CLUB });

/** BASIS (Utrecht): the events page carries every night as JSON-LD with start time and offset. */
export const basis = jsonLdPageAdapter("clubbasis.nl", { venueId: "basis-utrecht", country: "NL", url: "https://clubbasis.nl/events/", category: CLUB });

/**
 * Garage Noord (Amsterdam): its ticket shop (WeTicket) publishes an RSS feed of upcoming events, linked from the
 * organiser page; `ev:startdate` is UTC. robots.txt of api.weticket.io sets no restrictions. Level 1, route B.
 */
export function parseWeTicketFeed(xml: string, venueId: string): SourceEvent[] {
  const $ = load(xml, { xml: true });
  const out: SourceEvent[] = [];
  $("item").each((_, el) => {
    const item = $(el);
    const title = item.children("title").text().trim();
    const link = item.children("link").text().trim();
    const start = item.find("ev\\:startdate").first().text().trim();
    const when = start ? normalizeIso(start, TZ_BY_COUNTRY.NL) : undefined;
    if (!title || !link.startsWith("https://") || !when) return;
    out.push({ venueId, title, start: when.start, hasTime: when.hasTime, sourceCategory: CLUB, url: link, sourceId: item.children("guid").text().trim() || link });
  });
  if (!out.length) throw new Error(`${venueId}: geen events in de feed`);
  return out;
}

export const garageNoord: Adapter = {
  name: "garagenoord (WeTicket)",
  venues: ["garage-noord"],
  async fetch() {
    const feed = "https://api.weticket.io/storefront/organizations/66e9ee18-9ff4-49b2-8c2b-a082710dd5e2/events.xml";
    return parseWeTicketFeed((await fetchText(feed, "application/rss+xml, application/xml")).body, "garage-noord");
  },
};

/** Links to event pages on an agenda page, matching `pattern`, without duplicates. */
export function agendaLinks(html: string, base: string, pattern: RegExp): string[] {
  const $ = load(html);
  const urls = $("a[href]")
    .map((_, a) => new URL($(a).attr("href")!, base).href)
    .get()
    .filter((u) => pattern.test(u));
  return [...new Set(urls)];
}

/** Agenda page → every event page → its JSON-LD (one request per event page, max 1 per second). */
function agendaJsonLdAdapter(name: string, venueId: string, agenda: string, pattern: RegExp): Adapter {
  return {
    name,
    venues: [venueId],
    async fetch() {
      const urls = agendaLinks((await fetchText(agenda)).body, agenda, pattern).slice(0, 80);
      const out: SourceEvent[] = [];
      let failed = 0;
      for (const u of urls) {
        try {
          for (const e of extractJsonLdEvents((await fetchText(u)).body).events) {
            const ev = fromJsonLd(e, u, venueId, "NL");
            if (ev) out.push({ ...ev, sourceCategory: CLUB, sourceId: `${u}|${ev.start}` });
          }
        } catch (e) {
          failed++;
          console.warn(`${name}: ${u} overgeslagen (${String(e)})`);
        }
      }
      if (failed > urls.length / 2) throw new Error(`${name}: ${failed} van ${urls.length} pagina's mislukt`);
      if (!out.length) throw new Error(`${name}: geen events gevonden`);
      return out;
    },
  };
}

/** Complex (Maastricht): the agenda lists every night; each event page carries JSON-LD with start time. */
export const complex = agendaJsonLdAdapter("complexmaastricht.nl", "complex-maastricht", "https://complexmaastricht.nl/agenda", /^https:\/\/complexmaastricht\.nl\/agenda\/(?!archive)[^/?#]+$/);
