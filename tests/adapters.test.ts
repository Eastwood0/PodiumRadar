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
