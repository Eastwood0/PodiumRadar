import { fetchText } from "../lib/http";
import { localToIso, TZ_BY_COUNTRY } from "../lib/dates";
import type { Adapter, SourceEvent } from "./types";

const BASE = "https://www.iamsterdam.com";
/** Sections of the city agenda that hold concerts and club nights; robots.txt allows only `?page=` on them. */
const SECTIONS = ["concerten-en-muziek", "nachtleven"];
const MAX_PAGES = 80;

/**
 * "Uit in Amsterdam" (iamsterdam.com, Amsterdam & Partners, the city's official agenda, B23/B34). Used for Melkweg,
 * whose own site sends a bot check (B37), and Paradiso, whose own site loads its programme with JavaScript.
 * The agenda pages are a Next.js app; the event cards are in the page's RSC payload (`self.__next_f.push`).
 * Each card has title, slug, `date` (first and last date), the location and tags. Card times are local wall-clock
 * times even though they end in "Z" (checked against the venues' own sites, 26 Nov 2026). Cards spanning several
 * days are read from their detail page, which lists every date (`eventDates`) and the sold-out/cancelled flags.
 */
export const IAMSTERDAM_LOCATIONS: Record<string, string> = { Melkweg: "melkweg", Paradiso: "paradiso" };

export interface IamsCard {
  title: string;
  slug: string;
  dates: string[];
  location?: string;
  timeLabel?: string;
}

/** The text that the page pushes into `self.__next_f`, decoded from its JavaScript string literals. */
export function rscText(html: string): string {
  const parts: string[] = [];
  for (const m of html.matchAll(/self\.__next_f\.push\((\[1,"(?:[^"\\]|\\.)*"\])\)/g)) {
    try {
      parts.push((JSON.parse(m[1]) as [number, string])[1]);
    } catch {
      // a chunk that is not a plain string literal carries no event data
    }
  }
  return parts.join("");
}

/** Every JSON object in `text` that starts with `{"id":…,"type":"Event"` (balanced braces, strings respected). */
function eventObjects(text: string): Record<string, unknown>[] {
  const out: Record<string, unknown>[] = [];
  const re = /\{"id":"[0-9a-f-]{36}","type":"Event"/g;
  for (let m = re.exec(text); m; m = re.exec(text)) {
    let depth = 0;
    let inString = false;
    for (let i = m.index; i < text.length; i++) {
      const ch = text[i];
      if (inString) {
        if (ch === "\\") i++;
        else if (ch === '"') inString = false;
      } else if (ch === '"') inString = true;
      else if (ch === "{") depth++;
      else if (ch === "}" && --depth === 0) {
        try {
          out.push(JSON.parse(text.slice(m.index, i + 1)) as Record<string, unknown>);
        } catch {
          // truncated or templated object ("$3d:…" references): skip it
        }
        re.lastIndex = i;
        break;
      }
    }
  }
  return out;
}

export function parseIamsterdamPage(html: string): { cards: IamsCard[]; total?: number } {
  const text = rscText(html);
  const cards: IamsCard[] = [];
  for (const o of eventObjects(text)) {
    const highlights = Array.isArray(o.highlights) ? (o.highlights as { id?: string; label?: string }[]) : [];
    if (typeof o.title !== "string" || typeof o.slug !== "string" || !Array.isArray(o.date)) continue;
    cards.push({
      title: o.title.trim(),
      slug: o.slug,
      dates: (o.date as unknown[]).filter((d): d is string => typeof d === "string"),
      location: highlights.find((h) => h.id === "location")?.label,
      timeLabel: highlights.find((h) => h.id === "date")?.label,
    });
  }
  const total = Number(text.match(/"total":(\d+)\}/)?.[1]);
  return { cards, total: Number.isFinite(total) ? total : undefined };
}

/** Dates and flags from an event's detail page. */
export function parseIamsterdamDetail(html: string): { dates: string[]; soldOut: boolean; cancelled: boolean } {
  const text = rscText(html);
  const i = text.indexOf('"eventDates":[');
  if (i < 0) return { dates: [], soldOut: false, cancelled: false };
  const list = text.slice(i + 13, text.indexOf("]", i) + 1);
  const dates = [...list.matchAll(/"from":"([^"]+)"/g)].map((m) => m[1]);
  const tail = text.slice(i, i + 3000);
  return { dates, soldOut: /"soldOut":true/.test(tail), cancelled: /"cancelled":true/.test(tail) };
}

/** "2026-11-26T19:30:00.000Z" read as Amsterdam wall-clock time (see above). 23:59 means "no time given". */
function wallClock(value: string): { start: string; hasTime: boolean } | undefined {
  const m = value.match(/^(\d{4})-(\d{2})-(\d{2})T(\d{2}):(\d{2})/);
  if (!m) return undefined;
  const time = m[4] === "23" && m[5] === "59" ? undefined : `${m[4]}:${m[5]}`;
  return localToIso(Number(m[1]), Number(m[2]), Number(m[3]), time, TZ_BY_COUNTRY.NL);
}

const spansDays = (dates: string[]) => new Set(dates.map((d) => d.slice(0, 10))).size > 1;

export function cardEvents(card: IamsCard, dates: string[], flags = { soldOut: false, cancelled: false }): SourceEvent[] {
  const venueId = card.location ? IAMSTERDAM_LOCATIONS[card.location] : undefined;
  if (!venueId) return [];
  const url = `${BASE}/${card.slug}`;
  const out: SourceEvent[] = [];
  for (const d of new Set(dates)) {
    const when = wallClock(d);
    if (!when) continue;
    out.push({
      venueId,
      title: card.title,
      start: when.start,
      hasTime: when.hasTime,
      status: flags.cancelled ? "geannuleerd" : flags.soldOut ? "uitverkocht" : "gepland",
      url,
      sourceId: `${card.slug}|${d.slice(0, 16)}`,
    });
  }
  return out;
}

export const iamsterdam: Adapter = {
  name: "iamsterdam.com",
  venues: [...new Set(Object.values(IAMSTERDAM_LOCATIONS))],
  async fetch() {
    const cards = new Map<string, IamsCard>();
    for (const section of SECTIONS) {
      for (let p = 1; p <= MAX_PAGES; p++) {
        const { cards: page } = parseIamsterdamPage((await fetchText(`${BASE}/uit/agenda/${section}?page=${p}`)).body);
        if (!page.length) break;
        for (const c of page) if (c.location && IAMSTERDAM_LOCATIONS[c.location]) cards.set(c.slug, c);
      }
    }
    if (!cards.size) throw new Error("iamsterdam.com: geen Melkweg- of Paradiso-events gevonden");
    const out: SourceEvent[] = [];
    for (const card of cards.values()) {
      if (!spansDays(card.dates)) {
        out.push(...cardEvents(card, card.dates.slice(0, 1)));
        continue;
      }
      try {
        const detail = parseIamsterdamDetail((await fetchText(`${BASE}/${card.slug}`)).body);
        out.push(...cardEvents(card, detail.dates.length ? detail.dates : card.dates.slice(0, 1), detail));
      } catch (e) {
        console.warn(`iamsterdam.com: ${card.slug} alleen eerste datum (${String(e)})`);
        out.push(...cardEvents(card, card.dates.slice(0, 1)));
      }
    }
    return out;
  },
};
