import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";
import { parseAfasLive } from "../scripts/adapters/afas-live";
import { parseEffenaar } from "../scripts/adapters/effenaar";
import { parseJca } from "../scripts/adapters/johan-cruijff-arena";
import { parseLanxess } from "../scripts/adapters/lanxess-arena";
import { fromJsonLd } from "../scripts/adapters/sitemap-jsonld";
import { parseTivoli } from "../scripts/adapters/tivolivredenburg";

// Fixtures are trimmed copies of the real pages (25 Nov 2026). When a site changes its layout,
// these tests keep passing but the live run reports the source as failed or as an outage.
const fixture = (name: string) => readFileSync(`tests/fixtures/${name}`, "utf8");

describe("AFAS Live (HTML)", () => {
  const ev = parseAfasLive(fixture("afaslive-agenda.html"));
  it("reads title, date, url and the time from the ticket link", () => {
    expect(ev).toHaveLength(4);
    expect(ev[0]).toMatchObject({ venueId: "afas-live", title: "We All Sing ABBA", start: "2026-11-25T20:00:00+01:00", hasTime: true, url: "https://www.afaslive.nl/agenda/we-all-sing-abba", sourceId: "6291700" });
  });
  it("leaves the time empty when the page has none", () => {
    expect(ev[1]).toMatchObject({ title: "Quido van de Graaf", hasTime: false });
  });
  it("maps sold-out and moved classes", () => {
    expect(ev[2].status).toBe("uitverkocht");
    expect(ev[3]).toMatchObject({ title: "EsDeeKid", status: "verplaatst" });
  });
});

describe("LANXESS arena (HTML)", () => {
  const ev = parseLanxess(fixture("lanxess-eventkalender.html"));
  it("reads data attributes, time and category", () => {
    expect(ev[0]).toMatchObject({ venueId: "lanxess-arena", title: "Westlife", start: "2026-11-25T19:30:00+01:00", sourceCategory: "Konzert", sourceId: "1281" });
    expect(ev[1]).toMatchObject({ title: "Kölner Haie - Straubing Tigers", sourceCategory: "Eishockey" });
  });
  it("does not read a date like 07.12 as a time, and reads 'Verschoben'", () => {
    expect(ev[2]).toMatchObject({ title: "NIMO", start: "2026-12-07T20:00:00+01:00", status: "verplaatst" });
  });
});

describe("Effenaar (page data)", () => {
  const ev = parseEffenaar(fixture("effenaar-agenda.html"));
  it("reads events from the embedded search results, date only", () => {
    expect(ev).toHaveLength(3);
    expect(ev[0]).toMatchObject({ venueId: "effenaar", title: "Kovacs", hasTime: false, url: "https://www.effenaar.nl/agenda/kovacs-nieuwe-datum" });
    expect(ev[1].start).toBe("2027-10-20T12:00:00+02:00");
  });
  it("fails loudly when the page structure changes", () => {
    expect(() => parseEffenaar("<html><body>nieuw ontwerp</body></html>")).toThrow(/page data/);
  });
});

describe("TivoliVredenburg (HTML, paged)", () => {
  const { events, hasNext } = parseTivoli(fixture("tivoli-agenda.html"));
  it("reads items and sees the next page", () => {
    expect(hasNext).toBe(true);
    expect(events[0]).toMatchObject({ venueId: "tivolivredenburg", title: "De Grote Vriendelijke Pakjesavond", start: "2026-11-25T12:00:00+01:00", hasTime: false, status: "uitverkocht", sourceId: "44601811" });
  });
});

describe("Johan Cruijff ArenA (HTML with datetime)", () => {
  const ev = parseJca(fixture("jca-kalender.html"));
  it("uses the machine-readable datetime", () => {
    expect(ev[0]).toMatchObject({ venueId: "johan-cruijff-arena", title: "Ajax - FC Thun", start: "2026-11-26T18:45:00+01:00", hasTime: true, sourceId: "461409" });
  });
});

describe("sitemap + JSON-LD", () => {
  it("maps a schema.org event and treats midnight as 'no time'", () => {
    const e = fromJsonLd({ type: "MusicEvent", name: "Band", startDate: "2027-06-12T00:00:00+02:00", performers: ["Band"], url: "https://x.example.com/e" }, "https://x.example.com/e", "veltins-arena", "DE");
    expect(e).toMatchObject({ title: "Band", hasTime: false, artists: ["Band"], sourceCategory: "music" });
  });
  it("skips events without a date", () => {
    expect(fromJsonLd({ type: "Event", name: "X", performers: [] }, "https://x.example.com", "veltins-arena", "DE")).toBeUndefined();
  });
});

import { parseZiggoDome } from "../scripts/adapters/ziggo-dome";
import { parse013 } from "../scripts/adapters/013";
import { parseGelredome } from "../scripts/adapters/gelredome";
import { parseUitagendaRotterdam } from "../scripts/adapters/uitagenda-rotterdam";
import { inferYear, parseUitagendaUtrecht } from "../scripts/adapters/uitagenda-utrecht";

describe("Ziggo Dome (own agenda API)", () => {
  const { events, hasMore } = parseZiggoDome(fixture("ziggodome-agenda.json"));
  it("reads performer, local time, ticket link and genre (also when genres is a JSON string)", () => {
    expect(hasMore).toBe(true);
    expect(events[0]).toMatchObject({ venueId: "ziggo-dome", title: "The Script", start: "2026-11-26T19:00:00+01:00", hasTime: true, sourceCategory: "Pop", ticketUrl: "https://www.ticketmaster.nl/event/1516159579" });
  });
  it("maps SoldOut and Canceled", () => {
    expect(events.map((e) => e.status)).toEqual([undefined, "uitverkocht", "geannuleerd"]);
  });
  it("fails loudly on an unexpected response", () => {
    expect(() => parseZiggoDome('{"error":"x"}')).toThrow(/onverwacht/);
  });
});

describe("013 (Markdown programme)", () => {
  const ev = parse013(fixture("013-programma.md"));
  it("reads every line with date, time and status", () => {
    expect(ev[0]).toMatchObject({ venueId: "013", title: "Cul's Cult", start: "2026-11-25T21:00:00+01:00", sourceId: "152587" });
    expect(ev.find((e) => e.title === "Sugar Spine")?.status).toBe("uitverkocht");
    expect(ev.at(-1)?.start.slice(0, 4)).toBe("2027");
  });
});

describe("GelreDome (Webflow HTML, paged)", () => {
  const html = fixture("gelredome-agenda.html");
  it("reads the date label and the next page", () => {
    const { events, next } = parseGelredome(html);
    expect(next).toBe("https://www.gelredome.nl/agenda?473b7315_page=2");
    expect(events[0]).toMatchObject({ venueId: "gelredome", title: "Transmission", start: "2026-11-28T12:00:00+01:00", hasTime: false, url: "https://www.gelredome.nl/evenement/transmission-2026" });
    expect(events.every((e) => e.status === undefined)).toBe(true); // hidden "Uitverkocht" labels are ignored
  });
  it("treats a visible sold-out label as sold out", () => {
    const visible = html.replace(/class="label is-red w-condition-invisible"><div>Uitverkocht/, 'class="label is-red"><div>Uitverkocht');
    expect(parseGelredome(visible).events[0].status).toBe("uitverkocht");
  });
});

describe("Uitagenda Rotterdam (Ahoy via city agenda JSON)", () => {
  const { events, totalPages } = parseUitagendaRotterdam(fixture("uitagenda-rotterdam.json"), "rotterdam-ahoy", "rotterdam-ahoy");
  it("reads date, genre and sold-out", () => {
    expect(totalPages).toBe(2);
    expect(events.map((e) => e.title)).toEqual(["EXCELLENT woonbeurs", "UB40 ft. Ali Campbell", "De Vrienden van Amstel LIVE"]);
    expect(events[1]).toMatchObject({ venueId: "rotterdam-ahoy", start: "2026-12-15T20:00:00+01:00", sourceCategory: "Muziek" });
    expect(events[2].status).toBe("uitverkocht");
  });
  it("drops items from another location", () => {
    expect(parseUitagendaRotterdam(fixture("uitagenda-rotterdam.json"), "rotterdam-ahoy", "rtm-stage").events).toHaveLength(0);
  });
});

describe("UITagenda Utrecht (TivoliVredenburg via city agenda)", () => {
  const r = parseUitagendaUtrecht(fixture("uitagenda-utrecht.html"), new Date("2026-11-25T12:00:00Z"));
  it("keeps only Tivoli items, single days, with time", () => {
    expect(r.lastPage).toBeGreaterThan(1);
    expect(r.events.length).toBeGreaterThan(0);
    expect(r.events.every((e) => e.venueId === "tivolivredenburg")).toBe(true);
    expect(r.events.find((e) => e.title === "Shantel")).toMatchObject({ start: "2026-11-25T20:30:00+01:00", hasTime: true });
    expect(r.events.some((e) => e.title === "NKK NOW Zanggroepen")).toBe(false); // date range
  });
  it("infers the year for dates without one", () => {
    const today = new Date("2026-11-25T12:00:00Z");
    expect([inferYear(25, 11, today), inferYear(3, 1, today), inferYear(24, 11, today), inferYear(20, 11, today)]).toEqual([2026, 2027, 2026, 2027]);
  });
});
