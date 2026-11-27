/**
 * Category of an event: the broad split muziek/overig (the site shows muziek by default, bouwplan B2) plus a
 * display genre. Order of evidence, strongest first:
 *   1. manual corrections in config/categorie-correcties.yml
 *   2. the source's own category label (NL/DE/EN/FR)
 *   3. clear words in the title (sport fixtures, comedy, fairs, family shows, music words)
 *   4. otherwise the venue's type (theatre → toneel, club → dance), else muziek; both marked as a guess
 */
import { readFileSync, existsSync } from "node:fs";
import { parse } from "yaml";

export type Category = "muziek" | "overig";
export type Genre = "Concert" | "Dance" | "Klassiek" | "Festival" | "Comedy" | "Toneel" | "Musical" | "Dans" | "Sport" | "Show" | "Familie" | "Beurs" | "Lezing" | "Overig";

export interface Classification {
  category: Category;
  genre: Genre;
  /** Where the decision came from; "gok" means no evidence (used in the audit report). */
  reason: "correctie" | "bron" | "titel" | "gok";
}

export const GROUP_OF: Record<Genre, Category> = {
  Concert: "muziek",
  Dance: "muziek",
  Klassiek: "muziek",
  Festival: "muziek",
  Comedy: "overig",
  Toneel: "overig",
  Musical: "overig",
  Dans: "overig",
  Sport: "overig",
  Show: "overig",
  Familie: "overig",
  Beurs: "overig",
  Lezing: "overig",
  Overig: "overig",
};

/** Source labels → genre. Tested against the labels the current sources actually use. */
const SOURCE_RULES: [RegExp, Genre][] = [
  [/klassie?k|classic|klassik|orchest|chorale?|choral|opera|oper\b|kamermuziek/i, "Klassiek"],
  [/\b(dance|techno|house|trance|hardstyle|hardcore|electro|edm|drum ?(&|and) ?bass|party|tanzveranstaltung|rave|clubnacht|clubavond)\b/i, "Dance"],
  [/festival/i, "Festival"],
  [/comedy|humou?r|cabaret|kabarett|stand-?up|kleinkunst/i, "Comedy"],
  [/sport|eishockey|voetbal|fu(ss|ß)ball|handbal|basketbal|tennis|darts|boxen|wielren|wielerzesdaagse/i, "Sport"],
  [/familie|famille|kinder|kids|jeugd|jeunesse/i, "Familie"],
  [/beurs|messe|markt|expo|tentoonstelling|evenementen|börse|business|zakelijk|congres/i, "Beurs"],
  [/lezing|lezingen|kennis|debat|speaker|talk|podcast|literatuur|literair|theatercollege|lesung/i, "Lezing"],
  [/\b(workshop|livestream|hangout|handwerk|for dinner|filmavond|film|expositie|educatie|onderwijs)\b/i, "Overig"],
  [/theaterconcert|muziektheater ?concert/i, "Concert"],
  [/musical|com[ée]die musicale/i, "Musical"],
  [/ballet|ballett|\bdans\b|\bdance theat|tanztheater/i, "Dans"],
  [/show|circus|cirque|entertainment|amusement|magie|goochel/i, "Show"],
  [/toneel|theater|theatre|th[ée]âtre|schauspiel|komedie|kom[öo]die|voorstelling/i, "Toneel"],
  [/concert|konzert|muziek|music|musik|pop|rock|metal|hip ?hop|rap|jazz|blues|soul|funk|indie|punk|schlager|nederlands|dutch|singer|k-pop|reggae|latin|wereld|world|folk|country|r&b|urban|alternati/i, "Concert"],
];

const TITLE_RULES: [RegExp, Genre][] = [
  // Sport: fixtures and competitions
  [/\b(fc|sv|vfl|tsv|bvb|ajax|feyenoord|vitesse|psv|fortuna|haie|uefa|bundesliga|eredivisie|keuken kampioen|champions league|europa league|conference league|nations league|world cup|wk|ek|handball|basketball|volleyball|eishockey|darts|boxing|boksen|glory|wwe|ufc|monster jam|supercross|turnkunst|interland|league|cup|meisterschaft|championship|grand prix|zesdaagse)\b/i, "Sport"],
  [/\bvs\.?\s/i, "Sport"],
  [/\b(wrestling|wxw|worldcup|marathon|basket\w*|korfbal|ijshockey|turnen)\b/i, "Sport"],
  // Comedy
  [/\b(comedy|comedian|comedians|cabaret|kabarett|stand-?up|lacht?|lachende|humou?r)\b/i, "Comedy"],
  // Fairs and markets
  [/\w*(beurs|messe|börse|boerse|markt|quiz)\b|\b(comic ?con|tattoo ?con)\b/i, "Beurs"],
  [/\b(esports?|e-sports|iem|gaming|lan ?party|tattoo\w*|banen\w*|open dag|opendag|congres\w*)\b/i, "Beurs"],
  [/\b(beurs|messe|börse|boerse|snuffelmarkt|vlooienmarkt|rommelmarkt|markt|expo|convention|congres|kongress|fair|cards & games|woonbeurs|studiekeuze|jobmedi|karrieremesse|banenmarkt|kerstmarkt|wintermarkt|kerstfair)\b/i, "Beurs"],
  [/\b(workshop|yoga|linedance|creatief|gebaren|popquiz|cursus|rondleiding|filosofisch\w*|gesprekk?en|talkshow|wetenschap\w*|rouwen)\b/i, "Overig"],
  [/\b(\w*musical|illusionists?|illusie\w*|goochel\w*)\b/i, "Show"],
  [/\b(company(?=\s*:)|compagnie|cabaretcollege|toneelgroep|theatergroep|volkstoneel|tejater|monoloog|voorstelling)\b/i, "Toneel"],
  // Family
  [/\b(sinterklaas|sint|kerstcircus|paw patrol|peppa|bluey|disney|nijntje|k3|studio 100|kinderen voor kinderen|kids|kinder)\b|\(\s*\d+\+\s*\)|\b\d+\+\s*$/i, "Familie"],
  // Shows
  [/\b(holiday on ice|on ice|circus|zirkus|cirque|musical|ballet|ballett|theater|theatre|magie|magic|let.?s dance|freek vonk|quiz|bingo|lezing|podcast|talk|book talks|gala)\b/i, "Show"],
  // Music signals
  [/\b(in concert|live in concert|symphon\w*|philharmon\w*|philzuid|orchestra|orkest|\w*orkest|klassiek|requiem|passion|messiah|matth[äa]us|strijkkwartet|kamermuziek|pianoconcert|vioolconcert)\b/i, "Klassiek"],
  [/\b(festival|fest)\b/i, "Festival"],
  [/\b(rave|techno|hardstyle|trance|dj|b2b|club|party|xxl|edm)\b/i, "Dance"],
  [/\b(tour|live|band|tribute|unplugged|acoustic|akoestisch|album|sings|zingt|feat\.?|ft\.?|& friends|en vrienden|und band|\w*concert|\w*konzert|koor|mannenkoor|harmonie|fanfare|blaasmuziek|brassband|bigband|big band|soundsystem|songs)\b/i, "Concert"],
];

export interface Corrections {
  muziek: string[];
  overig: Record<string, Genre> | string[];
}

let cache: { muziek: string[]; overig: [string, Genre][] } | undefined;

/** Reads config/categorie-correcties.yml (missing file = no corrections). */
export function loadCorrections(path = "config/categorie-correcties.yml"): { muziek: string[]; overig: [string, Genre][] } {
  if (cache && path === "config/categorie-correcties.yml") return cache;
  const raw = existsSync(path) ? (parse(readFileSync(path, "utf8")) as Partial<Record<string, unknown>> | null) : null;
  const muziek = Array.isArray(raw?.muziek) ? (raw!.muziek as unknown[]).map(String) : [];
  const overigRaw = raw?.overig;
  const overig: [string, Genre][] = Array.isArray(overigRaw)
    ? (overigRaw as unknown[]).map((t) => [String(t), "Overig"])
    : overigRaw && typeof overigRaw === "object"
      ? Object.entries(overigRaw as Record<string, string>).map(([t, g]) => [t, (Object.keys(GROUP_OF).includes(g) ? g : "Overig") as Genre])
      : [];
  const result = { muziek, overig };
  if (path === "config/categorie-correcties.yml") cache = result;
  return result;
}

const lower = (s: string) => s.toLowerCase().normalize("NFD").replace(/[̀-ͯ]/g, "");

export function classify(title: string, sourceCategory?: string, corrections = loadCorrections(), venueType?: "theater" | "club"): Classification {
  const t = lower(title);
  const pinnedOther = corrections.overig.find(([p]) => t.includes(lower(p)));
  if (pinnedOther) return { category: "overig", genre: pinnedOther[1], reason: "correctie" };
  if (corrections.muziek.some((p) => t.includes(lower(p)))) return { category: "muziek", genre: "Concert", reason: "correctie" };

  if (sourceCategory) {
    for (const [re, genre] of SOURCE_RULES) if (re.test(sourceCategory)) return { category: GROUP_OF[genre], genre, reason: "bron" };
  }
  for (const [re, genre] of TITLE_RULES) if (re.test(title)) return { category: GROUP_OF[genre], genre, reason: "titel" };
  // "Team A - Team B" without music words is almost always a match.
  if (/^[\p{L}0-9 .'’]+ [-–] [\p{L}0-9 .'’]+$/u.test(title.trim()) && /\b(jong|united|city|sc|rc|rot|blau|weiss|wei(ß|ss))\b/i.test(title)) {
    return { category: "overig", genre: "Sport", reason: "titel" };
  }
  if (venueType === "theater") return { category: "overig", genre: "Toneel", reason: "gok" };
  if (venueType === "club") return { category: "muziek", genre: "Dance", reason: "gok" };
  return { category: "muziek", genre: "Concert", reason: "gok" };
}
