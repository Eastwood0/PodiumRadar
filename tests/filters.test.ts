import { describe, expect, it } from "vitest";
import { applyFilters, DEFAULT_FILTERS, parseRoute, whenRange } from "../src/app/lib";
import { sortVenues, venueScore, type VenueOption } from "../src/app/VenuePicker";
import type { SiteEvent, SiteVenue } from "../src/lib/site-data";

describe("Wanneer: dit weekend en komende 7 dagen", () => {
  it("weekend is Friday to Sunday; from Friday on it starts today", () => {
    expect(whenRange("weekend", "2026-11-25")).toEqual(["2026-11-27", "2026-11-29"]); // Wednesday
    expect(whenRange("weekend", "2026-11-27")).toEqual(["2026-11-27", "2026-11-29"]); // Friday
    expect(whenRange("weekend", "2026-11-28")).toEqual(["2026-11-28", "2026-11-29"]); // Saturday
    expect(whenRange("weekend", "2026-11-29")).toEqual(["2026-11-29", "2026-11-29"]); // Sunday
    expect(whenRange("weekend", "2026-11-30")).toEqual(["2026-12-04", "2026-12-06"]); // Monday
  });
  it("week is today and six days more, also across a month", () => {
    expect(whenRange("week", "2026-12-28")).toEqual(["2026-12-28", "2027-01-03"]);
  });
  it("the overview buttons are routes to the agenda", () => {
    expect(parseRoute("#agenda/weekend")).toEqual({ view: "agenda", when: "weekend" });
    expect(parseRoute("#agenda/week")).toEqual({ view: "agenda", when: "week" });
  });
});

describe("applyFilters", () => {
  const venue: SiteVenue = { id: "z", n: "Zaal", city: "Weert", cc: "NL", tier: "B" };
  const venues = new Map([[venue.id, venue]]);
  const ev = (id: string, s: string, over: Partial<SiteEvent> = {}): SiteEvent => ({ id, t: id, a: [id], v: "z", s, h: 1, st: "", c: "m", u: "https://x.nl", p: "https://x.nl", f: "2026-11-01", ...over });
  const events = [ev("vr", "2026-11-27T20:00:00+01:00", { mg: ["Rock"] }), ev("ma", "2026-11-30T20:00:00+01:00"), ev("toneel", "2026-11-28T20:00:00+01:00", { c: "o", g: "Toneel" })];
  it("keeps only the coming weekend", () => {
    const ids = applyFilters(events, venues, { ...DEFAULT_FILTERS, when: "weekend" }, "2026-11-25").map((e) => e.id);
    expect(ids).toEqual(["vr"]);
  });
  it("a genre chosen under music does not hide theatre (the genre row is not shown there)", () => {
    const ids = applyFilters(events, venues, { ...DEFAULT_FILTERS, kind: "theater", genres: ["Rock"] }, "2026-11-25").map((e) => e.id);
    expect(ids).toEqual(["toneel"]);
  });
});

describe("venue picker", () => {
  const v = (id: string, n: string, city: string, cc: VenueOption["cc"] = "NL"): VenueOption => ({ id, n, city, cc, count: 1 });
  const list = [v("z", "Ziggo Dome", "Amsterdam"), v("l", "LANXESS arena", "Keulen", "DE"), v("a", "AFAS Live", "Amsterdam"), v("m", "Melkweg", "Amsterdam"), v("d", "De Bosuil", "Weert")];
  it("lists A–Z within each country, Nederland first", () => {
    expect(sortVenues(list).map((x) => x.n)).toEqual(["AFAS Live", "De Bosuil", "Melkweg", "Ziggo Dome", "LANXESS arena"]);
  });
  it("matches the start of a name or city word, forgives one typo, and refuses nonsense", () => {
    expect(venueScore("melk", list[3])).toBe(0);
    expect(venueScore("bosuil", list[4])).toBeDefined();
    expect(venueScore("weert", list[4])).toBeDefined();
    expect(venueScore("melkwge", list[3])).toBeDefined();
    expect(venueScore("keulen", list[1])).toBeDefined();
    expect(venueScore("xyz", list[3])).toBeUndefined();
  });
});
