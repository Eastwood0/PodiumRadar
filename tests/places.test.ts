import { describe, expect, it } from "vitest";
import { applyFilters, artistIndex, DEFAULT_FILTERS, parseRoute } from "../src/app/lib";
import { AREAS, areaWords, matchesPlace, placesFor } from "../src/app/places";
import { createSearch } from "../src/app/search";
import { venueScore } from "../src/app/VenuePicker";
import type { SiteEvent, SiteVenue } from "../src/lib/site-data";
import { loadVenues } from "../src/lib/venues";

const config = loadVenues();
const venues: SiteVenue[] = config.map((v) => ({ id: v.id, n: v.name, city: v.city, cc: v.country, tier: v.tier }));
const map = new Map(venues.map((v) => [v.id, v]));
const places = placesFor(venues);
const ev = (v: string): SiteEvent => ({ id: v, v, s: "2026-12-05T20:00:00+01:00", t: `Show in ${v}`, a: [`Act ${v}`], c: "m", u: "https://example.org/" }) as SiteEvent;
const events = venues.map((v) => ev(v.id));

describe("regions and whole cities (B54)", () => {
  it("only names cities that exist in config/venues.yml (a typo would silently drop venues)", () => {
    const cities = new Set(config.map((v) => v.city));
    for (const a of AREAS) for (const c of a.cities) expect(cities, `${a.name}: ${c}`).toContain(c);
  });

  it("keeps each area inside its own country", () => {
    for (const a of AREAS) for (const v of venues.filter((x) => a.cities.includes(x.city))) expect(v.cc, `${a.name}: ${v.n}`).toBe(a.cc);
  });

  it("offers a whole city only when it has two or more venues", () => {
    const amsterdam = places.find((p) => p.id === "plaats:stad-amsterdam");
    expect(amsterdam?.kind).toBe("stad");
    expect(places.find((p) => p.name === "Zwolle")).toBeUndefined(); // one venue: picking the venue is the same
    expect(places.find((p) => p.id === "plaats:stad-s-hertogenbosch")).toBeUndefined();
  });

  it("filters on a region without letting a venue from elsewhere through", () => {
    const got = applyFilters(events, map, { ...DEFAULT_FILTERS, venue: "plaats:noord-brabant" }, "2026-11-27");
    const cities = new Set(got.map((e) => map.get(e.v)!.city));
    expect(cities).toContain("Eindhoven");
    expect(cities).toContain("Tilburg");
    expect(cities).not.toContain("Amsterdam");
    expect(cities).not.toContain("Hasselt"); // Belgian Limburg is not Dutch Limburg or Brabant
  });

  it("matches nothing for an unknown region instead of everything", () => {
    expect(matchesPlace("plaats:atlantis", venues[0], places)).toBe(false);
    expect(applyFilters(events, map, { ...DEFAULT_FILTERS, venue: "plaats:atlantis" }, "2026-11-27")).toHaveLength(0);
  });

  it("still filters on one venue id", () => {
    const got = applyFilters(events, map, { ...DEFAULT_FILTERS, venue: "ziggo-dome" }, "2026-11-27");
    expect(got.map((e) => e.v)).toEqual(["ziggo-dome"]);
  });

  it("finds venues by the region they lie in", () => {
    const effenaar = venues.find((v) => v.id === "effenaar")!;
    expect(venueScore("brabant", { ...effenaar, count: 1, alt: areaWords(effenaar.city) })).toBeDefined();
    const ziggo = venues.find((v) => v.id === "ziggo-dome")!;
    expect(venueScore("brabant", { ...ziggo, count: 1, alt: areaWords(ziggo.city) })).toBeUndefined();
  });

  it("opens the agenda on a region from the search box", () => {
    expect(parseRoute("#regio-noord-brabant")).toEqual({ view: "agenda", place: "plaats:noord-brabant" });
    const search = createSearch(artistIndex(events), venues, () => "");
    const hits = search("brabant");
    expect(hits[0]).toMatchObject({ kind: "regio", label: "Noord-Brabant", href: "#regio-noord-brabant" });
    expect(search("ruhrgebiet")[0]).toMatchObject({ kind: "regio", label: "Ruhrgebied" });
  });
});
