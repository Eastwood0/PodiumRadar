import { describe, expect, it } from "vitest";
import { followedCells, isFollowed, MAX_FOLLOWS, mergeArtists, newSince, radarEvents, toggled } from "../src/app/follow";
import { monthKey, parseRoute } from "../src/app/lib";
import { withFollowOption } from "../src/app/search";
import type { SiteEvent } from "../src/lib/site-data";

const ev = (id: string, a: string[], s: string, f = "2026-11-01", v = "ziggo-dome"): SiteEvent => ({ id, t: a.join(" + "), a, v, s, h: 1, st: "", c: "m", u: "https://x.nl", p: "https://x.nl", f });

describe("following artists", () => {
  it("toggles by name, ignoring case and accents; refuses more than the maximum", () => {
    let s = toggled({ artists: [] }, "Beyoncé");
    expect(isFollowed(s, "beyonce")).toBe(true);
    s = toggled(s, "BEYONCE");
    expect(s.artists).toEqual([]);
    const full = { artists: Array.from({ length: MAX_FOLLOWS }, (_, i) => `Act ${i}`) };
    expect(toggled(full, "One Too Many")).toBe(full);
  });
  it("matches whole names only, so a tribute band does not count as the real band", () => {
    const events = [ev("1", ["Golden Earring Tribute"], "2027-01-20T20:15:00+01:00"), ev("2", ["Backstreet Boys"], "2027-05-01T20:00:00+02:00")];
    expect(radarEvents(events, ["Golden Earring"]).map((e) => e.id)).toEqual([]);
    expect(radarEvents(events, ["backstreet boys"]).map((e) => e.id)).toEqual(["2"]);
  });
  it("merges two devices' lists without duplicates", () => {
    expect(mergeArtists(["Anouk", "Racoon"], ["racoon", "Rammstein"])).toEqual(["Anouk", "Racoon", "Rammstein"]);
  });
  it("labels a show Nieuw when it first appeared after the previous visit", () => {
    const show = ev("3", ["Anouk"], "2027-03-01T20:00:00+01:00", "2026-11-26");
    expect(newSince(show, "2026-11-25T21:00:00.000Z")).toBe(true);
    expect(newSince(show, "2026-11-26T08:00:00.000Z")).toBe(false);
    expect(newSince(show, undefined)).toBe(false);
  });
  it("marks the overview cells that hold a followed artist", () => {
    const cells = followedCells([ev("1", ["Anouk"], "2027-03-01T20:00:00+01:00", "2026-11-01", "afas-live")], ["Anouk"], monthKey);
    expect([...cells]).toEqual(["afas-live|2027-03"]);
  });
});

describe("routes and search for following", () => {
  it("knows Mijn radar and the link-code link", () => {
    expect(parseRoute("#radar")).toEqual({ view: "radar" });
    expect(parseRoute("#koppel-C2WR1HV46H60J5VMQZHRJ632BC")).toEqual({ view: "radar", join: "C2WR1HV46H60J5VMQZHRJ632BC" });
  });
  it("offers to follow a typed name that is not in the agenda", () => {
    const hits = withFollowOption("backstreet boys", []);
    expect(hits).toEqual([{ kind: "volg", label: "Volg “backstreet boys”", detail: "ook zonder geplande shows", href: "#artiest-backstreet-boys", name: "backstreet boys" }]);
    const known = [{ kind: "artiest" as const, label: "Backstreet Boys", detail: "", href: "#artiest-backstreet-boys" }];
    expect(withFollowOption("Backstreet Boys", known)).toEqual(known);
    expect(withFollowOption("b", [])).toEqual([]);
    expect(withFollowOption(["iemand", "voorbeeld.nl"].join("@"), [])).toEqual([]);
  });
});
