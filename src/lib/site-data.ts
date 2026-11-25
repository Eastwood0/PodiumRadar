/**
 * The compact data file the website loads (public/data/agenda.json). Short keys keep it small; the
 * shape is shared by the build script (writer) and the app (reader).
 */
import { NO_SOURCE } from "./no-source";
import type { Event, Venue } from "./schema";

export type StatusCode = "" | "u" | "v" | "g"; // gepland, uitverkocht, verplaatst, geannuleerd

export interface SiteEvent {
  id: string;
  /** Title as the venue writes it. */
  t: string;
  /** Artists. */
  a: string[];
  /** Venue id. */
  v: string;
  /** Start, ISO with offset. */
  s: string;
  /** 1 = start time known. */
  h: 0 | 1;
  st: StatusCode;
  /** m = muziek, o = overig. */
  c: "m" | "o";
  /** Genre label. */
  g?: string;
  /** Ticket link. */
  u: string;
  /** Page at the source. */
  p: string;
  /** First seen (YYYY-MM-DD). */
  f: string;
  /** Presale start (ISO), only if in the future. */
  o?: string;
}

export interface SiteVenue {
  id: string;
  n: string;
  city: string;
  cc: "NL" | "BE" | "DE";
  tier: "A" | "B";
  web?: string;
  /** Why there is no source yet (only for venues without events). */
  ns?: string;
}

export interface SiteSource {
  name: string;
  ok: boolean;
  count: number;
  lastSuccess?: string;
  venues: string[];
}

export interface SiteData {
  generatedAt: string;
  /** Earliest firstSeen in the data: events first seen on this day are the initial import, not "new". */
  baseline: string;
  venues: SiteVenue[];
  events: SiteEvent[];
  sources: SiteSource[];
}

const STATUS: Record<Event["status"], StatusCode> = { gepland: "", uitverkocht: "u", verplaatst: "v", geannuleerd: "g" };

export function buildSiteData(
  events: Event[],
  venues: Venue[],
  sources: Record<string, { ok: boolean; count: number; lastSuccess?: string; venues: string[] }>,
  generatedAt: string,
): SiteData {
  const used = new Set(events.map((e) => e.venueId));
  return {
    generatedAt,
    baseline: events.reduce((min, e) => (e.firstSeen < min ? e.firstSeen : min), generatedAt.slice(0, 10)),
    venues: venues.map((v) => ({ id: v.id, n: v.name, city: v.city, cc: v.country, tier: v.tier, ...(v.website ? { web: v.website } : {}), ...(!used.has(v.id) && NO_SOURCE[v.id] ? { ns: NO_SOURCE[v.id] } : {}) })),
    events: events
      .filter((e) => e.venueId && used.has(e.venueId))
      .map((e) => ({
        id: e.id,
        t: e.title,
        a: e.artists.map((x) => x.name),
        v: e.venueId!,
        s: e.start,
        h: e.hasTime ? 1 : 0,
        st: STATUS[e.status],
        c: e.category === "muziek" ? "m" : "o",
        ...(e.genre ? { g: e.genre } : {}),
        u: e.ticketUrl,
        p: e.sources[0].url,
        f: e.firstSeen,
        ...(e.onSaleStart && e.onSaleStart > generatedAt ? { o: e.onSaleStart } : {}),
      })),
    sources: Object.entries(sources)
      .map(([name, s]) => ({ name, ok: s.ok, count: s.count, lastSuccess: s.lastSuccess, venues: s.venues }))
      .sort((a, b) => a.name.localeCompare(b.name)),
  };
}
