/** Music genres the site can filter on (B31). Order = order of the filter buttons. */
export const MUSIC_GENRES = [
  "Pop",
  "Rock",
  "Metal & punk",
  "Hiphop & R&B",
  "Dance & DJ",
  "Nederlandstalig",
  "Schlager",
  "Folk & singer-songwriter",
  "Jazz, soul & blues",
  "Klassiek",
  "Wereld & latin",
] as const;
export type MusicGenre = (typeof MUSIC_GENRES)[number];
