import { z } from "zod";
import { fetchText } from "../lib/http";
import { normalizeIso, TZ_BY_COUNTRY } from "../lib/dates";
import { statusFrom } from "../lib/normalize";
import type { Adapter, SourceEvent } from "./types";

const BASE = "https://www.musisenstadstheater.nl";
const MAX_PAGES = 60;

/**
 * Musis & Stadstheater Arnhem: the agenda page loads its shows from the site's own API (API Platform, JSON-LD
 * collection) `/api/events?startsAt[after]=<date>&page=N`, 10 per page with `view.next`. Each item has the start
 * time with offset, the production (title, performer, slug, tags = genres) and a sold-out flag. Level 1 (B24).
 */
const MusisPage = z.object({
  member: z.array(
    z.object({
      id: z.number(),
      startsAt: z.string(),
      soldOut: z.boolean().optional(),
      production: z.object({
        title: z.string(),
        slug: z.string(),
        performer: z.string().nullish(),
        tags: z.array(z.object({ name: z.string() })).optional(),
      }),
    }),
  ),
  view: z.object({ next: z.string().optional() }).passthrough().optional(),
});

/** Tags that are series or audience labels, not genres. */
const NOT_A_GENRE = /language no problem|gelrepas|cjp|abonnement|serie|uitgelicht|nieuw|laatste kaarten/i;

export function parseMusis(json: string): { events: SourceEvent[]; next?: string } {
  const page = MusisPage.parse(JSON.parse(json));
  const events: SourceEvent[] = [];
  for (const m of page.member) {
    const when = normalizeIso(m.startsAt, TZ_BY_COUNTRY.NL);
    if (!when) continue;
    const title = m.production.title.trim();
    const performer = m.production.performer?.trim();
    const url = `${BASE}/nl/agenda/${m.production.slug}/${m.id}`;
    events.push({
      venueId: "musis-arnhem",
      title: performer && !title.toLowerCase().includes(performer.toLowerCase()) ? `${performer}: ${title}` : title,
      artists: [performer || title],
      start: when.start,
      hasTime: when.hasTime,
      status: m.soldOut ? "uitverkocht" : (statusFrom(title) ?? "gepland"),
      sourceCategory: (m.production.tags ?? []).map((t) => t.name).filter((n) => !NOT_A_GENRE.test(n)).join(", ") || undefined,
      url,
      sourceId: `musis-${m.id}`,
    });
  }
  return { events, next: page.view?.next };
}

export const musis: Adapter = {
  name: "musisenstadstheater.nl",
  venues: ["musis-arnhem"],
  async fetch() {
    const today = new Date().toISOString().slice(0, 10);
    let path: string | undefined = `/api/events?startsAt%5Bafter%5D=${today}&page=1`;
    const out: SourceEvent[] = [];
    for (let n = 0; path && n < MAX_PAGES; n++) {
      const page = parseMusis((await fetchText(BASE + path, "application/ld+json, application/json")).body);
      out.push(...page.events);
      path = page.next;
    }
    if (!out.length) throw new Error("Musis: geen voorstellingen gevonden");
    return out;
  },
};
