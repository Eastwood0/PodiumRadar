import type { SiteVenue } from "../lib/site-data";
import { artistHref, type ArtistEntry, venueHref } from "./lib";

export interface SearchHit {
  kind: "artiest" | "zaal" | "volg";
  label: string;
  detail: string;
  href: string;
  /** For "volg": the name to follow. */
  name?: string;
}

interface Item extends SearchHit {
  tokens: string[];
  /** Number of words in the name itself (city and aliases don't count as "extra words"). */
  size: number;
  compact: string;
  weight: number;
}

/** Venue cities are stored in Dutch; people also type the local or English name. */
const CITY_ALIASES: Record<string, string> = {
  Keulen: "Köln Koeln Cologne",
  Brussel: "Bruxelles Brussels",
  Antwerpen: "Antwerp Anvers",
  "'s-Hertogenbosch": "Den Bosch",
};

/** Lowercase, no accents, "&" as "en", only letters and digits. */
export function norm(s: string): string {
  return s
    .toLowerCase()
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .replace(/ß/g, "ss")
    .replace(/&/g, " en ")
    .replace(/[^a-z0-9]+/g, " ")
    .trim();
}

/** Edit distance that counts a swapped letter pair ("bakc") as one typo. Stops early above `max`. */
export function typoDistance(a: string, b: string, max: number): number {
  if (Math.abs(a.length - b.length) > max) return max + 1;
  const rows: number[][] = [Array.from({ length: b.length + 1 }, (_, j) => j)];
  for (let i = 1; i <= a.length; i++) {
    const row = [i];
    let best = i;
    for (let j = 1; j <= b.length; j++) {
      const cost = a[i - 1] === b[j - 1] ? 0 : 1;
      let v = Math.min(rows[i - 1][j] + 1, row[j - 1] + 1, rows[i - 1][j - 1] + cost);
      if (i > 1 && j > 1 && a[i - 1] === b[j - 2] && a[i - 2] === b[j - 1]) v = Math.min(v, rows[i - 2][j - 2] + 1);
      row.push(v);
      best = Math.min(best, v);
    }
    if (best > max) return max + 1;
    rows.push(row);
  }
  return rows[a.length][b.length];
}

/** How many typos a typed word may contain: none for short words, more for long ones. */
const allowed = (len: number) => (len <= 3 ? 0 : len <= 8 ? 1 : 2);

/** Score of one typed word against one word of a name; lower is better, Infinity = no match. */
function wordScore(q: string, w: string): number {
  if (w === q) return 0;
  if (w.startsWith(q)) return 0.1; // still typing
  const max = allowed(q.length);
  if (!max || q[0] !== w[0]) return Infinity; // typos are rarely in the first letter
  const d = Math.min(typoDistance(q, w, max), typoDistance(q, w.slice(0, q.length), max));
  return d <= max ? 0.2 + d * 0.15 : Infinity;
}

function score(qTokens: string[], qCompact: string, item: Item): number {
  let total = 0;
  for (const q of qTokens) {
    let best = Infinity;
    for (const w of item.tokens) best = Math.min(best, wordScore(q, w));
    if (best === Infinity) {
      total = Infinity;
      break;
    }
    total += best;
  }
  let s = total / qTokens.length;
  // Words typed together or apart ("backstreetboys", "ziggodome").
  if (qCompact.length >= 4) {
    if (item.compact.startsWith(qCompact)) s = Math.min(s, 0.1);
    else {
      const max = allowed(qCompact.length);
      const d = typoDistance(qCompact, item.compact.slice(0, qCompact.length + 1), max);
      if (d <= max) s = Math.min(s, 0.25 + d * 0.15);
    }
  }
  return s + Math.max(0, item.size - qTokens.length) * 0.01;
}

/**
 * Search over artists and venues that forgives typos ("backstreet boy", "rammstien", "bakcstreet"),
 * missing accents ("beyonce", "koln") and words typed together. Every typed word must match a word of the
 * name; that keeps long show titles from matching on loose letters. Ties: more shows first.
 */
/**
 * "Volg “<name>”" as the last option, unless the typed name is already an artist in the agenda: you can follow an
 * act that is not touring now (bouwplan §9, B14). Needs at least two letters.
 */
export function withFollowOption(query: string, hits: SearchHit[]): SearchHit[] {
  const name = query.trim().replace(/\s+/g, " ");
  if (norm(name).replace(/ /g, "").length < 2 || /\S+@\S+\.\S+/.test(name)) return hits; // never offer to store an e-mail address
  if (hits.some((h) => h.kind === "artiest" && norm(h.label) === norm(name))) return hits;
  return [...hits, { kind: "volg", label: `Volg “${name}”`, detail: "ook zonder geplande shows", href: artistHref(name), name }];
}

export function createSearch(artists: ArtistEntry[], venues: SiteVenue[], describeArtist: (a: ArtistEntry) => string) {
  const make = (kind: Item["kind"], label: string, extra: string, href: string, detail: string, weight: number): Item => {
    const n = norm(label);
    return { kind, label, href, detail, weight, tokens: norm(`${label} ${extra}`).split(" ").filter(Boolean), size: n.split(" ").length, compact: n.replace(/ /g, "") };
  };
  const items: Item[] = [
    ...artists.map((a) => make("artiest", a.name, "", artistHref(a.name), describeArtist(a), a.count)),
    ...venues.map((v) => make("zaal", v.n, `${v.city} ${CITY_ALIASES[v.city] ?? ""}`, venueHref(v.id), `${v.city} · ${v.cc}`, 1000)),
  ];
  return (query: string, limit = 8): SearchHit[] => {
    const n = norm(query);
    if (n.replace(/ /g, "").length < 2) return [];
    const qTokens = n.split(" ");
    const qCompact = n.replace(/ /g, "");
    return items
      .map((item) => ({ item, s: score(qTokens, qCompact, item) }))
      .filter((x) => x.s < Infinity)
      .sort((a, b) => a.s - b.s || b.item.weight - a.item.weight || a.item.label.length - b.item.label.length)
      .slice(0, limit)
      .map(({ item }) => ({ kind: item.kind, label: item.label, detail: item.detail, href: item.href }));
  };
}
