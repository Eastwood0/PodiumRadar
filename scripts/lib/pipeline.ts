import { EventSchema, type Event, type Venue } from "../../src/lib/schema";
import type { SourceEvent } from "../adapters/types";
import { localDate, TZ_BY_COUNTRY } from "./dates";
import { classify } from "./categorize";
import { eventGenres } from "./music-genre";
import { artistsFromTitle, decodeEntities, eventId, tokenSetSimilarity } from "./normalize";

export const HORIZON_DAYS = 365;
export const SAME_EVENT_SIMILARITY = 0.85; // bouwplan §7
export const OUTAGE_RATIO = 0.5; // bouwplan §11 fase 1: < 50% of previous = outage
export const OUTAGE_MIN_PREVIOUS = 4;

export interface SourceStatus {
  ok: boolean;
  outage?: boolean;
  count: number;
  previousCount?: number;
  lastSuccess?: string;
  error?: string;
  venues: string[];
  dropped?: number;
}

/** Converts one adapter's raw events to validated Events. Invalid rows are counted, not thrown. */
export function toEvents(raw: SourceEvent[], sourceName: string, venues: Map<string, Venue>, today: string): { events: Event[]; dropped: number; guesses: string[] } {
  const events: Event[] = [];
  const guesses: string[] = [];
  let dropped = 0;
  const until = new Date(Date.parse(today) + HORIZON_DAYS * 86_400_000).toISOString().slice(0, 10);
  for (const r of raw) {
    const s = { ...r, title: decodeEntities(r.title).trim(), artists: r.artists?.map((a) => decodeEntities(a).trim()) };
    const venue = venues.get(s.venueId);
    if (!venue) {
      dropped++;
      continue;
    }
    const tz = TZ_BY_COUNTRY[venue.country];
    const day = localDate(s.start, tz);
    const kind = classify(s.title, s.sourceCategory);
    if (day < today || day > until) continue; // outside scope, not an error
    const candidate = {
      id: eventId(venue.id, day, s.title),
      title: s.title,
      artists: (s.artists?.length ? s.artists : artistsFromTitle(s.title)).map((name) => ({ name })),
      venueId: venue.id,
      venueName: venue.name,
      city: venue.city,
      country: venue.country,
      start: s.start,
      hasTime: s.hasTime,
      status: s.status ?? "gepland",
      onSaleStart: s.onSaleStart,
      category: kind.category,
      genre: kind.genre,
      musicGenres: kind.category === "muziek" ? nonEmpty(eventGenres(s.title, s.sourceCategory, kind.genre)) : undefined,
      ticketUrl: s.ticketUrl ?? s.url,
      imageUrl: s.imageUrl?.startsWith("http") ? s.imageUrl : undefined,
      sources: [{ name: sourceName, sourceId: s.sourceId, url: s.url }],
      firstSeen: today,
      lastSeen: today,
    };
    const parsed = EventSchema.safeParse(candidate);
    if (parsed.success) {
      events.push(parsed.data);
      if (kind.reason === "gok") guesses.push(s.title);
    } else dropped++;
  }
  return { events, dropped, guesses: [...new Set(guesses)] };
}

const nonEmpty = <T,>(xs: T[]) => (xs.length ? xs : undefined);

const dayOf = (e: Event) => localDate(e.start, TZ_BY_COUNTRY[e.country] ?? "Europe/Amsterdam");

/**
 * Merges events that are the same show: same venue, same local day, similar title (≥ 0.85).
 * The first event wins title and time; later ones only fill gaps. Sources are combined.
 */
export function dedupe(events: Event[]): Event[] {
  const out: Event[] = [];
  const byKey = new Map<string, Event[]>();
  for (const e of events) {
    const key = `${e.venueId ?? e.venueName}|${dayOf(e)}`;
    const bucket = byKey.get(key) ?? [];
    const same = bucket.find((x) => tokenSetSimilarity(x.title, e.title) >= SAME_EVENT_SIMILARITY);
    if (!same) {
      const copy = { ...e, sources: [...e.sources] };
      bucket.push(copy);
      byKey.set(key, bucket);
      out.push(copy);
      continue;
    }
    for (const s of e.sources) if (!same.sources.some((x) => x.name === s.name && x.sourceId === s.sourceId)) same.sources.push(s);
    if (!same.hasTime && e.hasTime) Object.assign(same, { start: e.start, hasTime: true });
    if (same.status === "gepland" && e.status !== "gepland") same.status = e.status;
    same.onSaleStart ??= e.onSaleStart;
    same.imageUrl ??= e.imageUrl;
    same.musicGenres ??= e.musicGenres;
  }
  return out;
}

/** Keeps firstSeen from the previous run so "Nieuw" labels stay correct. */
export function carryFirstSeen(events: Event[], previous: Event[]): Event[] {
  const prev = new Map(previous.map((e) => [e.id, e.firstSeen]));
  return events.map((e) => ({ ...e, firstSeen: prev.get(e.id) ?? e.firstSeen }));
}

/** True when a source suddenly returns far fewer events than last time (treated as an outage). */
export function isOutage(count: number, previousCount: number | undefined): boolean {
  return previousCount !== undefined && previousCount >= OUTAGE_MIN_PREVIOUS && count < previousCount * OUTAGE_RATIO;
}

export function sortEvents(events: Event[]): Event[] {
  return [...events].sort((a, b) => a.start.localeCompare(b.start) || a.title.localeCompare(b.title));
}
