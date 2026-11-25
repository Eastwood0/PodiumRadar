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

const SPORT = /\b(vs\.?|fc|sv|vfl|tsv|bvb|ajax|feyenoord|vitesse|psv|haie|uefa|bundesliga|eredivisie|champions league|europa league|conference league|handball|basketball|volleyball|eishockey|darts|boxing|boksen|glory|wwe|ufc|monster jam|supercross|turnkunst|wedstrijd|interland|oranje leeuwinnen|nations league|world cup|wk |ek )\b/i;
const OTHER = /\b(comedy|comedian|comedians|cabaret|kabarett|stand-?up|lezing|podcast|beurs|messe|snuffelmarkt|vlooienmarkt|congres|kongress|holiday on ice|disney on ice|circus|zirkus|cirque|sinterklaas|sint show|quiz|bingo|musical|ballet|theater|theatre|magie|magic|freek vonk|lachende)\b/i;
/** Teams written as "X - Y" (sport fixtures). */
const FIXTURE = /^[\p{L}0-9 .'’]+ [-–] [\p{L}0-9 .'’]+$/u;

export type Category = "muziek" | "overig";

/** Rough category from the title, optionally overridden by the source's own category. */
export function categorize(title: string, sourceCategory?: string): Category {
  if (sourceCategory) {
    if (/konzert|concert|muziek|music|musik/i.test(sourceCategory)) return "muziek";
    if (/sport|comedy|eishockey|entertainment|familie|kennis|debat|theater/i.test(sourceCategory)) return "overig";
  }
  if (SPORT.test(title) || OTHER.test(title)) return "overig";
  if (FIXTURE.test(title.trim()) && /\b(fc|sv|vs|jong|united|city)\b/i.test(title)) return "overig";
  return "muziek";
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
