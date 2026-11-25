import { describe, expect, it } from "vitest";
import { EventSchema } from "../src/lib/schema";

const valid = {
  id: "ziggo-dome-2027-03-13-backstreet-boys",
  title: "Backstreet Boys – Live",
  artists: [{ name: "Backstreet Boys", ticketmasterAttractionId: "TEST-ATTRACTION-1" }],
  venueId: "ziggo-dome",
  venueName: "Ziggo Dome",
  city: "Amsterdam",
  country: "NL",
  start: "2027-03-13T20:00:00+01:00",
  hasTime: true,
  status: "gepland",
  category: "muziek",
  ticketUrl: "https://example.com/tickets",
  sources: [{ name: "ticketmaster", sourceId: "abc", url: "https://example.com/event" }],
  firstSeen: "2026-11-25",
  lastSeen: "2026-11-25",
};

describe("EventSchema", () => {
  it("accepts a valid event", () => {
    expect(EventSchema.safeParse(valid).success).toBe(true);
  });

  it("accepts a radar event outside the venue list (venueId null, UK)", () => {
    expect(EventSchema.safeParse({ ...valid, venueId: null, country: "GB", start: "2027-05-01T19:30:00+01:00" }).success).toBe(true);
  });

  it("requires a timezone offset on start", () => {
    expect(EventSchema.safeParse({ ...valid, start: "2027-03-13T20:00:00" }).success).toBe(false);
  });

  it("rejects countries outside the radar scope", () => {
    expect(EventSchema.safeParse({ ...valid, country: "ES" }).success).toBe(false);
  });

  it("rejects an unknown status", () => {
    expect(EventSchema.safeParse({ ...valid, status: "sold out" }).success).toBe(false);
  });

  it("requires at least one artist and one source", () => {
    expect(EventSchema.safeParse({ ...valid, artists: [] }).success).toBe(false);
    expect(EventSchema.safeParse({ ...valid, sources: [] }).success).toBe(false);
  });

  it("rejects a non-URL ticket link", () => {
    expect(EventSchema.safeParse({ ...valid, ticketUrl: "javascript:alert(1)" }).success).toBe(false);
  });
});
