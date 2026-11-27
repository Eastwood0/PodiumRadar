/**
 * Music genres per artist (B31, B55), for music events whose source gives no genre: MusicBrainz first, then
 * Apple's iTunes Search (primaryGenreName, about 20 requests per minute, docs/BRONNEN.md) for artists MusicBrainz
 * does not know or has no tags for (many DJs and local acts).
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
import { artistKey, type ArtistGenreEntry, danceStylesFromTags, fromItunesGenre, genresFromTags, type Tag, tributeTarget } from "./lib/music-genre";

const EVENTS_FILE = "data/events.json";
const BUDGET = Number(process.env.GENRE_BUDGET ?? 2000);
/** Extra pause on top of the 1 request/s queue: CI machines share IP addresses, MusicBrainz counts per IP. */
const EXTRA_PAUSE_MS = 1000;
/** Hard stop so the daily run always finishes: MusicBrainz can slow us down a lot with 503s. */
const MAX_MINUTES = Number(process.env.GENRE_MAX_MINUTES ?? 40);
const RECHECK_MISS_DAYS = 60;
const RECHECK_HIT_DAYS = 180;
const MAX_ACTS_PER_EVENT = 4;
/** Apple: "approximately 20 calls per minute"; one every 3.2 s stays under it. */
const ITUNES_INTERVAL_MS = 3200;
let lastItunes = 0;

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

const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));

async function lookup(name: string, today: string): Promise<ArtistGenreEntry | "error"> {
  const url = `https://musicbrainz.org/ws/2/artist/?query=${encodeURIComponent(`artist:"${luceneEscape(name)}"`)}&fmt=json&limit=5`;
  let r = await apiGet(url);
  for (const wait of [5_000, 20_000]) {
    if (r.status !== 503) break;
    // Over the limit (shared CI machines count too): back off, then try again.
    await sleep(wait);
    r = await apiGet(url);
  }
  if (!r.ok) {
    console.warn(`MusicBrainz ${r.status || r.error} voor "${name}"`);
    return "error";
  }
  const hit = pickArtist(name, (JSON.parse(r.body) as { artists?: MbArtist[] }).artists ?? []);
  if (!hit) return { genres: [], checked: today };
  const genres = genresFromTags(hit.tags ?? []);
  return { mbid: hit.id, genres, dance: genres.includes("Dance & DJ") ? danceStylesFromTags(hit.tags ?? []) : [], checked: today };
}

interface ItunesArtist {
  artistName: string;
  primaryGenreName?: string;
}

/** Apple's iTunes Search: the artist with exactly this name in the Dutch store, or none. Exported for tests. */
export function pickItunes(name: string, results: ItunesArtist[]): ItunesArtist | undefined {
  const key = artistKey(name);
  const same = results.filter((r) => artistKey(r.artistName) === key && r.primaryGenreName);
  // Namesakes with different genres (two artists called "Annie"): no guess (Codex).
  return new Set(same.map((r) => r.primaryGenreName)).size === 1 ? same[0] : undefined;
}

async function itunes(name: string, entry: ArtistGenreEntry, today: string): Promise<ArtistGenreEntry | "error"> {
  const wait = lastItunes + ITUNES_INTERVAL_MS - Date.now();
  if (wait > 0) await sleep(wait);
  lastItunes = Date.now();
  const r = await apiGet(`https://itunes.apple.com/search?term=${encodeURIComponent(name)}&country=NL&media=music&entity=musicArtist&limit=10`);
  if (!r.ok) {
    console.warn(`iTunes ${r.status || r.error} voor "${name}"`);
    return "error";
  }
  const hit = pickItunes(name, (JSON.parse(r.body) as { results?: ItunesArtist[] }).results ?? []);
  const found = hit?.primaryGenreName ? fromItunesGenre(hit.primaryGenreName) : { genres: [], dance: [] };
  if (!found.genres.length) return { ...entry, itunes: today };
  return { ...entry, genres: found.genres, dance: found.dance, from: "itunes", itunes: today };
}

async function main() {
  const today = new Date().toISOString().slice(0, 10);
  const file = JSON.parse(readFileSync(EVENTS_FILE, "utf8")) as { generatedAt: string; events: Event[] };
  const cache = loadArtistGenres();

  const wanted = new Map<string, string>(); // key → name as written
  for (const e of file.events) {
    const needsDance = e.musicGenres?.includes("Dance & DJ") && !e.danceStyles?.length;
    const theatreGuess = e.category === "overig" && e.categoryGuess;
    if ((e.category !== "muziek" && !theatreGuess) || (e.musicGenres?.length && !needsDance)) continue;
    for (const raw of e.artists.slice(0, MAX_ACTS_PER_EVENT)) {
      const name = tributeTarget(raw.name) ?? raw.name;
      const key = artistKey(name);
      if (key.length < 2 || wanted.has(key)) continue;
      const c = cache[key];
      const stale = c && (daysSince(c.checked, today) > (c.genres.length ? RECHECK_HIT_DAYS : RECHECK_MISS_DAYS) || (c.genres.includes("Dance & DJ") && !c.dance?.length && !c.itunes));
      if (!c || stale || (!c.genres.length && !c.itunes)) wanted.set(key, name);
    }
  }
  const todo = [...wanted.entries()].slice(0, BUDGET);
  console.log(`MusicBrainz: ${wanted.size} artiesten te zoeken, nu ${todo.length} (budget ${BUDGET})`);

  let found = 0;
  let errors = 0;
  let done = 0;
  const deadline = Date.now() + MAX_MINUTES * 60_000;
  // Two queues side by side, each at its own service's pace: MusicBrainz (1/s) and iTunes (~18/min). An artist goes
  // to iTunes when MusicBrainz has no genre for it (or no dance style), so a run gets through twice as many.
  const toItunes: [string, string][] = [];
  let mbDone = false;
  const store = (key: string, res: ArtistGenreEntry) => {
    cache[key] = res;
    if (++done % 50 === 0) saveArtistGenres(cache); // a cut-off run keeps what it found
  };
  const needsItunes = (res: ArtistGenreEntry) => (!res.genres.length || (res.genres.includes("Dance & DJ") && !res.dance?.length)) && !res.itunes;

  const mbWorker = async () => {
    for (const [key, name] of todo) {
      if (Date.now() > deadline) break;
      const prev = cache[key];
      // A MusicBrainz miss from an earlier run that iTunes has not seen yet: straight to iTunes.
      if (prev && !prev.genres.length && !prev.itunes && daysSince(prev.checked, today) <= RECHECK_MISS_DAYS) {
        toItunes.push([key, name]);
        continue;
      }
      await sleep(EXTRA_PAUSE_MS);
      const res = await lookup(name, today);
      if (res === "error") {
        if (++errors >= 15) {
          console.warn("MusicBrainz geeft herhaaldelijk fouten; stop voor vandaag");
          break;
        }
        continue;
      }
      const entry: ArtistGenreEntry = { ...res, from: res.genres.length ? "musicbrainz" : undefined };
      store(key, entry);
      if (entry.genres.length) found++;
      if (needsItunes(entry)) toItunes.push([key, name]);
    }
    mbDone = true;
  };

  const itunesWorker = async () => {
    while (Date.now() <= deadline) {
      const next = toItunes.shift();
      if (!next) {
        if (mbDone) break;
        await sleep(500);
        continue;
      }
      const [key, name] = next;
      const before = cache[key] ?? { genres: [], checked: today };
      const res = await itunes(name, before, today);
      if (res === "error") continue;
      const danceOnly = before.genres.includes("Dance & DJ") && !before.dance?.length;
      const entry = danceOnly && res.from === "itunes" ? { ...before, dance: res.dance, itunes: today } : res;
      if (!before.genres.length && entry.genres.length) found++;
      store(key, entry);
    }
  };

  await Promise.all([mbWorker(), itunesWorker()]);
  if (Date.now() > deadline) console.log(`Genres: tijdslimiet van ${MAX_MINUTES} minuten bereikt; de rest volgt bij de volgende run`);
  saveArtistGenres(cache);

  const events = applyArtistGenres(file.events, cache);
  writeFileSync(EVENTS_FILE, JSON.stringify({ ...file, events }, null, 1) + "\n");
  const music = events.filter((e) => e.category === "muziek");
  const dance = music.filter((e) => e.musicGenres?.includes("Dance & DJ"));
  console.log(`Dance & DJ: ${dance.filter((e) => e.danceStyles?.length).length} van ${dance.length} met een stijl`);
  const withGenre = music.filter((e) => e.musicGenres?.length).length;
  console.log(`Genre gevonden voor ${found} van ${todo.length} gezochte artiesten; ${withGenre} van ${music.length} concerten hebben nu een genre`);
}

if (process.argv[1]?.endsWith("genres.ts")) {
  main().catch((e) => {
    console.warn(`genres: ${e}`);
  });
}
