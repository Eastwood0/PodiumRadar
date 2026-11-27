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
  [/\b(techno|tekno|hardtek|house|deep[- ]?house|tech[- ]?house|trance|hardstyle|hardcore(?!\s*punk)|gabber|frenchcore|uptempo|edm|electronic|electronica|electro|elektronische?|drum (and|&|n) bass|dnb|jungle|dubstep|bass music|big room|dance|club|clubnacht|clubavond|nachtleven|dj|rave|disco|italo|eurodance|hard dance|ambient|downtempo|breakbeat|uk garage)\b/i, "Dance & DJ"],
  [/\b(nederpop|nederlandstalig|levenslied|smartlap|carnaval|nederhop|volkszanger|palingsound|limburgstalig|dialect)\b/i, "Nederlandstalig"],
  [/\b(schlager|volksmusik|volkstümliche musik|ballermann|après-ski|apres-ski|stimmungsmusik|deutscher schlager)\b/i, "Schlager"],
  [/\b(singer-?songwriter|folk|indie folk|country|americana|bluegrass|acoustic|akoestisch|chanson|cantautor|liedermacher|alt-country)\b/i, "Folk & singer-songwriter"],
  [/\b(jazz|smooth jazz|swing|big band|bebop|fusion|soul|neo-?soul|motown|blues|funk|gospel|rhythm and blues)\b/i, "Jazz, soul & blues"],
  [/\b(classical|klassiek|klassik|klassisch|opera|oper|orchestra|orkest|orchester|symphon\w*|baroque|barok|chamber music|kamermuziek|kammermusik|choir|koor|chor|contemporary classical|requiem|philharmoni\w*)\b/i, "Klassiek"],
  [/\b(latin|latino|reggaeton|salsa|bachata|cumbia|samba|bossa nova|flamenco|fado|tango|reggae|dancehall|dub|afrobeats?|afro|amapiano|world music|wereldmuziek|weltmusik|arabic|turkish|türkçe|bollywood|balkan|klezmer|celtic|cuban|brazilian|k-?pop|j-?pop|c-?pop|mandopop|cantopop)\b/i, "Wereld & latin"],
  [/\b(night of the proms|karaoke|meezing\w*|sing-?along|top ?40|top ?2000|top ?100|classic hits|greatest hits|hitparade|fanparty|foute? (party|feestje|avond)|80'?s|90'?s|00'?s|pop|synth-?pop|electropop|dance-?pop|indie pop|teen pop|art pop|dream pop|power pop|europop|chamber pop|soft rock|adult contemporary|boy ?band|girl ?group|ballad|deutschpop)\b/i, "Pop"],
];
// K-pop is pop in most people's ears; the Wereld rule above catches the word first, so add Pop too.
const ALSO: [RegExp, MusicGenre][] = [[/\b(k-?pop|j-?pop|europop|dance-?pop|electropop|synth-?pop)\b/i, "Pop"]];

/** Words → dance style. "hardcore punk" is not hardcore (dance). */
const DANCE_RULES: [RegExp, DanceStyle][] = [
  [/\b(techno|tekno|hardtek|hard techno|minimal|acid|industrial techno|melodic techno|hypnotic techno)\b/i, "Techno"],
  [/\b(house|deep[- ]?house|tech[- ]?house|afro[- ]?house|progressive house|funky house|uk garage|garage house|amapiano|lo-?fi house)\b/i, "House"],
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
/** A title without its tour name: "U2 – World Tour" is not world music, "Sienna Spiro – My House Tour" not house. */
export function withoutTour(title: string): string {
  return title.replace(/\s*[-–—:]\s*[^-–—:]*\btour(nee)?\b.*$/i, "").replace(/\b(\S+\s+){0,2}(world\s+)?tour(nee)?\b.*$/i, "");
}

export function eventGenres(title: string, sourceCategory: string | undefined, displayGenre: string): MusicGenre[] {
  const out = new Set<MusicGenre>([...genresInText(sourceCategory), ...genresInText(withoutTour(title))]);
  if (displayGenre === "Dance") out.add("Dance & DJ");
  if (displayGenre === "Klassiek") out.add("Klassiek");
  return [...out].slice(0, 2);
}

/** Dance styles an event shows by itself (only meaningful when it is Dance & DJ). */
export function eventDanceStyles(title: string, sourceCategory: string | undefined): DanceStyle[] {
  return [...new Set([...danceStylesInText(sourceCategory), ...danceStylesInText(withoutTour(title))])].slice(0, 2);
}

export interface ArtistGenreEntry {
  /** MusicBrainz id of the matched artist; absent when no reliable match was found. */
  mbid?: string;
  /** Where the genre came from: MusicBrainz tags, or Apple's iTunes Search (primaryGenreName) when MusicBrainz had none. */
  from?: "musicbrainz" | "itunes";
  /** Day iTunes was asked (also when it had nothing), so a MusicBrainz miss is tried there once. */
  itunes?: string;
  genres: MusicGenre[];
  /** Dance styles from the same tags; absent in entries made before dance styles existed. */
  dance?: DanceStyle[];
  /** Day of the lookup (YYYY-MM-DD); misses are retried after a while. */
  checked: string;
}
export type ArtistGenreCache = Record<string, ArtistGenreEntry>;

/** iTunes' own genre names that the word rules would miss or misread ("Singer/Songwriter", "R&B/Soul"). */
const ITUNES: Record<string, MusicGenre[]> = {
  "singer/songwriter": ["Folk & singer-songwriter"],
  "r&b/soul": ["Hiphop & R&B"],
  "hip-hop/rap": ["Hiphop & R&B"],
  "dutch pop": ["Nederlandstalig"],
  nederpop: ["Nederlandstalig"],
  "música tropical": ["Wereld & latin"],
  "música mexicana": ["Wereld & latin"],
  "urbano latino": ["Wereld & latin"],
  "k-pop": ["Pop", "Wereld & latin"],
  "j-pop": ["Pop", "Wereld & latin"],
  "hard rock": ["Rock"],
  "heavy metal": ["Metal & punk"],
  "christian & gospel": ["Jazz, soul & blues"],
  "easy listening": ["Pop"],
  "vocal": ["Pop"],
  "new age": ["Klassiek"],
};

/** iTunes `primaryGenreName` → our genres and dance styles. Soundtrack, comedy, spoken word, children's music: none. */
export function fromItunesGenre(name: string): { genres: MusicGenre[]; dance: DanceStyle[] } {
  const key = name.toLowerCase().trim();
  if (/soundtrack|comedy|spoken|children|kinder|fitness|holiday|karaoke|audiobook/.test(key)) return { genres: [], dance: [] };
  const genres = ITUNES[key] ?? genresInText(name).slice(0, 2);
  return { genres, dance: genres.includes("Dance & DJ") ? danceStylesInText(name).slice(0, 2) : [] };
}

/** "AC/DC tribute", "Tribute to Queen", "Abba Tributeband": the act whose genre a tribute show has. */
export function tributeTarget(name: string): string | undefined {
  // Also after a show name: "Völkerball – A Tribute to Rammstein", "Starman – David Bowie Tribute".
  for (const part of name.split(/\s+[-–—]\s+|\s*:\s+/).reverse()) {
    const m =
      part.match(/^(?:a |the |een )?(?:tribute|ode|eerbetoon) (?:to|aan|an)\s+(?:the music of\s+)?(.+)$/i) ??
      part.match(/^(?:a |the )?(.+?)\s+(?:tribute(?:\s*band| show| act| concert)?|tributeband|revival|experience|forever)\b.*$/i);
    const target = m?.[1]?.replace(/^(\d+ (years|jaar) of|the best of|the story of|the music of)\s+/i, "").trim();
    if (target && target.length >= 2) return target;
  }
  const story = name.match(/^(?:the story of|the music of|the best of|een avond met de muziek van|we all sing|sing along with|.{2,40}? (?:sings|plays|speelt|zingt))\s+(.+)$/i);
  return story?.[1]?.trim() || undefined;
}

type WithGenres = { category: string; genre?: string; categoryGuess?: true; artists: { name: string }[]; musicGenres?: MusicGenre[]; danceStyles?: DanceStyle[] };

/** The cache entries for an act: itself, or for a tribute show the act it pays tribute to. */
const entriesFor = (name: string, cache: ArtistGenreCache) => [cache[artistKey(name)], cache[artistKey(tributeTarget(name) ?? "")]];

/**
 * Fills musicGenres (and dance styles) from the artist cache for music events that have none of their own. In a
 * theatre, an event without clear words counts as theatre (categoryGuess); if its performer is a known musician it
 * is a concert after all.
 */
export function applyArtistGenres<T extends WithGenres>(events: T[], cache: ArtistGenreCache): T[] {
  return events.map((e) => {
    const known = e.artists.flatMap((a) => entriesFor(a.name, cache)).find((c) => c?.genres.length);
    if (e.category !== "muziek") {
      if (!e.categoryGuess || !known) return e;
      e = { ...e, category: "muziek", genre: "Concert" };
    }
    let out = e;
    if (!out.musicGenres?.length && known) out = { ...out, musicGenres: known.genres };
    if (out.musicGenres?.includes("Dance & DJ") && !out.danceStyles?.length) {
      // A club night: the style most of its line-up has (two techno DJs and one house DJ is a techno night).
      const votes = new Map<DanceStyle, number>();
      for (const a of e.artists) for (const d of entriesFor(a.name, cache).find((c) => c?.dance?.length)?.dance ?? []) votes.set(d, (votes.get(d) ?? 0) + 1);
      const ranked = [...votes.entries()].sort((a, b) => b[1] - a[1]);
      if (ranked.length) out = { ...out, danceStyles: ranked.filter(([, n]) => n * 2 > ranked[0][1]).slice(0, 2).map(([d]) => d) };
    }
    return out;
  });
}
