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
  /** Kind of event: "Concert", "Comedy", "Sport"… */
  g?: string;
  /** Music genres (max 2), e.g. ["Rock"] (B31). */
  mg?: string[];
  /** Dance styles (max 2), e.g. ["Techno"]. */
  ds?: string[];
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
        s: toLocalIso(e.start),
        h: e.hasTime ? 1 : 0,
        st: STATUS[e.status],
        c: e.category === "muziek" ? "m" : "o",
        ...(e.genre ? { g: e.genre } : {}),
        ...(e.musicGenres?.length ? { mg: e.musicGenres } : {}),
        ...(e.danceStyles?.length && e.musicGenres?.includes("Dance & DJ") ? { ds: e.danceStyles } : {}),
        u: e.ticketUrl,
        p: e.sources[0].url,
        f: e.firstSeen,
        ...(e.onSaleStart && e.onSaleStart > generatedAt ? { o: toLocalIso(e.onSaleStart) } : {}),
      })),
    sources: Object.entries(sources)
      .map(([name, s]) => ({ name, ok: s.ok, count: s.count, lastSuccess: s.lastSuccess, venues: s.venues }))
      .sort((a, b) => a.name.localeCompare(b.name)),
  };
}

let localFmt: Intl.DateTimeFormat | undefined;
/**
 * Rewrites any ISO instant as Amsterdam wall-clock time with its offset ("2027-08-01T00:30:00+02:00").
 * All venues share that time zone, so the browser can read day and month straight from the string
 * instead of running a date formatter for 1.500+ events (keeps the first screen fast on phones).
 */
export function toLocalIso(iso: string): string {
  localFmt ??= new Intl.DateTimeFormat("en-GB", { timeZone: "Europe/Amsterdam", year: "numeric", month: "2-digit", day: "2-digit", hour: "2-digit", minute: "2-digit", second: "2-digit", hourCycle: "h23", timeZoneName: "longOffset" });
  const p = Object.fromEntries(localFmt.formatToParts(new Date(iso)).map((x) => [x.type, x.value]));
  const offset = p.timeZoneName === "GMT" ? "+00:00" : p.timeZoneName.replace("GMT", "");
  return `${p.year}-${p.month}-${p.day}T${p.hour}:${p.minute}:${p.second}${offset}`;
}
