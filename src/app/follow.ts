/**
 * Followed artists (phase 3, B39/B42). They live in this browser (localStorage); a link code copies them to
 * another device through /api/sync. An artist is matched on the slug of the name, so "Golden Earring" does not
 * match "Golden Earring Tribute".
 */
import { useSyncExternalStore } from "react";
import type { SiteEvent } from "../lib/site-data";
import { slug } from "./lib";

export const MAX_FOLLOWS = 100;
const KEY = "pr.follow";

export interface FollowState {
  /** Display names, in the order they were followed. */
  artists: string[];
  /** Link code, when this list is linked to the server (B42). */
  code?: string;
  /** Day of the agenda data ("YYYY-MM-DD" of its generatedAt) seen at the previous visit to Mijn radar (B44). */
  lastVisit?: string;
  /** A local change that the server has not confirmed yet; kept across reloads until it is sent. */
  pending?: boolean;
  /** Raised on every local change, so a slower server answer never overwrites a newer tap. */
  rev?: number;
}

const EMPTY: FollowState = { artists: [] };

function read(): FollowState {
  try {
    const raw = localStorage.getItem(KEY);
    if (!raw) return EMPTY;
    const v = JSON.parse(raw) as Partial<FollowState>;
    return {
      artists: Array.isArray(v.artists) ? v.artists.filter((a): a is string => typeof a === "string").slice(0, MAX_FOLLOWS) : [],
      code: typeof v.code === "string" ? v.code : undefined,
      lastVisit: typeof v.lastVisit === "string" ? v.lastVisit : undefined,
      pending: v.pending === true,
      rev: typeof v.rev === "number" ? v.rev : 0,
    };
  } catch {
    return EMPTY; // storage blocked or broken: start empty, following still works for this visit
  }
}

let state: FollowState | null = null;
const listeners = new Set<() => void>();
let onChange: ((s: FollowState) => void) | undefined;

export function getFollowState(): FollowState {
  state ??= typeof localStorage === "undefined" ? EMPTY : read();
  return state;
}

/** `notifyServer`: a change by the user (marked pending and pushed when linked); false for server answers and visits. */
export function setFollowState(next: FollowState, notifyServer = true): void {
  if (notifyServer) next = { ...next, rev: (next.rev ?? 0) + 1, pending: !!next.code };
  state = next;
  try {
    localStorage.setItem(KEY, JSON.stringify(next));
  } catch {
    // not remembered after a reload, but the screen still updates
  }
  listeners.forEach((l) => l());
  if (notifyServer) onChange?.(next);
}

/** Called after every local change to the list (used to push it to the server when linked). */
export function onFollowChange(fn: (s: FollowState) => void): void {
  onChange = fn;
}

function subscribe(l: () => void) {
  listeners.add(l);
  const onStorage = (ev: StorageEvent) => {
    if (ev.key === KEY) {
      state = read();
      l();
    }
  };
  window.addEventListener("storage", onStorage); // another tab changed the list
  return () => {
    listeners.delete(l);
    window.removeEventListener("storage", onStorage);
  };
}

export const useFollows = () => useSyncExternalStore(subscribe, getFollowState, () => EMPTY);

export const isFollowed = (s: FollowState, name: string) => s.artists.some((a) => slug(a) === slug(name));

/** Adds or removes one artist. Returns the new state; adding beyond MAX_FOLLOWS is refused (state unchanged). */
export function toggled(s: FollowState, name: string): FollowState {
  const n = name.trim();
  if (!n) return s;
  if (isFollowed(s, n)) return { ...s, artists: s.artists.filter((a) => slug(a) !== slug(n)) };
  if (s.artists.length >= MAX_FOLLOWS) return s;
  return { ...s, artists: [...s.artists, n] };
}

/** Union of two lists (own order first), one entry per slug, capped at MAX_FOLLOWS. */
export function mergeArtists(own: string[], other: string[]): string[] {
  const seen = new Set<string>();
  const out: string[] = [];
  for (const a of [...own, ...other]) {
    const k = slug(a);
    if (seen.has(k) || out.length >= MAX_FOLLOWS) continue;
    seen.add(k);
    out.push(a);
  }
  return out;
}

/** Upcoming shows of the followed artists, by date. */
export function radarEvents(events: SiteEvent[], artists: string[]): SiteEvent[] {
  const keys = new Set(artists.map(slug));
  return events.filter((e) => e.a.some((a) => keys.has(slug(a))));
}

/**
 * "Nieuw" on the radar: first seen in a later nightly run than the data shown at the previous visit (B44). Both are
 * run days, so a visit before and after the same night's run compares correctly. No previous visit: nothing new.
 */
export const newSince = (e: SiteEvent, lastVisit: string | undefined) => !!lastVisit && e.f > lastVisit.slice(0, 10);

/** Venue|month cells that hold a show of a followed artist (overview marking, B27). */
export function followedCells(events: SiteEvent[], artists: string[], monthKey: (iso: string) => string): Set<string> {
  return new Set(radarEvents(events, artists).map((e) => `${e.v}|${monthKey(e.s)}`));
}
