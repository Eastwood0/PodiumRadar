import { load } from "cheerio";
import { fetchText } from "../lib/http";
import { normalizeIso, TZ_BY_COUNTRY } from "../lib/dates";
import { statusFrom } from "../lib/normalize";
import type { Adapter, SourceEvent } from "./types";

const BASE = "https://www.hedon-zwolle.nl";

interface HedonEvent {
  id: number;
  title?: string;
  subtitle?: string;
  status?: number;
  venue?: string;
  eventDate?: string;
  ticketsBuyableFrom?: string;
  externalTicketsUrl?: string;
  genres?: { name?: string }[];
  mainAct?: { title?: string; image?: { url?: string | null } };
  supportActs?: { title?: string }[];
}

/** Hedon's status 2 is shown on the site as "Uitverkocht" (checked 26 Nov 2026); other codes are normal sale. */
const SOLD_OUT = 2;

/**
 * Hedon (Zwolle) is an Angular site that ships its programme as transfer state (`ng-state`) with each event's
 * UTC start time, hall, status and genres. Level 1: structured JSON. Shows at other locations ("Extern",
 * Theater De Spiegel) are skipped: they are not at Hedon.
 */
export function parseHedon(html: string): SourceEvent[] {
  const raw = load(html)("script#ng-state").text();
  if (!raw) throw new Error("Hedon: ng-state ontbreekt");
  const found = new Map<number, HedonEvent>();
  const walk = (o: unknown): void => {
    if (Array.isArray(o)) o.forEach(walk);
    else if (o && typeof o === "object") {
      const r = o as Record<string, unknown>;
      if (typeof r.id === "number" && typeof r.title === "string" && typeof r.eventDate === "string") found.set(r.id, r as unknown as HedonEvent);
      Object.values(r).forEach(walk);
    }
  };
  walk(JSON.parse(raw));
  if (!found.size) throw new Error("Hedon: geen events in ng-state");
  const out: SourceEvent[] = [];
  for (const e of found.values()) {
    if (!e.title || !e.eventDate || !/^hedon/i.test(e.venue ?? "")) continue;
    const when = normalizeIso(e.eventDate, TZ_BY_COUNTRY.NL);
    if (!when) continue;
    const slug = e.title.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "");
    const acts = [e.mainAct?.title, ...(e.supportActs ?? []).map((s) => s.title)].filter((x): x is string => !!x?.trim());
    out.push({
      venueId: "hedon",
      title: e.title.trim(),
      artists: acts.length ? acts : undefined,
      start: when.start,
      hasTime: when.hasTime,
      status: e.status === SOLD_OUT ? "uitverkocht" : statusFrom(`${e.title} ${e.subtitle ?? ""}`),
      sourceCategory: e.genres?.map((g) => g.name).filter(Boolean).join(", ") || undefined,
      url: `${BASE}/voorstelling/${e.id}/${slug}`,
      ticketUrl: e.externalTicketsUrl?.startsWith("http") ? e.externalTicketsUrl : undefined,
      sourceId: String(e.id),
      onSaleStart: e.ticketsBuyableFrom && e.ticketsBuyableFrom > new Date().toISOString() ? e.ticketsBuyableFrom : undefined,
    });
  }
  return out;
}

export const hedon: Adapter = {
  name: "hedon-zwolle.nl",
  venues: ["hedon"],
  async fetch() {
    return parseHedon((await fetchText(`${BASE}/`)).body);
  },
};
