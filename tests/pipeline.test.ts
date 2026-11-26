import { describe, expect, it } from "vitest";
import type { SourceEvent } from "../scripts/adapters/types";
import { artistsFromTitle, normalizeName, statusFrom, tokenSetSimilarity } from "../scripts/lib/normalize";
import { carryFirstSeen, dedupe, isOutage, toEvents } from "../scripts/lib/pipeline";
import type { Venue } from "../src/lib/schema";

const venue = (id: string, country: "NL" | "DE" = "NL"): Venue => ({ id, name: id, city: "X", country, tier: "A", verified: false, aliases: [], sources: { ticketmasterVenueIds: [] } });
const venues = new Map([["zaal", venue("zaal")], ["halle", venue("halle", "DE")]]);
const src = (over: Partial<SourceEvent>): SourceEvent => ({ venueId: "zaal", title: "Band", start: "2027-03-01T20:00:00+01:00", hasTime: true, url: "https://zaal.example.com/band", sourceId: "1", ...over });
const TODAY = "2026-11-25";

describe("toEvents", () => {
  it("builds valid events with venue data, artists and a stable id", () => {
    const { events, dropped } = toEvents([src({ title: "Band A + Band B" })], "zaal.nl", venues, TODAY);
    expect(dropped).toBe(0);
    expect(events[0]).toMatchObject({ venueName: "zaal", country: "NL", status: "gepland", category: "muziek", ticketUrl: "https://zaal.example.com/band", firstSeen: TODAY });
    expect(events[0].artists.map((a) => a.name)).toEqual(["Band A", "Band B"]);
    expect(toEvents([src({ title: "Band A + Band B" })], "zaal.nl", venues, TODAY).events[0].id).toBe(events[0].id);
  });
  it("keeps only today up to 365 days ahead", () => {
    const { events } = toEvents([src({ start: "2026-11-24T20:00:00+01:00" }), src({ start: "2026-11-25T20:00:00+01:00" }), src({ start: "2027-11-26T20:00:00+01:00" })], "z", venues, TODAY);
    expect(events.map((e) => e.start.slice(0, 10))).toEqual(["2026-11-25"]);
  });
  it("drops rows that fail validation (bad link, unknown venue)", () => {
    const { events, dropped } = toEvents([src({ url: "javascript:alert(1)" }), src({ venueId: "onbekend" })], "z", venues, TODAY);
    expect(events).toHaveLength(0);
    expect(dropped).toBe(2);
  });
});

describe("dedupe", () => {
  const a = toEvents([src({ title: "Kovacs", hasTime: false, start: "2027-03-01T12:00:00+01:00" })], "site", venues, TODAY).events[0];
  const b = { ...toEvents([src({ title: "Kovacs - Live 2027", sourceId: "tm1", url: "https://tm.example.com/1", status: "uitverkocht" })], "ticketmaster", venues, TODAY).events[0] };
  it("merges the same show from two sources: first title, time and status filled in", () => {
    const out = dedupe([a, b]);
    expect(out).toHaveLength(1);
    expect(out[0]).toMatchObject({ title: "Kovacs", hasTime: true, start: "2027-03-01T20:00:00+01:00", status: "uitverkocht" });
    expect(out[0].sources.map((s) => s.name)).toEqual(["site", "ticketmaster"]);
  });
  it("keeps different shows on the same day apart", () => {
    const c = toEvents([src({ title: "Totaal Andere Act" })], "site", venues, TODAY).events[0];
    expect(dedupe([a, c])).toHaveLength(2);
  });
});

describe("outage guard (< 50% of last run)", () => {
  it("flags a sudden drop", () => {
    expect(isOutage(40, 100)).toBe(true);
    expect(isOutage(50, 100)).toBe(false);
  });
  it("ignores small sources and first runs", () => {
    expect(isOutage(0, 3)).toBe(false);
    expect(isOutage(0, undefined)).toBe(false);
  });
});

describe("carryFirstSeen", () => {
  it("keeps the original first-seen date", () => {
    const e = toEvents([src({})], "z", venues, TODAY).events[0];
    expect(carryFirstSeen([e], [{ ...e, firstSeen: "2026-10-01" }])[0].firstSeen).toBe("2026-10-01");
  });
});

describe("normalize", () => {
  it("compares names regardless of noise words and punctuation", () => {
    expect(normalizeName("The Backstreet Boys – Live 2027!")).toBe("backstreet boys");
    expect(tokenSetSimilarity("Backstreet Boys", "Backstreet Boys: DNA World Tour")).toBe(1);
    expect(tokenSetSimilarity("Backstreet Boys", "Boyzone")).toBe(0);
  });
  it("reads status words in several languages", () => {
    expect([statusFrom("Ausverkauft"), statusFrom("Verschoben"), statusFrom("Afgelast"), statusFrom("EventScheduled")]).toEqual(["uitverkocht", "verplaatst", "geannuleerd", undefined]);
  });
  it("splits clear line-ups only", () => {
    expect(artistsFromTitle("thrown + Counterparts")).toEqual(["thrown", "Counterparts"]);
    expect(artistsFromTitle("Kool & The Gang")).toEqual(["Kool & The Gang"]);
    expect(artistsFromTitle("SARIUS x EPIS x BONSON")).toEqual(["SARIUS", "EPIS", "BONSON"]);
  });
});

describe("decodeEntities", async () => {
  const { decodeEntities } = await import("../scripts/lib/normalize");
  it("turns HTML entities in source names into characters", () => {
    expect(decodeEntities("APOLLO BROWN &#038; SKYZOO")).toBe("APOLLO BROWN & SKYZOO");
    expect(decodeEntities("&#8220;Sunset Session&#8221;")).toBe("“Sunset Session”");
    expect(decodeEntities("Rock &amp; Roll &unknown;")).toBe("Rock & Roll &unknown;");
  });
});
