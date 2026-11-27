import { fetchText } from "../lib/http";
import { localToIso, TZ_BY_COUNTRY } from "../lib/dates";
import type { Adapter, SourceEvent } from "./types";

/**
 * City marketing agendas on the shared "plaece" platform (Visit Maastricht, Visit Groningen; B52). Used as a partial
 * source for venues without a source of their own: Theater aan het Vrijthof and MartiniPlaza. Each agenda page carries
 * an ItemList of schema.org Events with the location and every performance in `eventSchedule` (the Event's own
 * startDate is the publication time, not the show). robots.txt asks for 2 s between requests (Crawl-delay, B47).
 */
export interface PlaeceSite {
  name: string;
  /** Agenda list URL; pages are `?page=N` (allowed by robots.txt). */
  list: string;
  /** Location name → our venue. */
  venues: [RegExp, string][];
  maxPages: number;
}

interface PlaeceItem {
  name?: string;
  URL?: string;
  url?: string;
  location?: { name?: string };
  eventSchedule?: { startDate?: string }[];
}

/** Items of the page's ItemList (empty when the page has none: past the last page). */
export function plaeceItems(html: string): PlaeceItem[] {
  for (const m of html.matchAll(/<script type="application\/ld\+json"[^>]*>([\s\S]*?)<\/script>/g)) {
    try {
      const data = JSON.parse(m[1]) as unknown;
      const lists = (Array.isArray(data) ? data : [data]) as { "@type"?: string; itemListElement?: { item?: PlaeceItem }[] }[];
      const list = lists.find((d) => d?.["@type"] === "ItemList");
      if (list) return (list.itemListElement ?? []).map((x) => x.item).filter((x): x is PlaeceItem => !!x);
    } catch {
      // other JSON-LD blocks (breadcrumbs, organisation) can be malformed; they hold no events
    }
  }
  return [];
}

/** One event per performance at one of our venues; performances without a time get the day only. */
export function plaeceEvents(items: PlaeceItem[], venues: PlaeceSite["venues"]): SourceEvent[] {
  const out: SourceEvent[] = [];
  for (const it of items) {
    const venueId = venues.find(([re]) => re.test(it.location?.name ?? ""))?.[1];
    const url = it.URL ?? it.url;
    const title = it.name?.trim();
    if (!venueId || !title || !url?.startsWith("https://")) continue;
    for (const s of it.eventSchedule ?? []) {
      const m = s.startDate?.match(/^(\d{4})-(\d{2})-(\d{2})(?:T(\d{2}):(\d{2}))?/);
      if (!m) continue;
      const time = m[4] && !(m[4] === "00" && m[5] === "00") ? `${m[4]}:${m[5]}` : undefined;
      const when = localToIso(Number(m[1]), Number(m[2]), Number(m[3]), time, TZ_BY_COUNTRY.NL);
      out.push({ venueId, title, start: when.start, hasTime: when.hasTime, url, sourceId: `${url}|${when.start}` });
    }
  }
  return out;
}

export function plaeceAdapter(site: PlaeceSite): Adapter {
  return {
    name: site.name,
    venues: [...new Set(site.venues.map(([, id]) => id))],
    async fetch() {
      const out: SourceEvent[] = [];
      let seen = 0;
      for (let n = 1; n <= site.maxPages; n++) {
        const items = plaeceItems((await fetchText(n === 1 ? site.list : `${site.list}?page=${n}`)).body);
        if (!items.length) break;
        seen += items.length;
        out.push(...plaeceEvents(items, site.venues));
      }
      if (!seen) throw new Error(`${site.name}: geen agenda gevonden`);
      return out;
    },
  };
}

export const visitMaastricht = plaeceAdapter({
  name: "visitmaastricht.com",
  list: "https://www.visitmaastricht.com/nl/uitagenda",
  venues: [[/theater aan het vrijthof/i, "theater-aan-het-vrijthof"]],
  maxPages: 20,
});

export const visitGroningen = plaeceAdapter({
  name: "visitgroningen.nl",
  list: "https://www.visitgroningen.nl/nl/ontdekken/stad/culturele-agenda",
  venues: [[/martini ?plaza/i, "martiniplaza"]],
  maxPages: 60,
});
