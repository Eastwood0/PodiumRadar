import { type CheerioAPI, load } from "cheerio";
import { fetchText } from "../lib/http";
import { localToIso, monthNumber, TZ_BY_COUNTRY } from "../lib/dates";
import { statusFrom } from "../lib/normalize";
import { inferYear } from "./uitagenda-utrecht";
import type { Adapter, SourceEvent } from "./types";

/**
 * Clubs whose agenda is only HTML (B49 route A, Ralf 26 Nov 2026). One parser per site, each tested on a saved
 * page; robots.txt allows every agenda path (checked 26 Nov 2026). Club nights get the label "clubnacht" (Dance & DJ)
 * unless the site gives its own genre. Dates without a year take the next occurrence (inferYear).
 */
const CLUB = "clubnacht";
const NL = TZ_BY_COUNTRY.NL;
const clean = (s: string) => s.replace(/\s+/g, " ").trim();

function make(venueId: string, title: string, y: number, m: number, d: number, time: string | undefined, url: string, extra: Partial<SourceEvent> = {}): SourceEvent {
  const when = localToIso(y, m, d, time, NL);
  return { venueId, title, start: when.start, hasTime: when.hasTime, url, sourceId: `${url}|${when.start}`, sourceCategory: CLUB, ...extra };
}

/** Removes repeats (sites that print the same list for phone and desktop). */
function unique(events: SourceEvent[]): SourceEvent[] {
  const seen = new Set<string>();
  return events.filter((e) => !seen.has(e.sourceId) && seen.add(e.sourceId));
}

function fail(name: string, out: SourceEvent[]): SourceEvent[] {
  if (!out.length) throw new Error(`${name}: geen events gevonden`);
  return out;
}

/** RADION (Amsterdam): `a.r-event-row` with day, ".11" and title, under month headings ("December 2026"). */
export function parseRadion(html: string, today = new Date()): SourceEvent[] {
  const $ = load(html);
  const out: SourceEvent[] = [];
  let year: number | undefined;
  $(".r-events__month, a.r-event-row").each((_, el) => {
    const node = $(el);
    if (node.hasClass("r-events__month")) {
      year = Number(node.text().match(/\b(20\d\d)\b/)?.[1]) || year;
      return;
    }
    const d = Number(node.find(".r-event-row__date span").first().text());
    const m = Number(node.find(".r-event-row__date .is-month").text().replace(/\D/g, ""));
    const title = clean(node.find(".r-event-row__title").text());
    const url = node.attr("href") ?? "";
    if (!d || !m || !title || !url.startsWith("https://")) return;
    out.push(make("radion", title, year ?? inferYear(d, m, today), m, d, undefined, url));
  });
  return fail("RADION", unique(out));
}

/** Shelter (Amsterdam): `article.event` with "Friday 27.11", room times ("Club 22:00 - 06:00"), title and DJs. */
export function parseShelter(html: string, today = new Date()): SourceEvent[] {
  const $ = load(html);
  const out: SourceEvent[] = [];
  $("article.event").each((_, el) => {
    const node = $(el);
    const dm = node.find(".event-date__value").first().text().match(/(\d{1,2})\.(\d{1,2})/);
    const title = clean(node.find(".event-title").first().text());
    const url = node.find("a[href]").first().attr("href") ?? "";
    if (!dm || !title || !url.startsWith("https://")) return;
    const time = node.find(".event-room-title-time").first().text().match(/(\d{1,2}:\d{2})/)?.[1];
    const artists = node.find(".event-artist").map((_, a) => clean($(a).text())).get().filter(Boolean);
    const [d, m] = [Number(dm[1]), Number(dm[2])];
    out.push(make("shelter", title, inferYear(d, m, today), m, d, time, url, { artists: artists.length ? artists : undefined, ticketUrl: url }));
  });
  return fail("Shelter", unique(out));
}

/** EKKO (Utrecht): `a.event-line-item` with "do 26 nov", title (h3) and a category button (Club, Concert…). */
export function parseEkko(html: string, today = new Date()): SourceEvent[] {
  const $ = load(html);
  const out: SourceEvent[] = [];
  $("a.event-line-item").each((_, el) => {
    const node = $(el);
    const url = node.attr("href") ?? "";
    const title = clean(node.find("h3").first().text());
    const dm = clean(node.text()).match(/\b(\d{1,2})\s+([a-z]{3,})\b/i);
    const m = dm && monthNumber(dm[2]);
    const category = clean(node.find("button").first().text());
    // Only event pages: the agenda also lists the café's meals ("Eten in EKKO").
    if (!url.startsWith("https://ekko.nl/event/") || !title || !dm || !m || /eten|food|diner/i.test(category)) return;
    const d = Number(dm[1]);
    out.push(make("ekko", title, inferYear(d, m, today), m, d, undefined, url, { sourceCategory: /club/i.test(category) ? CLUB : category || undefined }));
  });
  return fail("EKKO", unique(out));
}

/** Dynamo (Eindhoven): cards linking to /evenement/ with "vr 27-nov-2026", hall, title (h3) and a genre icon. */
export function parseDynamo(html: string): SourceEvent[] {
  const $ = load(html);
  const out: SourceEvent[] = [];
  $("a[href*='/evenement/']:has(h3)").each((_, el) => {
    const node = $(el);
    const url = node.attr("href") ?? "";
    const title = clean(node.find("h3").first().text());
    const dm = clean(node.find(".font-bold.uppercase").first().text()).match(/(\d{1,2})-([a-z]{3})-(\d{4})/i);
    const m = dm && monthNumber(dm[2]);
    if (!url.startsWith("https://") || !title || !dm || !m) return;
    // The icon is Dynamo's programme line (heavy, haven, queer, commit…); only "heavy" says something about the music.
    const icon = node.parent().find("img[src*='/favicons/']").attr("src")?.match(/favicons\/([a-z-]+)\.svg/)?.[1];
    const support = clean(node.find(".h6").first().text()).replace(/^support:\s*/i, "");
    out.push(
      make("dynamo-eindhoven", title, Number(dm[3]), m, Number(dm[1]), undefined, url, {
        artists: [title, ...support.split(/\s*\+\s*/).filter(Boolean)],
        status: statusFrom(node.text()) ?? "gepland",
        sourceCategory: icon === "heavy" ? "metal" : undefined,
      }),
    );
  });
  return fail("Dynamo", unique(out));
}

/** Thuishaven (Amsterdam): blocks with "28 NOV | title", "28-11-2026", "13.00 – 23.00" and "Genre: Techno". */
export function parseThuishaven(html: string): SourceEvent[] {
  const $ = load(html);
  $("style,script").remove();
  const out: SourceEvent[] = [];
  $(".agenda-details__date").each((_, el) => {
    const block = $(el).closest(".vc_row:not(.vc_inner)");
    const text = clean(block.text());
    const dm = clean($(el).text()).match(/(\d{1,2})-(\d{1,2})-(\d{4})/);
    const heading = clean(block.find("h1, h2, h3, h4, h5").first().text());
    const title = heading.replace(/^\d{1,2}\s+[a-z]{3,}\.?\s*\|\s*/i, "");
    const url = block.find("a[href^='https://thuishaven.nl/']").first().attr("href") ?? "";
    if (!dm || !title || !url) return;
    const time = text.match(/(\d{1,2})[.:](\d{2})\s*[–-]/);
    const genre = text.match(/genre:\s*([^|]+?)(?=\s+\d{1,2}-\d{1,2}-\d{4}|$)/i)?.[1];
    out.push(make("thuishaven", title, Number(dm[3]), Number(dm[2]), Number(dm[1]), time ? `${time[1]}:${time[2]}` : undefined, url, { sourceCategory: genre ? `${CLUB}, ${genre}` : CLUB }));
  });
  return fail("Thuishaven", unique(out));
}

/** Annabel (Rotterdam): loop items with title, "vrijdag 27 november" and categories in the class list. */
export function parseAnnabel(html: string, today = new Date()): SourceEvent[] {
  const $ = load(html);
  $("style,script").remove();
  const out: SourceEvent[] = [];
  $(".e-loop-item").each((_, el) => {
    const node = $(el);
    const url = node.find("a[href^='https://annabel.nu/']").first().attr("href") ?? "";
    const title = clean(node.find(".elementor-heading-title").last().text());
    const dm = clean(node.text()).match(/(?:maandag|dinsdag|woensdag|donderdag|vrijdag|zaterdag|zondag)\s+(\d{1,2})\s+([a-z]+)/i);
    const m = dm && monthNumber(dm[2]);
    if (!url || !title || !dm || !m) return;
    const categories = (node.attr("class") ?? "").match(/category-[a-z-]+/g)?.map((c) => c.slice(9)) ?? [];
    const d = Number(dm[1]);
    out.push(make("annabel", title, inferYear(d, m, today), m, d, undefined, url, { sourceCategory: categories.join(", ") || undefined }));
  });
  return fail("Annabel", unique(out));
}

/** Toffler (Rotterdam): per night a block with "Saturday 28.11", title, line-up and a tickets button. */
export function parseToffler(html: string, today = new Date()): SourceEvent[] {
  const $: CheerioAPI = load(html);
  const isTickets = (a: unknown) => /tickets/i.test($(a as never).text());
  const out: SourceEvent[] = [];
  $(".e-con")
    .filter((_, e) => $(e).find("a").filter((_, a) => isTickets(a)).length === 1 && !$(e).children(".e-con, .e-con-inner").find("a").filter((_, a) => isTickets(a)).length)
    .each((_, el) => {
      const parts = $(el)
        .find(".elementor-widget-text-editor")
        .map((_, t) => clean($(t).text()))
        .get()
        .filter(Boolean);
      const dm = parts[0]?.match(/(\d{1,2})\.(\d{1,2})/);
      const title = parts[1];
      const ticket = $(el).find("a").filter((_, a) => isTickets(a)).attr("href") ?? "";
      if (!dm || !title || !ticket.startsWith("https://")) return;
      const lineup = parts[2] && !/^tba$/i.test(parts[2]) ? parts[2].split(/\s*,\s*/) : undefined;
      const [d, m] = [Number(dm[1]), Number(dm[2])];
      out.push(make("toffler", title, inferYear(d, m, today), m, d, undefined, "https://www.toffler.nl/club/", { artists: lineup, ticketUrl: ticket, sourceId: `toffler|${d}-${m}|${title}` }));
    });
  return fail("Toffler", unique(out));
}

function htmlAdapter(name: string, venueId: string, url: string, parse: (html: string) => SourceEvent[]): Adapter {
  return { name, venues: [venueId], fetch: async () => parse((await fetchText(url)).body) };
}

export const radion = htmlAdapter("radion.amsterdam", "radion", "https://radion.amsterdam/program/", (h) => parseRadion(h));
export const shelter = htmlAdapter("shelteramsterdam.nl", "shelter", "https://shelteramsterdam.nl/", (h) => parseShelter(h));
export const ekko = htmlAdapter("ekko.nl", "ekko", "https://ekko.nl/agenda/", (h) => parseEkko(h));
export const dynamo = htmlAdapter("dynamo-eindhoven.nl", "dynamo-eindhoven", "https://www.dynamo-eindhoven.nl/evenementen/", parseDynamo);
export const thuishaven = htmlAdapter("thuishaven.nl", "thuishaven", "https://thuishaven.nl/", parseThuishaven);
export const annabel = htmlAdapter("annabel.nu", "annabel", "https://annabel.nu/agenda/", (h) => parseAnnabel(h));
export const toffler = htmlAdapter("toffler.nl", "toffler", "https://www.toffler.nl/club/", (h) => parseToffler(h));
