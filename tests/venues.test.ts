import { describe, expect, it } from "vitest";
import { loadVenues, parseVenueConfig } from "../src/lib/venues";

describe("config/venues.yml", () => {
  const venues = loadVenues();

  it("is valid and contains the 32 venues from the plan plus 37 Dutch venues, theatres and clubs added in B32/B33/B41", () => {
    expect(venues).toHaveLength(70);
  });

  it("has unique ids", () => {
    expect(new Set(venues.map((v) => v.id)).size).toBe(venues.length);
  });

  it("covers NL, BE and DE including tier B venues", () => {
    expect(new Set(venues.map((v) => v.country))).toEqual(new Set(["NL", "BE", "DE"]));
    const tierB = venues.filter((v) => v.tier === "B").map((v) => v.id);
    expect(tierB.slice(0, 3)).toEqual(["tivolivredenburg", "013", "effenaar"]);
    expect(tierB).toContain("de-bosuil");
    expect(tierB).toContain("klokgebouw");
  });
});

describe("parseVenueConfig", () => {
  const base = "venues:\n  - { id: a, name: A, city: X, country: NL, tier: A }\n";

  it("applies defaults", () => {
    const [v] = parseVenueConfig(base);
    expect(v.verified).toBe(false);
    expect(v.aliases).toEqual([]);
    expect(v.sources.ticketmasterVenueIds).toEqual([]);
  });

  it("rejects duplicate ids", () => {
    expect(() => parseVenueConfig(base + "  - { id: a, name: B, city: Y, country: BE, tier: A }\n")).toThrow(/duplicate/);
  });

  it("rejects an unknown country", () => {
    expect(() => parseVenueConfig("venues:\n  - { id: a, name: A, city: X, country: FR, tier: A }\n")).toThrow(/country/);
  });

  it("rejects a non-slug id", () => {
    expect(() => parseVenueConfig("venues:\n  - { id: Ziggo Dome, name: A, city: X, country: NL, tier: A }\n")).toThrow(/slug/);
  });

  it("requires location and website once a venue is verified", () => {
    expect(() =>
      parseVenueConfig("venues:\n  - { id: a, name: A, city: X, country: NL, tier: A, verified: true }\n"),
    ).toThrow(/needs lat, lng and website/);
  });

  it("rejects an empty list", () => {
    expect(() => parseVenueConfig("venues: []\n")).toThrow();
  });
});
