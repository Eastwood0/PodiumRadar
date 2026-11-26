import { createHash } from "node:crypto";

const NOISE = new Set(["live", "tour", "in", "concert", "the", "de", "het", "die", "der", "show", "world", "arena", "tickets", "presents", "nieuwe", "datum", "extra"]);

/** Lowercase, no accents/punctuation, without noise words and years. Used for matching, never shown. */
export function normalizeName(s: string): string {
  return s
    .toLowerCase()
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .replace(/&/g, " and ")
    .replace(/[^a-z0-9 ]+/g, " ")
    .split(/\s+/)
    .filter((w) => w && !NOISE.has(w) && !/^(19|20)\d\d$/.test(w))
    .join(" ");
}

/** Token-set similarity: 1 when one name's tokens are contained in the other's. */
export function tokenSetSimilarity(a: string, b: string): number {
  const A = new Set(normalizeName(a).split(" ").filter(Boolean));
  const B = new Set(normalizeName(b).split(" ").filter(Boolean));
  if (!A.size || !B.size) return 0;
  let inter = 0;
  for (const t of A) if (B.has(t)) inter++;
  return inter / Math.min(A.size, B.size);
}

/** Stable id: hash of venue + local date + normalised title. */
export function eventId(venueKey: string, localDay: string, title: string): string {
  return createHash("sha1").update(`${venueKey}|${localDay}|${normalizeName(title)}`).digest("hex").slice(0, 16);
}

/** Status words in NL/DE/EN/FR → our status. */
export function statusFrom(text: string | undefined): "gepland" | "uitverkocht" | "verplaatst" | "geannuleerd" | undefined {
  if (!text) return undefined;
  if (/geannuleerd|afgelast|abgesagt|cancel+ed|annul[eé]/i.test(text)) return "geannuleerd";
  if (/verplaatst|verschoben|postponed|rescheduled|report[eé]/i.test(text)) return "verplaatst";
  if (/uitverkocht|ausverkauft|sold ?out|\bcomplet\b/i.test(text)) return "uitverkocht";
  return undefined;
}

/**
 * Splits a title into acts only on separators that almost always mean a line-up ("A + B", "A x B", "A b2b B").
 * "&", "with" and "feat." are left alone: "Kool & The Gang" is one band.
 */
export function artistsFromTitle(title: string): string[] {
  const clean = title.replace(/\s*[–—-]\s*(live|tour|in concert|\d{2,4}).*$/i, "").replace(/\s*\((nieuwe datum|extra show|uitverkocht|new date)\)\s*/gi, " ").trim();
  const parts = clean.split(/\s+(?:\+|x|b2b)\s+/i).map((s) => s.trim()).filter(Boolean);
  return parts.length > 1 && parts.length <= 4 && parts.every((p) => p.length >= 2) ? parts : [clean || title];
}

const NAMED: Record<string, string> = {
  amp: "&", quot: '"', apos: "'", lt: "<", gt: ">", nbsp: " ", ndash: "–", mdash: "—", hellip: "…",
  lsquo: "‘", rsquo: "’", ldquo: "“", rdquo: "”", euml: "ë", eacute: "é", egrave: "è", uuml: "ü", ouml: "ö", auml: "ä", szlig: "ß",
};

/** Some sources (WordPress JSON-LD) leave HTML entities in names: "APOLLO BROWN &#038; SKYZOO". */
export function decodeEntities(s: string): string {
  return s
    .replace(/&#(\d+);/g, (_, n) => String.fromCodePoint(Number(n)))
    .replace(/&#x([0-9a-f]+);/gi, (_, n) => String.fromCodePoint(parseInt(n, 16)))
    .replace(/&([a-z]+);/gi, (m, name) => NAMED[name.toLowerCase()] ?? m);
}
