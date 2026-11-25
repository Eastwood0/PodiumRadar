import { fetchText } from "../lib/http";
import { localToIso, TZ_BY_COUNTRY } from "../lib/dates";
import type { Adapter, SourceEvent } from "./types";

const BASE = "https://www.ziggodome.nl";
const PAGE_SIZE = 50;

interface ZdShow {
  id: string;
  eventId?: string;
  showDate: string; // "2026-11-26 19:00:00", local time
  showTimeUnknown?: number;
  showState?: string;
  salesUrl?: string;
  salesStartDate?: string | null;
  performerName?: string;
  event?: { title?: string };
  /** Sometimes an array, sometimes a JSON string of one. */
  genres?: { name?: string }[] | string;
  privateEvent?: number;
  visible?: number;
}

const STATE: Record<string, SourceEvent["status"]> = { SoldOut: "uitverkocht", Canceled: "geannuleerd", Cancelled: "geannuleerd", Postponed: "verplaatst", Rescheduled: "verplaatst" };

function genreNames(g: ZdShow["genres"]): string | undefined {
  let list: unknown = g;
  if (typeof g === "string") {
    try {
      list = JSON.parse(g);
    } catch {
      return undefined;
    }
  }
  return Array.isArray(list) ? list.map((x) => (x as { name?: string })?.name).filter(Boolean).join(", ") || undefined : undefined;
}

const localIso = (s: string, withTime: boolean) => {
  const m = s.match(/^(\d{4})-(\d{2})-(\d{2})[ T](\d{2}):(\d{2})/);
  return m ? localToIso(+m[1], +m[2], +m[3], withTime ? `${m[4]}:${m[5]}` : undefined, TZ_BY_COUNTRY.NL) : undefined;
};

/** Parses one page of the agenda API the Ziggo Dome website itself uses. Level 1 (JSON). */
export function parseZiggoDome(json: string): { events: SourceEvent[]; hasMore: boolean } {
  const data = JSON.parse(json) as { data?: ZdShow[]; pagination?: { hasMore?: boolean } };
  if (!Array.isArray(data.data)) throw new Error("Ziggo Dome: onverwacht antwoord van de agenda");
  const events: SourceEvent[] = [];
  for (const s of data.data) {
    if (s.privateEvent || s.visible === 0 || !s.performerName) continue;
    const when = localIso(s.showDate, !s.showTimeUnknown);
    if (!when) continue;
    const onSale = s.salesStartDate ? localIso(s.salesStartDate, true)?.start : undefined;
    events.push({
      venueId: "ziggo-dome",
      title: s.performerName.trim(),
      artists: [s.performerName.trim()],
      start: when.start,
      hasTime: when.hasTime,
      status: STATE[s.showState ?? ""],
      sourceCategory: genreNames(s.genres),
      url: `${BASE}/agenda/`,
      ticketUrl: s.salesUrl?.startsWith("http") ? s.salesUrl : undefined,
      sourceId: s.id,
      onSaleStart: onSale && Date.parse(onSale) > Date.now() ? onSale : undefined,
    });
  }
  return { events, hasMore: Boolean(data.pagination?.hasMore) };
}

export const ziggoDome: Adapter = {
  name: "ziggodome.nl",
  venues: ["ziggo-dome"],
  async fetch() {
    const all: SourceEvent[] = [];
    for (let offset = 0; offset < 2000; offset += PAGE_SIZE) {
      const { body } = await fetchText(`${BASE}/api/agenda/aankomend/?limit=${PAGE_SIZE}&offset=${offset}`, "application/json");
      const { events, hasMore } = parseZiggoDome(body);
      all.push(...events);
      if (!hasMore) break;
    }
    return all;
  },
};
