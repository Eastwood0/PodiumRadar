import { describe, expect, it } from "vitest";
import { findTime, localDate, localToIso, monthNumber, normalizeIso } from "../scripts/lib/dates";

describe("dates", () => {
  it("uses winter and summer time correctly", () => {
    expect(localToIso(2027, 1, 10, "20:00", "Europe/Amsterdam").start).toBe("2027-01-10T20:00:00+01:00");
    expect(localToIso(2027, 7, 10, "20:00", "Europe/Amsterdam").start).toBe("2027-07-10T20:00:00+02:00");
    expect(localToIso(2027, 7, 10, "20:00", "Europe/London").start).toBe("2027-07-10T20:00:00+01:00");
  });
  it("handles the day of the DST switch", () => {
    expect(localToIso(2027, 3, 28, "20:00", "Europe/Amsterdam").start).toBe("2027-03-28T20:00:00+02:00");
    expect(localToIso(2027, 10, 31, "20:00", "Europe/Amsterdam").start).toBe("2027-10-31T20:00:00+01:00");
  });
  it("marks date-only values", () => {
    expect(localToIso(2027, 1, 10, undefined, "Europe/Amsterdam")).toEqual({ start: "2027-01-10T12:00:00+01:00", hasTime: false });
  });
  it("reads month names in NL, DE and EN", () => {
    expect([monthNumber("mrt"), monthNumber("März"), monthNumber("Dezember"), monthNumber("mei"), monthNumber("October")]).toEqual([3, 3, 12, 5, 10]);
  });
  it("normalises ISO strings into the venue's zone", () => {
    expect(normalizeIso("2027-03-01T19:00:00Z", "Europe/Berlin")?.start).toBe("2027-03-01T20:00:00+01:00");
    expect(normalizeIso("2027-03-01", "Europe/Berlin")?.hasTime).toBe(false);
    expect(normalizeIso("geen datum", "Europe/Berlin")).toBeUndefined();
  });
  it("gives the local calendar day", () => {
    expect(localDate("2027-03-01T23:30:00Z", "Europe/Amsterdam")).toBe("2027-03-02");
  });
  it("finds times but not dates", () => {
    expect(findTime("Mo. 07.12.2026 20:00 Uhr")).toBe("20:00");
    expect(findTime("Mo. 07.12.2026")).toBeUndefined();
    expect(findTime("aanvang 19.30 uur")).toBe("19:30");
  });
});
