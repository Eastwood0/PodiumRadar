/**
 * Music genres per artist from MusicBrainz (B31), for music events whose source gives no genre.
 * - Looks up artists that are not in data/artist-genres.json yet (or whose last check is old),
 *   at most GENRE_BUDGET per run, 1 request per second (MusicBrainz rule, docs/BRONNEN.md).
 * - Accepts a match only when the name (or an alias) is the same after normalising and the search score is ≥ 90;
 *   with several namesakes the best-known one (most tag votes) wins.
 * - Then fills musicGenres in data/events.json from the cache.
 * A MusicBrainz outage only means fewer genres today: the script never fails the daily run.
 */
import { readFileSync, writeFileSync } from "node:fs";
import type { Event } from "../src/lib/schema";
import { applyArtistGenres, loadArtistGenres, saveArtistGenres } from "./lib/artist-genres";
import { apiGet } from "./lib/http";
import { artistKey, type ArtistGenreEntry, genresFromTags, type Tag } from "./lib/music-genre";

const EVENTS_FILE = "data/events.json";
const BUDGET = Number(process.env.GENRE_BUDGET ?? 700);
const RECHECK_MISS_DAYS = 60;
const RECHECK_HIT_DAYS = 180;
const MAX_ACTS_PER_EVENT = 3;

interface MbArtist {
  id: string;
  name: string;
  score: number;
  aliases?: { name: string }[];
  tags?: Tag[];
}

const daysSince = (day: string, today: string) => (Date.parse(today) - Date.parse(day)) / 86_400_000;
const luceneEscape = (s: string) => s.replace(/([+\-!(){}[\]^"~*?:\\/]|&&|\|\|)/g, "\\$1");

/** Picks the MusicBrainz artist that is really this name, or none. Exported for tests. */
export function pickArtist(name: string, candidates: MbArtist[]): MbArtist | undefined {
  const key = artistKey(name);
  const same = candidates.filter((c) => c.score >= 90 && (artistKey(c.name) === key || c.aliases?.some((a) => artistKey(a.name) === key)));
  const votes = (c: MbArtist) => (c.tags ?? []).reduce((n, t) => n + t.count, 0);
  return same.sort((a, b) => votes(b) - votes(a) || b.score - a.score)[0];
}

async function lookup(name: string, today: string): Promise<ArtistGenreEntry | "error"> {
  const url = `https://musicbrainz.org/ws/2/artist/?query=${encodeURIComponent(`artist:"${luceneEscape(name)}"`)}&fmt=json&limit=5`;
  const r = await apiGet(url);
  if (!r.ok) return "error";
  const hit = pickArtist(name, (JSON.parse(r.body) as { artists?: MbArtist[] }).artists ?? []);
  return hit ? { mbid: hit.id, genres: genresFromTags(hit.tags ?? []), checked: today } : { genres: [], checked: today };
}

async function main() {
  const today = new Date().toISOString().slice(0, 10);
  const file = JSON.parse(readFileSync(EVENTS_FILE, "utf8")) as { generatedAt: string; events: Event[] };
  const cache = loadArtistGenres();

  const wanted = new Map<string, string>(); // key → name as written
  for (const e of file.events) {
    if (e.category !== "muziek" || e.musicGenres?.length) continue;
    for (const a of e.artists.slice(0, MAX_ACTS_PER_EVENT)) {
      const key = artistKey(a.name);
      if (key.length < 2 || wanted.has(key)) continue;
      const c = cache[key];
      const stale = c && daysSince(c.checked, today) > (c.genres.length ? RECHECK_HIT_DAYS : RECHECK_MISS_DAYS);
      if (!c || stale) wanted.set(key, a.name);
    }
  }
  const todo = [...wanted.entries()].slice(0, BUDGET);
  console.log(`MusicBrainz: ${wanted.size} artiesten te zoeken, nu ${todo.length} (budget ${BUDGET})`);

  let found = 0;
  let errors = 0;
  for (const [key, name] of todo) {
    const res = await lookup(name, today);
    if (res === "error") {
      if (++errors >= 10) {
        console.warn("MusicBrainz geeft herhaaldelijk fouten; stop voor vandaag");
        break;
      }
      continue;
    }
    cache[key] = res;
    if (res.genres.length) found++;
  }
  saveArtistGenres(cache);

  const events = applyArtistGenres(file.events, cache);
  writeFileSync(EVENTS_FILE, JSON.stringify({ ...file, events }, null, 1) + "\n");
  const music = events.filter((e) => e.category === "muziek");
  const withGenre = music.filter((e) => e.musicGenres?.length).length;
  console.log(`Genre gevonden voor ${found} van ${todo.length} gezochte artiesten; ${withGenre} van ${music.length} concerten hebben nu een genre`);
}

if (process.argv[1]?.endsWith("genres.ts")) {
  main().catch((e) => {
    console.warn(`genres: ${e}`);
  });
}
