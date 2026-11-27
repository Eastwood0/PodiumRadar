import { afterEach, describe, expect, it, vi } from "vitest";
import { applyFilters, DEFAULT_FILTERS, findShow, indexShows, parseRoute, showHref, showKey, todayLocal } from "../src/app/lib";
import { canGoBack, navigated, rememberLink, startNav } from "../src/app/nav";
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
    indexShows([e]);
    expect(showKey(e)).toBe("2026-11-27-complex-maastricht-claydrum-presents-nico-moreno-carla-schmitt");
    expect(parseRoute(showHref(e))).toEqual({ view: "show", key: showKey(e) });
  });
  it("keeps the link when the start time becomes known later (Codex: U2)", () => {
    const before = { ...ev("U2"), s: "2027-06-12T00:00:00+02:00", h: 0 as const };
    const after = { ...before, s: "2027-06-12T20:00:00+02:00", h: 1 as const };
    indexShows([before]);
    const k = showKey(before);
    indexShows([after]);
    expect(showKey(after)).toBe(k);
  });
  it("keeps a matinee and the evening show of the same title apart (The Streamers at 11:30 and 18:00)", () => {
    const early = ev("The Streamers", "2027-09-25T11:30:00+02:00");
    const late = ev("The Streamers", "2027-09-25T18:00:00+02:00");
    indexShows([early, late, ev("B")]);
    expect(showKey(early)).not.toBe(showKey(late));
    expect(findShow([early, late], showKey(late))).toBe(late);
    expect(showKey(ev("B"))).not.toMatch(/-\d{4}$/);
  });
  it("still opens links in the earlier format with the time after the date", () => {
    const e = ev("Nico Moreno");
    indexShows([e]);
    expect(findShow([e], "2026-11-27t22-30-complex-maastricht-nico-moreno")).toBe(e);
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
  /** A tiny browser history: link clicks push an entry without state, back/forward restore an entry's state. */
  function browser(start: string) {
    const entries: { hash: string; state: unknown }[] = [{ hash: start, state: null }];
    let at = 0;
    const location = { get hash() { return entries[at].hash; } };
    const history = {
      get state() { return entries[at].state; },
      replaceState(state: unknown, _t: string, url?: string) { entries[at] = { hash: url ?? entries[at].hash, state }; },
    };
    vi.stubGlobal("location", location);
    vi.stubGlobal("history", history);
    return {
      click(hash: string, y: number) { entries.splice(at + 1); entries.push({ hash, state: null }); at++; return navigated(y); },
      back(y: number) { at--; return navigated(y); },
    };
  }

  it("returns to the scroll position of the page you came from, and to the link you followed", () => {
    const b = browser("#agenda");
    startNav();
    expect(canGoBack()).toBe(false); // opened straight from a link: "Naar de agenda"
    expect(b.click("#show-a", 2400)).toEqual({});
    expect(canGoBack()).toBe(true);
    b.click("#artiest-b", 300);
    expect(b.back(0)).toMatchObject({ restore: 300, from: "#artiest-b" });
    expect(b.back(0)).toMatchObject({ restore: 2400, from: "#show-a" });
    expect(canGoBack()).toBe(false);
  });
  it("remembers which of several identical links was followed (a venue linked from many rows)", () => {
    const b = browser("#agenda");
    startNav();
    rememberLink("#zaal-melkweg", 7);
    b.click("#zaal-melkweg", 3000);
    expect(b.back(0)).toEqual({ restore: 3000, from: "#zaal-melkweg", link: { href: "#zaal-melkweg", index: 7 } });
  });
  it("treats a new link to the page you came from as a new step, not as a step back (Codex)", () => {
    const b = browser("#show-a");
    startNav();
    b.click("#agenda", 0); // "Naar de agenda" on a shared show
    expect(b.click("#show-a", 900)).toEqual({}); // the same show again via the list: a new page
    expect(canGoBack()).toBe(true);
    expect(b.back(0)).toMatchObject({ restore: 900, from: "#show-a" });
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
