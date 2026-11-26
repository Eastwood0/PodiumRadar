/**
 * Music genres (B31): a fixed list the site can filter on. Evidence, strongest first:
 *   1. the source's own label or clear words in the title ("Techno", "Metal", "Klassiek")
 *   2. the artist's tags in MusicBrainz (scripts/genres.ts, cached in data/artist-genres.json)
 * An event gets at most two genres. No evidence = no genre (the site shows it under every genre filter
 * as "onbekend" rather than guessing).
 */
import { DANCE_STYLES, type DanceStyle, MUSIC_GENRES, type MusicGenre } from "../../src/lib/genres";

export { DANCE_STYLES, type DanceStyle, MUSIC_GENRES, type MusicGenre };

/**
 * Words → genre. Matched on whole words (case-insensitive) against a source label, a title or a MusicBrainz
 * tag. More specific words come first so "post-punk" counts as Rock and "dance-pop" as Pop + Dance.
 */
const RULES: [RegExp, MusicGenre][] = [
  [/\b(post-?punk|indie|alternative|alt-rock|grunge|garage rock|shoegaze|britpop|emo|stoner|psychedelic rock|prog(ressive)? rock|rock|rock ?'?n'? ?roll|hard rock|blues rock|krautrock)\b/i, "Rock"],
  [/\b(loud|heavy metal|metal|metalcore|deathcore|death metal|black metal|thrash|doom|grindcore|nu metal|(?<!post-)(?<!post)punk|hardcore punk|pop punk|ska punk)\b/i, "Metal & punk"],
  [/\b(hip ?hop|hip-hop|rap|deutschrap|nederhop|trap|drill|grime|r&b|rnb|r ?'?n'? ?b|contemporary r&b|urban|boom bap|afroswing)\b/i, "Hiphop & R&B"],
  [/\b(techno|house|deep house|tech house|trance|hardstyle|hardcore|gabber|frenchcore|uptempo|edm|electronic|electronica|electro|elektronische?|drum (and|&|n) bass|dnb|jungle|dubstep|bass music|big room|dance|club|clubnacht|clubavond|nachtleven|dj|rave|disco|italo|eurodance|hard dance|ambient|downtempo|breakbeat|uk garage)\b/i, "Dance & DJ"],
  [/\b(nederpop|nederlandstalig|levenslied|smartlap|carnaval|nederhop|volkszanger|palingsound|limburgstalig|dialect)\b/i, "Nederlandstalig"],
  [/\b(schlager|volksmusik|volkstümliche musik|ballermann|après-ski|apres-ski|stimmungsmusik|deutscher schlager)\b/i, "Schlager"],
  [/\b(singer-?songwriter|folk|indie folk|country|americana|bluegrass|acoustic|akoestisch|chanson|cantautor|liedermacher|alt-country)\b/i, "Folk & singer-songwriter"],
  [/\b(jazz|smooth jazz|swing|big band|bebop|fusion|soul|neo-?soul|motown|blues|funk|gospel|rhythm and blues)\b/i, "Jazz, soul & blues"],
  [/\b(classical|klassiek|klassik|klassisch|opera|oper|orchestra|orkest|orchester|symphon\w*|baroque|barok|chamber music|kamermuziek|kammermusik|choir|koor|chor|contemporary classical|requiem|philharmoni\w*)\b/i, "Klassiek"],
  [/\b(latin|latino|reggaeton|salsa|bachata|cumbia|samba|bossa nova|flamenco|fado|tango|reggae|dancehall|dub|afrobeats?|afro|amapiano|world|wereld|weltmusik|arabic|turkish|türkçe|bollywood|balkan|klezmer|celtic|cuban|brazilian|k-?pop|j-?pop|c-?pop|mandopop|cantopop)\b/i, "Wereld & latin"],
  [/\b(pop|synth-?pop|electropop|dance-?pop|indie pop|teen pop|art pop|dream pop|power pop|europop|chamber pop|soft rock|adult contemporary|boy ?band|girl ?group|ballad|deutschpop)\b/i, "Pop"],
];
// K-pop is pop in most people's ears; the Wereld rule above catches the word first, so add Pop too.
const ALSO: [RegExp, MusicGenre][] = [[/\b(k-?pop|j-?pop|europop|dance-?pop|electropop|synth-?pop)\b/i, "Pop"]];

/** Words → dance style. "hardcore punk" is not hardcore (dance). */
const DANCE_RULES: [RegExp, DanceStyle][] = [
  [/\b(techno|hard techno|minimal|acid|industrial techno|melodic techno|hypnotic techno)\b/i, "Techno"],
  [/\b(house|deep ?house|tech ?house|afro ?house|progressive house|funky house|uk garage|garage house|amapiano|lo-?fi house)\b/i, "House"],
  [/\b(trance|psy-?trance|psychedelic trance|uplifting|goa)\b/i, "Trance"],
  [/\b(hardstyle|rawstyle|hardcore(?!\s*punk)|gabber|frenchcore|uptempo|terror|hard dance|q-?dance|defqon)\b/i, "Hardstyle & hardcore"],
  [/\b(drum ?(and|&|n'?) ?bass|dnb|d&b|jungle|liquid funk|neurofunk|dubstep|bass music|riddim)\b/i, "Drum & bass"],
  [/\b(disco|nu-?disco|italo|italo disco|boogie)\b/i, "Disco"],
  [/\b(edm|big room|electro house|future house|bigroom|eurodance|mainstage)\b/i, "EDM"],
];

/** Dance styles a piece of text points to, in rule order. */
export function danceStylesInText(text: string | undefined): DanceStyle[] {
  if (!text) return [];
  return DANCE_RULES.filter(([re]) => re.test(text)).map(([, d]) => d);
}

/** Dance styles from MusicBrainz tags, with the same voting rule as genresFromTags. */
export function danceStylesFromTags(tags: Tag[]): DanceStyle[] {
  const score = new Map<DanceStyle, number>();
  for (const t of tags) for (const d of danceStylesInText(t.name)) score.set(d, (score.get(d) ?? 0) + Math.max(t.count, 0));
  const ranked = [...score.entries()].filter(([, s]) => s > 0).sort((a, b) => b[1] - a[1]);
  const top = ranked[0]?.[1] ?? 0;
  return ranked.filter(([, s]) => s * 3 >= top).slice(0, 2).map(([d]) => d);
}

/** All genres a piece of text points to, in rule order. */
export function genresInText(text: string | undefined): MusicGenre[] {
  if (!text) return [];
  const out = new Set<MusicGenre>();
  for (const [re, g] of RULES) if (re.test(text)) out.add(g);
  for (const [re, g] of ALSO) if (re.test(text)) out.add(g);
  return [...out];
}

export interface Tag {
  name: string;
  count: number;
}

/**
 * Genres from MusicBrainz tags: each tag votes with its count for the genres it names; the two
 * strongest win, provided they got at least a third of the top score (filters stray tags).
 */
export function genresFromTags(tags: Tag[]): MusicGenre[] {
  const score = new Map<MusicGenre, number>();
  for (const t of tags) {
    if (t.count < 1) continue;
    for (const g of genresInText(t.name)) score.set(g, (score.get(g) ?? 0) + t.count);
  }
  const ranked = [...score.entries()].sort((a, b) => b[1] - a[1] || MUSIC_GENRES.indexOf(a[0]) - MUSIC_GENRES.indexOf(b[0]));
  const top = ranked[0]?.[1] ?? 0;
  return ranked.filter(([, s]) => s * 3 >= top).slice(0, 2).map(([g]) => g);
}

/** Lowercase, no accents, single spaces: the key for the artist cache. */
export function artistKey(name: string): string {
  return name
    .toLowerCase()
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .replace(/&/g, " and ")
    .replace(/[^a-z0-9]+/g, " ")
    .trim();
}

/** Genres an event shows by itself: the source label, words in the title, and the broad category. */
export function eventGenres(title: string, sourceCategory: string | undefined, displayGenre: string): MusicGenre[] {
  const out = new Set<MusicGenre>([...genresInText(sourceCategory), ...genresInText(title)]);
  if (displayGenre === "Dance") out.add("Dance & DJ");
  if (displayGenre === "Klassiek") out.add("Klassiek");
  return [...out].slice(0, 2);
}

/** Dance styles an event shows by itself (only meaningful when it is Dance & DJ). */
export function eventDanceStyles(title: string, sourceCategory: string | undefined): DanceStyle[] {
  return [...new Set([...danceStylesInText(sourceCategory), ...danceStylesInText(title)])].slice(0, 2);
}

export interface ArtistGenreEntry {
  /** MusicBrainz id of the matched artist; absent when no reliable match was found. */
  mbid?: string;
  genres: MusicGenre[];
  /** Dance styles from the same tags; absent in entries made before dance styles existed. */
  dance?: DanceStyle[];
  /** Day of the lookup (YYYY-MM-DD); misses are retried after a while. */
  checked: string;
}
export type ArtistGenreCache = Record<string, ArtistGenreEntry>;

type WithGenres = { category: string; artists: { name: string }[]; musicGenres?: MusicGenre[]; danceStyles?: DanceStyle[] };

/** Fills musicGenres (and dance styles) from the artist cache for music events that have none of their own. */
export function applyArtistGenres<T extends WithGenres>(events: T[], cache: ArtistGenreCache): T[] {
  return events.map((e) => {
    if (e.category !== "muziek") return e;
    let out = e;
    if (!out.musicGenres?.length) {
      const hit = e.artists.map((a) => cache[artistKey(a.name)]).find((c) => c?.genres.length);
      if (hit) out = { ...out, musicGenres: hit.genres };
    }
    if (out.musicGenres?.includes("Dance & DJ") && !out.danceStyles?.length) {
      const hit = e.artists.map((a) => cache[artistKey(a.name)]).find((c) => c?.dance?.length);
      if (hit) out = { ...out, danceStyles: hit.dance };
    }
    return out;
  });
}
