import { load } from "cheerio";

/** A schema.org Event as found in a page, before normalisation. */
export interface RawJsonLdEvent {
  type: string;
  name?: string;
  startDate?: string;
  endDate?: string;
  url?: string;
  locationName?: string;
  eventStatus?: string;
  offersUrl?: string;
  performers: string[];
  image?: string;
}

type Json = unknown;

const isObj = (v: Json): v is Record<string, Json> => typeof v === "object" && v !== null && !Array.isArray(v);
const str = (v: Json): string | undefined => (typeof v === "string" && v.trim() ? v.trim() : undefined);

function types(o: Record<string, Json>): string[] {
  const t = o["@type"];
  return (Array.isArray(t) ? t : [t]).filter((x): x is string => typeof x === "string");
}

function firstStr(v: Json, key: string): string | undefined {
  if (Array.isArray(v)) return v.map((x) => firstStr(x, key)).find(Boolean);
  if (isObj(v)) return str(v[key]);
  return str(v);
}

/** Some sites put the schema.org type instead of a name in the list ("performer": ["Organization"]). */
const SCHEMA_TYPES = /^(organization|person|performinggroup|musicgroup|theatergroup|dancegroup|thing)$/i;

function names(v: Json): string[] {
  const list = Array.isArray(v) ? v : v === undefined ? [] : [v];
  return list.map((x) => (isObj(x) ? str(x.name) : str(x))).filter((x): x is string => Boolean(x) && !SCHEMA_TYPES.test(x!.trim()));
}

function toEvent(o: Record<string, Json>, type: string): RawJsonLdEvent {
  return {
    type,
    name: str(o.name),
    startDate: str(o.startDate),
    endDate: str(o.endDate),
    url: str(o.url),
    locationName: firstStr(o.location, "name"),
    eventStatus: str(o.eventStatus),
    offersUrl: firstStr(o.offers, "url"),
    performers: names(o.performer),
    image: firstStr(o.image, "url"),
  };
}

/** Walks any JSON-LD value and collects every object whose @type ends in "Event". */
export function collectEvents(value: Json, out: RawJsonLdEvent[] = [], depth = 0): RawJsonLdEvent[] {
  if (depth > 12) return out;
  if (Array.isArray(value)) {
    for (const v of value) collectEvents(v, out, depth + 1);
    return out;
  }
  if (!isObj(value)) return out;
  const t = types(value).find((x) => /Event$/.test(x));
  if (t) out.push(toEvent(value, t));
  for (const key of ["@graph", "itemListElement", "item", "subEvent", "mainEntity", "event", "events"]) {
    if (key in value) collectEvents(value[key], out, depth + 1);
  }
  return out;
}

/** Extracts schema.org events from all JSON-LD blocks in an HTML page. */
export function extractJsonLdEvents(html: string): { events: RawJsonLdEvent[]; blocks: number; parseErrors: number } {
  const $ = load(html);
  const events: RawJsonLdEvent[] = [];
  let blocks = 0;
  let parseErrors = 0;
  $('script[type="application/ld+json"]').each((_, el) => {
    blocks++;
    const text = $(el).text().trim();
    if (!text) return;
    try {
      collectEvents(JSON.parse(text), events);
    } catch {
      parseErrors++;
    }
  });
  return { events, blocks, parseErrors };
}
