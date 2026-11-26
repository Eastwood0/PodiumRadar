import { describe, expect, it } from "vitest";
import { applyFilters, artistIndex, bill, DEFAULT_FILTERS, migrateFilters, formatDate, formatTime, isNew, level, monthKey, monthsFrom, parseRoute, slug } from "../src/app/lib";
import { createSearch } from "../src/app/search";
import type { Event, Venue } from "../src/lib/schema";
import { buildSiteData, expandSiteData, type SiteEvent, type SiteVenue, splitSiteData, toLocalIso } from "../src/lib/site-data";

const ev = (over: Partial<SiteEvent>): SiteEvent => ({ id: "1", t: "Band", a: ["Band"], v: "ziggo-dome", s: "2027-03-13T20:00:00+01:00", h: 1, st: "", c: "m", u: "https://x.example/t", p: "https://x.example/p", f: "2026-11-25", ...over });
const venue = (id: string, cc: SiteVenue["cc"], tier: SiteVenue["tier"] = "A"): SiteVenue => ({ id, n: id, city: "Stad", cc, tier });

describe("formatting (Amsterdam time)", () => {
  it("writes dates the Dutch way", () => {
    expect(formatDate("2027-03-13T20:00:00+01:00")).toBe("za 13 mrt 2027");
    expect(formatTime("2027-03-13T20:00:00+01:00")).toBe("20:00");
  });
  it("uses the local day, also for late shows stored in UTC", () => {
    expect(formatDate("2027-07-31T22:30:00Z")).toBe("zo 1 aug 2027");
    expect(monthKey("2027-07-31T22:30:00Z")).toBe("2027-08");
  });
  it("lists twelve months across the year boundary", () => {
    const m = monthsFrom("2026-11-25T20:00:00Z");
    expect(m).toHaveLength(12);
    expect([m[0], m[1], m[2], m[11]]).toEqual(["2026-11", "2026-12", "2027-01", "2027-10"]);
  });
});

describe("routes and slugs", () => {
  it("makes stable, plain slugs", () => {
    expect(slug("Thirty Seconds to Mars")).toBe("thirty-seconds-to-mars");
    expect(slug("Beyoncé")).toBe("beyonce");
    expect(slug("Kool & The Gang")).toBe("kool-en-the-gang");
    expect(slug("!!!")).toBe("x");
  });
  it("parses plain #name routes and falls back to the overview", () => {
    expect(parseRoute("#agenda")).toEqual({ view: "agenda" });
    expect(parseRoute("#artiest-backstreet-boys")).toEqual({ view: "artiest", slug: "backstreet-boys" });
    expect(parseRoute("#zaal-ziggo-dome")).toEqual({ view: "zaal", id: "ziggo-dome" });
    expect(parseRoute("")).toEqual({ view: "overzicht" });
    expect(parseRoute("#artiest-")).toEqual({ view: "overzicht" });
  });
});

describe("labels and buckets", () => {
  const data = { generatedAt: "2026-12-10T04:00:00Z", baseline: "2026-11-25" };
  it("marks shows first seen in the last 7 days as new, but not the first import", () => {
    expect(isNew(ev({ f: "2026-12-05" }), data)).toBe(true);
    expect(isNew(ev({ f: "2026-12-01" }), data)).toBe(false);
    expect(isNew(ev({ f: "2026-11-25" }), { ...data, generatedAt: "2026-11-26T04:00:00Z" })).toBe(false);
  });
  it("puts counts in fixed buckets", () => {
    expect([1, 2, 3, 4, 6, 7, 10, 11, 40].map(level)).toEqual([1, 2, 2, 3, 3, 4, 4, 5, 5]);
  });
});

describe("filters", () => {
  const venues = new Map([venue("ziggo-dome", "NL"), venue("lanxess-arena", "DE"), venue("effenaar", "NL", "B")].map((v) => [v.id, v]));
  const events = [ev({ id: "a" }), ev({ id: "b", v: "lanxess-arena", c: "o" }), ev({ id: "c", v: "effenaar", s: "2027-04-02T20:00:00+02:00" }), ev({ id: "d", v: "onbekend" })];
  const ids = (f = {}) => applyFilters(events, venues, { ...DEFAULT_FILTERS, ...f }).map((e) => e.id);
  it("splits music, theatre & cabaret and the rest", () => {
    const evs = [ev({ id: "m" }), ev({ id: "c", c: "o", g: "Comedy" }), ev({ id: "s", c: "o", g: "Sport" })];
    const pick = (kind: "muziek" | "theater" | "alles") => applyFilters(evs, venues, { ...DEFAULT_FILTERS, kind }).map((e) => e.id);
    expect([pick("muziek"), pick("theater"), pick("alles")]).toEqual([["m"], ["c"], ["m", "c", "s"]]);
  });
  it("turns the old 'show everything' checkbox into the kind switch", () => {
    expect(migrateFilters({ all: true }).kind).toBe("alles");
    expect(migrateFilters({}).kind).toBe("muziek");
    expect(migrateFilters({ kind: "theater", all: true }).kind).toBe("theater");
  });
  it("shows music by default and everything with the switch", () => {
    expect(ids()).toEqual(["a", "c"]);
    expect(ids({ kind: "alles" as const })).toEqual(["a", "b", "c"]);
  });
  it("filters by country, size, venue and month", () => {
    expect(ids({ kind: "alles" as const, country: "DE" })).toEqual(["b"]);
    expect(ids({ tier: "B" })).toEqual(["c"]);
    expect(ids({ venue: "ziggo-dome" })).toEqual(["a"]);
    expect(ids({ month: "2027-04" })).toEqual(["c"]);
  });
  it("filters by music genre; events without a genre drop out", () => {
    const withGenres = [ev({ id: "r", mg: ["Rock"] }), ev({ id: "d", mg: ["Dance & DJ", "Pop"] }), ev({ id: "x" })];
    const pick = (genres: string[]) => applyFilters(withGenres, venues, { ...DEFAULT_FILTERS, genres }).map((e) => e.id);
    expect(pick([])).toEqual(["r", "d", "x"]);
    expect(pick(["Pop"])).toEqual(["d"]);
    expect(pick(["Rock", "Dance & DJ"])).toEqual(["r", "d"]);
  });
  it("narrows Dance & DJ by style without dropping other chosen genres", () => {
    const evs = [ev({ id: "t", mg: ["Dance & DJ"], ds: ["Techno"] }), ev({ id: "h", mg: ["Dance & DJ"], ds: ["Hardstyle & hardcore"] }), ev({ id: "n", mg: ["Dance & DJ"] }), ev({ id: "r", mg: ["Rock"] })];
    const pick = (genres: string[], dance: string[]) => applyFilters(evs, venues, { ...DEFAULT_FILTERS, genres, dance }).map((e) => e.id);
    expect(pick(["Dance & DJ"], [])).toEqual(["t", "h", "n"]);
    expect(pick(["Dance & DJ"], ["Techno"])).toEqual(["t"]);
    expect(pick(["Dance & DJ", "Rock"], ["Techno"])).toEqual(["t", "r"]);
  });
});

describe("search", () => {
  const events = [
    ev({ id: "1", a: ["Backstreet Boys"], s: "2027-05-01T20:00:00+02:00" }),
    ev({ id: "2", a: ["Backstreet Boys"], s: "2027-05-02T20:00:00+02:00" }),
    ev({ id: "3", a: ["Thirty Seconds to Mars"] }),
    ev({ id: "4", a: ["Beyoncé"] }),
    ev({ id: "5", a: ["Boyzone"] }),
    ev({ id: "6", a: ["The Streets"] }),
    ev({ id: "7", a: ["Loïs Lane"] }),
    ev({ id: "8", a: ["Off The Wall: The Best of Michael Jackson met Jared Grant"] }),
    ev({ id: "9", a: ["Rammstein"] }),
  ];
  const search = createSearch(artistIndex(events), [{ id: "ziggo-dome", n: "Ziggo Dome", city: "Amsterdam", cc: "NL", tier: "A" }, { id: "lanxess-arena", n: "LANXESS arena", city: "Keulen", cc: "DE", tier: "A" }], (a) => `${a.count} shows`);
  const top = (q: string) => search(q)[0];
  it("finds Backstreet Boys from the typo 'backstreet boy' as first hit (tap 1: type, tap 2: pick)", () => {
    expect(top("backstreet boy")).toMatchObject({ kind: "artiest", label: "Backstreet Boys", href: "#artiest-backstreet-boys", detail: "2 shows" });
    expect(top("bakcstreet boys")?.label).toBe("Backstreet Boys");
    expect(top("backstreetboys")?.label).toBe("Backstreet Boys");
  });
  it("tolerates typos and missing accents", () => {
    expect(top("thirty secnds to mars")?.label).toBe("Thirty Seconds to Mars");
    expect(top("beyonce")?.label).toBe("Beyoncé");
    expect(top("rammstien")?.label).toBe("Rammstein");
  });
  it("does not match long titles on loose letters", () => {
    expect(search("lanxes").map((h) => h.label)).toEqual(["LANXESS arena"]);
    expect(search("ed sheran")).toEqual([]);
  });
  it("finds venues by name or city", () => {
    expect(top("ziggo")).toMatchObject({ kind: "zaal", href: "#zaal-ziggo-dome" });
    expect(top("koln")?.label).toBe("LANXESS arena");
    expect(top("keulen")?.label).toBe("LANXESS arena");
  });
  it("returns nothing for one letter or nonsense", () => {
    expect(search("b")).toEqual([]);
    expect(search("xqzw")).toEqual([]);
  });
});

describe("buildSiteData", () => {
  const venues: Venue[] = [
    { id: "ziggo-dome", name: "Ziggo Dome", city: "Amsterdam", country: "NL", tier: "A", verified: false, aliases: [], website: "https://www.ziggodome.nl/", sources: { ticketmasterVenueIds: [] } },
    { id: "goffertpark", name: "Goffertpark", city: "Nijmegen", country: "NL", tier: "A", verified: false, aliases: [], sources: { ticketmasterVenueIds: [] } },
  ];
  const event: Event = {
    id: "e1", title: "Band", artists: [{ name: "Band" }], venueId: "ziggo-dome", venueName: "Ziggo Dome", city: "Amsterdam", country: "NL",
    start: "2027-03-13T20:00:00+01:00", hasTime: true, status: "uitverkocht", category: "muziek", genre: "Concert",
    onSaleStart: "2026-11-01T10:00:00+01:00", ticketUrl: "https://t.example/1", sources: [{ name: "ziggodome.nl", sourceId: "1", url: "https://www.ziggodome.nl/x" }],
    firstSeen: "2026-11-25", lastSeen: "2026-11-25",
  };
  const site = buildSiteData([event, { ...event, id: "e2", venueId: null, firstSeen: "2026-11-20" }], venues, {}, "2026-11-26T04:17:00Z");
  it("keeps short keys, maps status and drops past presales and events without venue", () => {
    expect(site.events).toEqual([{ t: "Band", v: "ziggo-dome", s: event.start, h: 1, st: "u", c: "m", u: "https://t.example/1", p: "https://www.ziggodome.nl/x", f: "2026-11-25" }]);
    expect(expandSiteData(structuredClone(site)).events[0]).toMatchObject({ id: "e0", a: ["Band"], g: "Concert" });
  });
  it("splits off everything after 30 days into a second file; ids of the first part stay the same after merging", () => {
    const soon = { ...event, id: "s", start: "2026-12-01T20:00:00+01:00", title: "Soon" };
    const all = buildSiteData([event, soon], venues, {}, "2026-11-26T04:17:00Z");
    expect(all.events.map((e) => e.t)).toEqual(["Soon", "Band"]); // sorted by date
    const { first, rest } = splitSiteData(all, "data/agenda-later.json");
    expect(first.events.map((e) => e.t)).toEqual(["Soon"]);
    expect(first.more).toBe("data/agenda-later.json");
    expect(rest.events.map((e) => e.t)).toEqual(["Band"]);
    const partial = expandSiteData(first);
    const merged = expandSiteData(first, rest.events);
    expect(merged.events.map((e) => [e.id, e.t])).toEqual([["e0", "Soon"], ["e1", "Band"]]);
    expect(merged.events[0].id).toBe(partial.events[0].id);
    expect("more" in merged).toBe(false);
    expect([partial.complete, merged.complete]).toEqual([false, true]);
    expect(splitSiteData({ ...all, events: [all.events[0]] }, "x").first.more).toBeUndefined();
  });
  it("adds the no-source reason only to venues without events", () => {
    expect(site.venues.find((v) => v.id === "goffertpark")?.ns).toMatch(/Ticketmaster/);
    expect(site.venues.find((v) => v.id === "ziggo-dome")?.ns).toBeUndefined();
  });
  it("uses the earliest firstSeen as baseline", () => {
    expect(site.baseline).toBe("2026-11-20");
  });
});

describe("toLocalIso", () => {
  it("writes Amsterdam wall-clock time with the right offset for summer and winter", () => {
    expect(toLocalIso("2027-07-31T22:30:00Z")).toBe("2027-08-01T00:30:00+02:00");
    expect(toLocalIso("2027-01-10T19:00:00Z")).toBe("2027-01-10T20:00:00+01:00");
    expect(toLocalIso("2027-03-13T20:00:00+01:00")).toBe("2027-03-13T20:00:00+01:00");
  });
  it("gives the same day and weekday as the slow formatter", () => {
    expect(formatDate(toLocalIso("2027-07-31T22:30:00Z"))).toBe("zo 1 aug 2027");
  });
});

describe("bill (opening poster)", () => {
  const venues = new Map([venue("ziggo-dome", "NL"), venue("lanxess-arena", "DE"), venue("effenaar", "NL", "B")].map((v) => [v.id, v]));
  const at = (d: string) => `2026-${d}T20:00:00+01:00`;
  const events = [
    ev({ id: "1", a: ["Muse"], s: at("11-29") }),
    ev({ id: "2", a: ["Muse"], s: at("11-30") }),
    ev({ id: "3", a: ["Westlife"], v: "lanxess-arena", s: at("11-26") }),
    ev({ id: "4", a: ["Kensington"], s: at("12-03") }),
    ev({ id: "5", a: ["Davina Michelle"], v: "effenaar", s: at("12-02") }),
    ev({ id: "6", a: ["Cirque"], c: "o", s: at("12-01") }),
    ev({ id: "7", a: ["Prodigy"], st: "g", s: at("11-28") }),
    ev({ id: "8", a: ["Later"], s: at("12-30") }),
  ];
  const b = bill(events, venues, "2026-11-25T20:00:00Z");
  it("puts big venues first, most nights on top, mid-size venues last", () => {
    expect(b.headliners.map((x) => `${x.name}:${x.nights}`)).toEqual(["Muse:2", "Westlife:1", "Kensington:1"]);
    expect(b.club.map((x) => x.name)).toEqual(["Davina Michelle"]);
  });
  it("leaves out non-music, cancelled shows and anything after 30 days", () => {
    expect(b.total).toBe(5);
  });
});
