import { fetchText } from "../lib/http";
import { localToIso, TZ_BY_COUNTRY } from "../lib/dates";
import { statusFrom } from "../lib/normalize";
import type { Adapter, SourceEvent } from "./types";

/**
 * d.live (Düsseldorf): PSD Bank Dome, Merkur Spiel-Arena and Mitsubishi Electric Halle run the same site software.
 * Each calendar page loads its dates from a JSON endpoint on the same site. Level 2 (shared platform, JSON).
 */
interface DliveSite {
  host: string;
  venueId: string;
}

export const DLIVE_SITES: DliveSite[] = [
  { host: "https://www.psd-bank-dome.de", venueId: "psd-bank-dome" },
  { host: "https://www.merkur-spiel-arena.de", venueId: "merkur-spiel-arena" },
  { host: "https://www.mitsubishi-electric-halle.de", venueId: "mitsubishi-electric-halle" },
];

interface DliveDate {
  id: string;
  title?: string;
  description?: string;
  type?: string;
  status?: string;
  url_detail?: string;
  image?: string;
  links?: { title?: string; url?: string; vip_link?: boolean }[];
  date?: { starting_time?: string | null; opening_time?: string | null; formatted?: string | null };
}

const STATUS: Record<string, SourceEvent["status"]> = { canceled: "geannuleerd", cancelled: "geannuleerd", postponed: "verplaatst", postponed_pending: "verplaatst", soldout: "uitverkocht", sold_out: "uitverkocht" };

/**
 * The feed writes local wall-clock time with a "Z" suffix ("20:30:00.000Z" for a 20:30 show; checked against
 * the event page on 25 Nov 2026), so the suffix is ignored and the time is read as Düsseldorf time.
 */
function wallClock(value: string | null | undefined): { start: string; hasTime: boolean } | undefined {
  const m = value?.match(/^(\d{4})-(\d{2})-(\d{2})T(\d{2}):(\d{2})/);
  if (!m) return undefined;
  const time = m[4] === "00" && m[5] === "00" ? undefined : `${m[4]}:${m[5]}`;
  return localToIso(+m[1], +m[2], +m[3], time, TZ_BY_COUNTRY.DE);
}

export function parseDlive(json: string, site: DliveSite): SourceEvent[] {
  const data = JSON.parse(json) as { dates?: DliveDate[] };
  if (!Array.isArray(data.dates)) throw new Error(`${site.host}: onverwacht antwoord van de kalender`);
  const out: SourceEvent[] = [];
  for (const d of data.dates) {
    const when = wallClock(d.date?.starting_time ?? d.date?.formatted);
    if (!d.title || !when || !d.url_detail) continue;
    const ticket = d.links?.find((l) => !l.vip_link && /ticket/i.test(l.title ?? ""))?.url;
    out.push({
      venueId: site.venueId,
      title: d.title.trim(),
      start: when.start,
      hasTime: when.hasTime,
      status: STATUS[d.status ?? ""] ?? statusFrom(d.status),
      sourceCategory: d.type,
      url: new URL(d.url_detail, site.host).href,
      ticketUrl: ticket?.startsWith("http") ? ticket : undefined,
      sourceId: d.id,
      imageUrl: d.image?.startsWith("http") ? d.image : undefined,
    });
  }
  return out;
}

export function dliveAdapter(site: DliveSite): Adapter {
  return {
    name: new URL(site.host).hostname.replace(/^www\./, ""),
    venues: [site.venueId],
    async fetch() {
      const { body } = await fetchText(`${site.host}/events-tickets/eventkalender/dates?total=500&vip=false`, "application/json");
      return parseDlive(body, site);
    },
  };
}

export const dliveVenues = DLIVE_SITES.map(dliveAdapter);
