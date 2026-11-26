import { existsSync, readFileSync, writeFileSync } from "node:fs";
import { applyArtistGenres, type ArtistGenreCache } from "./music-genre";

export const ARTIST_GENRES_FILE = "data/artist-genres.json";
export { applyArtistGenres };

export function loadArtistGenres(): ArtistGenreCache {
  if (!existsSync(ARTIST_GENRES_FILE)) return {};
  return JSON.parse(readFileSync(ARTIST_GENRES_FILE, "utf8")) as ArtistGenreCache;
}

export function saveArtistGenres(cache: ArtistGenreCache): void {
  const sorted = Object.fromEntries(Object.entries(cache).sort(([a], [b]) => a.localeCompare(b)));
  writeFileSync(ARTIST_GENRES_FILE, JSON.stringify(sorted, null, 1) + "\n");
}
