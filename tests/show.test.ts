import { afterEach, describe, expect, it, vi } from "vitest";
import { applyFilters, DEFAULT_FILTERS, parseRoute, showHref, showKey, todayLocal } from "../src/app/lib";
import { canGoBack, navigated, startNav } from "../src/app/nav";
import { proposalText } from "../src/app/Proposal";
import { sourceNote } from "../src/app/sources";
import type { SiteData, SiteEvent, SiteVenue } from "../src/lib/site-data";

const venue: SiteVenue = { id: "complex-maastricht", n: "Complex", city: "Maastricht", cc: "NL", tier: "B" };
const mg: SiteVenue = { id: "martiniplaza", n: "MartiniPlaza", city: "Groningen", cc: "NL", tier: "B" };
const ev = (t: string, s = "2026-11-27T22:30:00+01:00", v = venue.id): SiteEvent => ({ id: t, t, a: [t], v, s, h: 1, st: "", c: "m", u: "https://example.org/t", p: "https://example.org/p", f: "2026-11-26" });
const data = (sources: SiteData["sources"]): SiteData => ({ generatedAt: "2026-11-27T04:00:00Z", baseline: "2026-11-01", venues: [venue, mg], events: [], sources, complete: true });

describe("show links (Deel show)", () => {
  it("gives a show the same key every day, from date, venue and title", () => {
    const e = ev("Claydrum presents Nico Moreno / Carla Schmitt");
    expect(showKey(e)).toBe("2026-11-27-complex-maastricht-claydrum-presents-nico-moreno-carla-schmitt");
    expect(parseRoute(showHref(e))).toEqual({ view: "show", key: showKey(e) });
  });
  it("keeps a matinee and the evening show of a title on the same day under one key only when the title is equal", () => {
    expect(showKey(ev("A", "2026-11-27T14:00:00+01:00"))).toBe(showKey(ev("A", "2026-11-27T20:00:00+01:00")));
    expect(showKey(ev("A"))).not.toBe(showKey(ev("B")));
  });
});

describe("one free evening (Kies een dag)", () => {
  it("reads a day and 'vandaag' from the address", () => {
    expect(parseRoute("#agenda/dag-2026-11-28")).toEqual({ view: "agenda", day: "2026-11-28" });
    expect(parseRoute("#agenda/vandaag")).toEqual({ view: "agenda", day: todayLocal() });
    expect(parseRoute("#agenda/dag-28-11")).toEqual({ view: "overzicht" });
  });
  it("shows only that day", () => {
    const events = [ev("Fri"), ev("Sat", "2026-11-28T21:00:00+01:00")];
    const got = applyFilters(events, new Map([[venue.id, venue]]), { ...DEFAULT_FILTERS, day: "2026-11-28" }, "2026-11-27");
    expect(got.map((e) => e.t)).toEqual(["Sat"]);
  });
});

describe("Terug", () => {
  afterEach(() => vi.unstubAllGlobals());
  const go = (hash: string, y: number) => {
    vi.stubGlobal("location", { hash });
    return navigated(y);
  };
  it("returns to the scroll position of the page you came from", () => {
    vi.stubGlobal("location", { hash: "#agenda" });
    startNav();
    expect(canGoBack()).toBe(false); // opened straight from a link: "Naar de agenda"
    expect(go("#show-a", 2400)).toBeUndefined();
    expect(canGoBack()).toBe(true);
    expect(go("#artiest-b", 300)).toBeUndefined();
    expect(go("#show-a", 0)).toBe(300);
    expect(go("#agenda", 0)).toBe(2400);
    expect(canGoBack()).toBe(false);
  });
  it("treats a new link to the same page as a new step, not as a step back", () => {
    vi.stubGlobal("location", { hash: "#agenda" });
    startNav();
    go("#show-a", 100);
    expect(go("#show-b", 50)).toBeUndefined();
  });
});

describe("how complete a venue's agenda is", () => {
  it("warns when a city agenda is the only source", () => {
    expect(sourceNote(data([{ name: "visitgroningen.nl", partial: true, ok: true, count: 180, venues: ["martiniplaza"] }]), mg)).toMatch(/stadsagenda/);
  });
  it("says nothing when the venue has its own working source, also next to a city agenda", () => {
    const d = data([
      { name: "complexmaastricht.nl", ok: true, count: 40, venues: [venue.id] },
      { name: "visitmaastricht.com", partial: true, ok: true, count: 19, venues: [venue.id] },
    ]);
    expect(sourceNote(d, venue)).toBe("");
  });
  it("warns when the venue's own source failed", () => {
    expect(sourceNote(data([{ name: "complexmaastricht.nl", ok: false, count: 0, lastSuccess: "2026-11-25T04:20:00Z", venues: [venue.id] }]), venue)).toMatch(/mislukt/);
  });
});

describe("Deel voorstel", () => {
  it("lists every pick with day, venue and a link to its page", () => {
    const e = { ...ev("Nico Moreno"), st: "u" as const };
    const text = proposalText([e], new Map([[venue.id, venue]]), "https://site/");
    expect(text).toContain("1. Nico Moreno");
    expect(text).toContain("Complex, Maastricht (uitverkocht)");
    expect(text).toContain(`https://site/${showHref(e)}`);
  });
});
