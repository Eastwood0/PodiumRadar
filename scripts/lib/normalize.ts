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

/** Tour names, years and notes that are not part of the act's name ("Oasis Live '27", "Froukje - Extra show"). */
export function cleanActName(name: string): string {
  return name
    .replace(/^(vip ?(package|ticket|upgrade)s?|nieuwe datum|extra show|verplaatst|new date|uitverkocht)\s*[:–—-]\s*/i, "")
    .replace(/\s*\((nieuwe datum|extra show|uitverkocht|new date|verplaatst|sold out|[A-Z]{2})\)\s*/gi, " ")
    .replace(/\s*[–—-]\s*(.*\b(tour|tournee|live|in concert|world|europe|anniversary|jubileum|farewell|afscheid)\b.*|extra (show|concert)|\d{2,4})\s*$/i, "")
    .replace(/\s+(live\s*)?'\d{2}\s*$/i, "")
    .replace(/\s+live\s*(19|20)?\d{2}\s*$/i, "")
    .replace(/\s*:\s*(19|20)\d\d\s*$/, "")
    .replace(/\s+(19|20)\d\d\s*$/, "")
    .replace(/\s*\+\s*(support|special guests?|guests?|supports?|voorprogramma)\s*$/i, "")
    .replace(/\s*[-–—]?\s+(all night( long)?|all nighter|extended set|open to close)\s*$/i, "")
    .replace(/\s*(&|en|and|und|met|with|\+)\s+(band|de band|vrienden|friends|freunde|gasten|guests|orkest|orchestra|strijkers)\s*$/i, "")
    .replace(/^\d+\s+(jahre|jaar|years|ans)\s+(of\s+|van\s+)?/i, "")
    .replace(/\s*\([^()]{2,30}\)\s*$/, "")
    .replace(/\s+/g, " ")
    .trim();
}

/** "Claydrum presents A / B / C": the night's name before "presents", the line-up after it. */
const PRESENTS = /^(.{2,60}?)\s+(?:presents?|pres\.|invites|nodigt uit|präsentiert)\s*:?\s+(.+)$/i;
const LINEUP_SEP = /\s*(?:\/|\||,|\s\+\s|\sb2b\s|\sB2B\s|\sx\s|\sw\/\s)\s*/;
/** "&" splits only inside a list that already has other separators ("A, B & C"), not "Simon & Garfunkel". */
const LINEUP_SEP_AMP = /\s*(?:\/|\||,|\s\+\s|\sb2b\s|\sB2B\s|\sx\s|\sw\/\s|\s&\s)\s*/;
const NOT_A_NAME = /^(more|meer|friends|tba|guests?)$|\b(all night long|all nighter|and (more|many more|friends)|en (meer|vele anderen)|tba|t\.?b\.?a\.?|special guests?|more tba|\+ ?more|residents?|& more|lineup|line-up)\b/i;

/**
 * Acts in a title. Always split on separators that almost always mean a line-up ("A + B", "A x B", "A b2b B");
 * "&", "with" and "feat." are left alone ("Kool & The Gang" is one band). For a club night (`lineup`) also on
 * "/", "," and "|", and "X presents A / B" gives A and B. In a theatre the performer comes before the colon
 * ("Stef Bos: Een nieuwe show").
 */
export function artistsFromTitle(title: string, opts: { lineup?: boolean } = {}): string[] {
  const clean = cleanActName(title);
  const presents = clean.match(PRESENTS);
  if (opts.lineup) {
    const body = presents && /[/,|]|\sb2b\s/i.test(presents[2]) ? presents[2] : clean;
    const parts = body
      .split(/[/,|]|\sb2b\s/i.test(body) ? LINEUP_SEP_AMP : LINEUP_SEP)
      .map((x) => cleanActName(x.replace(/\s*\((live|dj set|hybrid|[a-z]{2,3})\)\s*$/i, "")))
      .filter((x) => x.length >= 2 && !NOT_A_NAME.test(x));
    if (parts.length > 1 && parts.length <= 12) return parts;
  }
  const colon = clean.match(/^([^:]{2,50}):\s+\S/);
  const head = colon && colon[1].split(/\s+/).length <= 6 ? cleanActName(colon[1]) : clean;
  const parts = head.split(/\s*\+\s*|\s+(?:x|b2b)\s+/i).map((x) => x.trim()).filter(Boolean);
  return parts.length > 1 && parts.length <= 4 && parts.every((x) => x.length >= 2) ? parts : [head || title];
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
