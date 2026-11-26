import { load } from "cheerio";
import { fetchText } from "../lib/http";
import { normalizeIso, TZ_BY_COUNTRY } from "../lib/dates";
import type { Adapter, SourceEvent } from "./types";

const BASE = "https://www.melkweg.nl";
const AGENDA = `${BASE}/nl/agenda/`;

interface MelkwegEvent {
  id: string;
  attributes: {
    name?: string;
    startDate?: string;
    url?: string;
    profile?: string;
    tags?: string[];
    isSoldOut?: boolean;
    isCancelled?: boolean;
    isMovedToNewDate?: boolean;
    isPrivateEvent?: boolean;
    media?: { featuredImage?: { filename?: string }[] };
  };
}

/**
 * Melkweg's agenda page embeds every upcoming event (about a year ahead) in its Next.js page data,
 * with the kind of night ("Concert", "Clubnacht") and genre tags. Level 1: structured JSON.
 */
export function parseMelkweg(html: string): SourceEvent[] {
  const raw = load(html)("#__NEXT_DATA__").text();
  // Melkweg sometimes answers with a bot check (HTTP 202, no page data). Not bypassed (B23): previous data stays.
  if (!raw) throw new Error("Melkweg: page data ontbreekt (mogelijk botcontrole van de site)");
  const content: { attributes?: { initialEvents?: MelkwegEvent[] } }[] = JSON.parse(raw)?.props?.pageProps?.pageData?.attributes?.content ?? [];
  const list = content.find((c) => Array.isArray(c.attributes?.initialEvents))?.attributes?.initialEvents;
  if (!list) throw new Error("Melkweg: eventlijst niet gevonden in page data");
  const out: SourceEvent[] = [];
  for (const { id, attributes: a } of list) {
    if (!a.name || !a.startDate || !a.url || a.isPrivateEvent) continue;
    const when = normalizeIso(a.startDate, TZ_BY_COUNTRY.NL);
    if (!when) continue;
    out.push({
      venueId: "melkweg",
      title: a.name.trim(),
      start: when.start,
      hasTime: when.hasTime,
      status: a.isCancelled ? "geannuleerd" : a.isMovedToNewDate ? "verplaatst" : a.isSoldOut ? "uitverkocht" : "gepland",
      sourceCategory: [a.profile, ...(a.tags ?? [])].filter(Boolean).join(", "),
      url: new URL(a.url, BASE).href,
      sourceId: id,
      imageUrl: a.media?.featuredImage?.[0]?.filename,
    });
  }
  return out;
}

/** Melkweg's firewall (AWS WAF) sometimes answers with a JavaScript challenge page instead of the agenda. */
export const isBotCheck = (html: string) => /awsWafCookieDomainList|gokuProps/.test(html);

/** We never run or solve the challenge (B23); we only ask again later, as a visitor would. */
const RETRY_WAIT_MS = [120_000, 420_000];
const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));

export const melkweg: Adapter = {
  name: "melkweg.nl",
  venues: ["melkweg"],
  async fetch() {
    for (let attempt = 0; ; attempt++) {
      const html = (await fetchText(AGENDA)).body;
      if (!isBotCheck(html)) return parseMelkweg(html);
      if (attempt >= RETRY_WAIT_MS.length) throw new Error("Melkweg: de site toont een botcontrole (AWS WAF); niet omzeild, vorige data blijft staan");
      await sleep(RETRY_WAIT_MS[attempt]);
    }
  },
};
