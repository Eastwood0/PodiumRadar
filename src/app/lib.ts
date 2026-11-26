/** Helpers for the website: formatting, slugs, routes and "new" labels. Pure functions, unit-tested. */
import type { SiteData, SiteEvent, SiteVenue } from "../lib/site-data";

export const TZ = "Europe/Amsterdam";
const DAYS = ["zo", "ma", "di", "wo", "do", "vr", "za"];
const MONTHS = ["jan", "feb", "mrt", "apr", "mei", "jun", "jul", "aug", "sep", "okt", "nov", "dec"];
export const MONTHS_LONG = ["januari", "februari", "maart", "april", "mei", "juni", "juli", "augustus", "september", "oktober", "november", "december"];

type Parts = { y: number; m: number; d: number; wd: number; hh: string; mm: string };
const WEEKDAYS = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];
let fmt: Intl.DateTimeFormat | undefined; // creating a formatter is slow; one is enough
const cache = new Map<string, Parts>();

/** Local wall-clock parts of an ISO instant in Amsterdam time (cached: the same dates are formatted often). */
export function parts(iso: string): Parts {
  const hit = cache.get(iso);
  if (hit) return hit;
  // Site data is already in Amsterdam time ("…+01:00", see toLocalIso): read it from the string.
  const m = /^(\d{4})-(\d\d)-(\d\d)T(\d\d):(\d\d)(?::\d\d)?(?:\.\d+)?\+0[12]:00$/.exec(iso);
  if (m) {
    const [y, mo, d] = [+m[1], +m[2], +m[3]];
    const out = { y, m: mo, d, wd: new Date(Date.UTC(y, mo - 1, d)).getUTCDay(), hh: m[4], mm: m[5] };
    cache.set(iso, out);
    return out;
  }
  fmt ??= new Intl.DateTimeFormat("en-GB", { timeZone: TZ, year: "numeric", month: "2-digit", day: "2-digit", weekday: "short", hour: "2-digit", minute: "2-digit", hourCycle: "h23" });
  const p = fmt.formatToParts(new Date(iso));
  const g = (t: string) => p.find((x) => x.type === t)?.value ?? "";
  const out = { y: +g("year"), m: +g("month"), d: +g("day"), wd: WEEKDAYS.indexOf(g("weekday")), hh: g("hour"), mm: g("minute") };
  cache.set(iso, out);
  return out;
}

/** "za 13 mrt 2027" */
export function formatDate(iso: string): string {
  const p = parts(iso);
  return `${DAYS[p.wd]} ${p.d} ${MONTHS[p.m - 1]} ${p.y}`;
}
/** "wo 25 nov 2026, 21:01" */
export const formatDateTime = (iso: string) => `${formatDate(iso)}, ${formatTime(iso)}`;
export const dayName = (iso: string) => DAYS[parts(iso).wd];
export const monthShort = (m: number) => MONTHS[m - 1];
export const formatTime = (iso: string) => {
  const p = parts(iso);
  return `${p.hh}:${p.mm}`;
};
/** "YYYY-MM" in Amsterdam time. */
export const monthKey = (iso: string) => {
  const p = parts(iso);
  return `${p.y}-${String(p.m).padStart(2, "0")}`;
};

/** The 12 months shown, starting with the month of `fromIso`. */
export function monthsFrom(fromIso: string, count = 12): string[] {
  const p = parts(fromIso);
  return Array.from({ length: count }, (_, i) => {
    const m = ((p.m - 1 + i) % 12) + 1;
    const y = p.y + Math.floor((p.m - 1 + i) / 12);
    return `${y}-${String(m).padStart(2, "0")}`;
  });
}

/** URL-safe name: "Thirty Seconds to Mars" → "thirty-seconds-to-mars". */
export function slug(s: string): string {
  return s
    .toLowerCase()
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .replace(/&/g, " en ")
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 80) || "x";
}

export type Route =
  | { view: "overzicht" }
  | { view: "agenda" }
  | { view: "bronnen" }
  | { view: "artiest"; slug: string }
  | { view: "zaal"; id: string };

/** Routes are plain "#name" fragments (letters, digits, hyphens) so links work everywhere, also in previews. */
export function parseRoute(hash: string): Route {
  const h = decodeURIComponent(hash.replace(/^#/, ""));
  if (h.startsWith("artiest-") && h.length > 8) return { view: "artiest", slug: h.slice(8) };
  if (h.startsWith("zaal-") && h.length > 5) return { view: "zaal", id: h.slice(5) };
  if (h === "agenda" || h === "bronnen") return { view: h };
  return { view: "overzicht" };
}
export const artistHref = (name: string) => `#artiest-${slug(name)}`;
export const venueHref = (id: string) => `#zaal-${id}`;

/** "Nieuw": first seen in the last 7 days, but not part of the very first import. */
export function isNew(e: SiteEvent, data: Pick<SiteData, "generatedAt" | "baseline">): boolean {
  if (e.f <= data.baseline) return false;
  const age = (Date.parse(data.generatedAt) - Date.parse(e.f + "T00:00:00Z")) / 86_400_000;
  return age <= 7;
}

/** Hours since the last update; the site warns above 36 (bouwplan §9). */
export const hoursOld = (generatedAt: string, now = Date.now()) => (now - Date.parse(generatedAt)) / 3_600_000;

/** Fixed classes instead of a sliding scale, so the numbers stay readable on every shade. */
export const LEVELS = [
  { min: 1, label: "1" },
  { min: 2, label: "2–3" },
  { min: 4, label: "4–6" },
  { min: 7, label: "7–10" },
  { min: 11, label: "11+" },
];
export const level = (n: number) => LEVELS.findLastIndex((l) => n >= l.min) + 1;

export interface Filters {
  country: "" | "NL" | "BE" | "DE";
  tier: "" | "A" | "B";
  venue: string;
  month: string;
  all: boolean;
  /** Music genres; empty = all. An event matches when it has one of them. */
  genres: string[];
}
export const DEFAULT_FILTERS: Filters = { country: "", tier: "", venue: "", month: "", all: false, genres: [] };

export function applyFilters(events: SiteEvent[], venues: Map<string, SiteVenue>, f: Filters): SiteEvent[] {
  return events.filter((e) => {
    const v = venues.get(e.v);
    if (!v) return false;
    if (!f.all && e.c !== "m") return false;
    if (f.country && v.cc !== f.country) return false;
    if (f.tier && v.tier !== f.tier) return false;
    if (f.venue && e.v !== f.venue) return false;
    if (f.month && monthKey(e.s) !== f.month) return false;
    if (f.genres.length && !e.mg?.some((g) => f.genres.includes(g))) return false;
    return true;
  });
}

export interface ArtistEntry {
  name: string;
  slug: string;
  count: number;
  next: string;
}

/** One entry per artist (by slug), with number of shows and the next date. */
export function artistIndex(events: SiteEvent[]): ArtistEntry[] {
  const map = new Map<string, ArtistEntry>();
  for (const e of events) {
    for (const name of e.a) {
      const s = slug(name);
      const cur = map.get(s);
      if (!cur) map.set(s, { name, slug: s, count: 1, next: e.s });
      else {
        cur.count++;
        if (e.s < cur.next) cur.next = e.s;
      }
    }
  }
  return [...map.values()];
}

export interface BillEntry {
  name: string;
  nights: number;
  /** First show in the period. */
  s: string;
  venue: SiteVenue;
}
export interface Bill {
  from: string;
  to: string;
  headliners: BillEntry[];
  support: BillEntry[];
  club: BillEntry[];
  total: number;
}

/**
 * The opening "poster" of the overview: music in the next `days` days, one line per headlining act.
 * Like a festival bill the order says something: big venues on top, acts with the most nights first,
 * then the rest of the big venues, then the mid-size venues.
 */
export function bill(events: SiteEvent[], venues: Map<string, SiteVenue>, fromIso: string, days = 30): Bill {
  const from = fromIso.slice(0, 10);
  const to = new Date(Date.parse(from) + days * 86_400_000).toISOString().slice(0, 10);
  const inRange = events.filter((e) => e.c === "m" && e.st !== "g" && e.s.slice(0, 10) >= from && e.s.slice(0, 10) < to && venues.has(e.v));
  const byAct = new Map<string, BillEntry>();
  for (const e of inRange) {
    const key = `${slug(e.a[0] ?? e.t)}|${e.v}`;
    const cur = byAct.get(key);
    if (cur) cur.nights++;
    else byAct.set(key, { name: e.a[0] ?? e.t, nights: 1, s: e.s, venue: venues.get(e.v)! });
  }
  const seen = new Set<string>();
  const unique = [...byAct.values()].sort((a, b) => b.nights - a.nights || a.s.localeCompare(b.s)).filter((b) => {
    const k = slug(b.name);
    if (seen.has(k)) return false;
    seen.add(k);
    return true;
  });
  const big = unique.filter((b) => b.venue.tier === "A").sort((a, b) => b.nights - a.nights || a.s.localeCompare(b.s));
  const mid = unique.filter((b) => b.venue.tier === "B").sort((a, b) => a.s.localeCompare(b.s));
  const headliners = big.slice(0, 6);
  const support = big.slice(6, 24).sort((a, b) => a.s.localeCompare(b.s));
  return { from, to, headliners, support, club: mid.slice(0, 24), total: inRange.length };
}

/** Reads a stored value; storage can be missing or blocked, so failures fall back silently. */
export function load<T>(key: string, fallback: T): T {
  try {
    const raw = localStorage.getItem(key);
    return raw ? { ...fallback, ...JSON.parse(raw) } : fallback;
  } catch {
    return fallback;
  }
}
export function save(key: string, value: unknown): void {
  try {
    localStorage.setItem(key, JSON.stringify(value));
  } catch {
    /* storage unavailable: filters are simply not remembered */
  }
}
