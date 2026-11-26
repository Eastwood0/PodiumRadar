import { fetchText } from "../lib/http";
import { localToIso, monthNumber, TZ_BY_COUNTRY } from "../lib/dates";
import type { Adapter, SourceEvent } from "./types";

const API = "https://www.mezz.nl/wp-json/wp/v2/event";
const PER_PAGE = 100;

interface MezzEvent {
  id: number;
  class_list?: string[];
  event?: { start?: string; short_description?: string; remark?: string; status?: string; ticket_url_iframe?: string };
  prod?: { title?: string; link?: string };
}

/**
 * Mezz (Breda): the programme page loads its events from the site's own WordPress API (B24), 100 per page,
 * with a Dutch date ("26 november 2026"), a sale status ("_soldout", "_onsale") and genre tags in class_list.
 * Shows sold "via Chassé" take place in the Chassé theatre and are skipped.
 */
export function parseMezz(json: string): SourceEvent[] {
  const list = JSON.parse(json) as MezzEvent[];
  if (!Array.isArray(list)) throw new Error("Mezz: onverwacht antwoord van de API");
  const out: SourceEvent[] = [];
  for (const e of list) {
    const title = e.prod?.title?.trim();
    const m = e.event?.start?.match(/^(\d{1,2})\s+([a-z]+)\s+(\d{4})$/i);
    const month = m && monthNumber(m[2]);
    const status = e.event?.status ?? "";
    if (!title || !m || !month || !e.prod?.link || /via chass/i.test(status)) continue;
    const when = localToIso(Number(m[3]), month, Number(m[1]), undefined, TZ_BY_COUNTRY.NL);
    const tags = (e.class_list ?? []).filter((c) => /^(tag|category)-/.test(c)).map((c) => c.replace(/^(tag|category)-/, "").replace(/-/g, " "));
    out.push({
      venueId: "mezz",
      title,
      start: when.start,
      hasTime: false,
      status: status === "_soldout" ? "uitverkocht" : status === "_cancelled" ? "geannuleerd" : "gepland",
      sourceCategory: tags.join(", ") || undefined,
      url: e.prod.link,
      ticketUrl: e.event?.ticket_url_iframe?.startsWith("http") ? e.event.ticket_url_iframe : undefined,
      sourceId: String(e.id),
    });
  }
  return out;
}

export const mezz: Adapter = {
  name: "mezz.nl",
  venues: ["mezz"],
  async fetch() {
    const out: SourceEvent[] = [];
    for (let page = 1; page <= 5; page++) {
      const url = `${API}?page=${page}&per_page=${PER_PAGE}&filter[orderby]=event_date&order=asc`;
      const res = await fetchText(url, "application/json").catch((e: unknown) => {
        if (page > 1) return null; // WordPress answers 400 past the last page
        throw e;
      });
      if (!res) break;
      const batch = parseMezz(res.body);
      out.push(...batch);
      if (JSON.parse(res.body).length < PER_PAGE) break;
    }
    if (!out.length) throw new Error("Mezz: geen events");
    return out;
  },
};
