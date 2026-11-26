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

/** As written to agenda.json: no id (the browser numbers the events), acts and source page may be left out (see expandSiteData). */
export type CompactSiteEvent = Omit<SiteEvent, "a" | "p" | "id"> & { a?: string[]; p?: string };
/** `more`: file with the events after the first part (see splitSiteData). */
export type CompactSiteData = Omit<SiteData, "events"> & { events: CompactSiteEvent[]; more?: string };

const STATUS: Record<Event["status"], StatusCode> = { gepland: "", uitverkocht: "u", verplaatst: "v", geannuleerd: "g" };

export function buildSiteData(
  events: Event[],
  venues: Venue[],
  sources: Record<string, { ok: boolean; count: number; lastSuccess?: string; venues: string[] }>,
  generatedAt: string,
): CompactSiteData {
  const used = new Set(events.map((e) => e.venueId));
  return {
    generatedAt,
    baseline: events.reduce((min, e) => (e.firstSeen < min ? e.firstSeen : min), generatedAt.slice(0, 10)),
    venues: venues.map((v) => ({ id: v.id, n: v.name, city: v.city, cc: v.country, tier: v.tier, ...(v.website ? { web: v.website } : {}), ...(!used.has(v.id) && NO_SOURCE[v.id] ? { ns: NO_SOURCE[v.id] } : {}) })),
    events: events
      .filter((e) => e.venueId && used.has(e.venueId))
      .sort((a, b) => a.start.localeCompare(b.start))
      .map((e) => ({
        t: e.title,
        // Left out when the only act is the title itself, and "Concert" is the default kind: see expandSiteData.
        ...(e.artists.length === 1 && e.artists[0].name === e.title ? {} : { a: e.artists.map((x) => x.name) }),
        v: e.venueId!,
        s: toLocalIso(e.start),
        h: e.hasTime ? 1 : 0,
        st: STATUS[e.status],
        c: e.category === "muziek" ? "m" : "o",
        ...(e.genre && e.genre !== "Concert" ? { g: e.genre } : {}),
        ...(e.musicGenres?.length ? { mg: e.musicGenres } : {}),
        ...(e.danceStyles?.length && e.musicGenres?.includes("Dance & DJ") ? { ds: e.danceStyles } : {}),
        u: e.ticketUrl,
        ...(e.sources[0].url !== e.ticketUrl ? { p: e.sources[0].url } : {}),
        f: e.firstSeen,
        ...(e.onSaleStart && e.onSaleStart > generatedAt ? { o: toLocalIso(e.onSaleStart) } : {}),
      })),
    sources: Object.entries(sources)
      .map(([name, s]) => ({ name, ok: s.ok, count: s.count, lastSuccess: s.lastSuccess, venues: s.venues }))
      .sort((a, b) => a.name.localeCompare(b.name)),
  };
}

/**
 * Splits the agenda in two files (B48): the first `days` days (30), which the first screen needs, and the rest, which
 * the browser loads right after. Keeps the first download small on a slow phone connection (Lighthouse LCP).
 */
export function splitSiteData(site: CompactSiteData, moreFile: string, days = 30): { first: CompactSiteData; rest: { events: CompactSiteEvent[] } } {
  const cut = new Date(Date.parse(site.generatedAt) + days * 86_400_000).toISOString().slice(0, 10);
  const near = site.events.filter((e) => e.s.slice(0, 10) < cut);
  const later = site.events.filter((e) => e.s.slice(0, 10) >= cut);
  return { first: { ...site, events: near, ...(later.length ? { more: moreFile } : {}) }, rest: { events: later } };
}

/**
 * The file leaves out what can be filled in again (acts equal to the title, kind "Concert", the source page
 * when it is the ticket link): about a fifth smaller, so phones parse it faster. The browser calls this once.
 */
export function expandSiteData(raw: CompactSiteData, more: CompactSiteEvent[] = []): SiteData {
  return {
    generatedAt: raw.generatedAt,
    baseline: raw.baseline,
    venues: raw.venues,
    sources: raw.sources,
    // Ids are positions: both files are sorted by date, so the first part keeps its ids when the rest is added.
    events: [...raw.events, ...more].map((e, i) => ({ ...e, id: `e${i}`, a: e.a ?? [e.t], g: e.g ?? (e.c === "m" ? "Concert" : undefined), p: e.p ?? e.u })),
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
