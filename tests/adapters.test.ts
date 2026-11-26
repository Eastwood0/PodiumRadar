import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";
import { parseAfasLive } from "../scripts/adapters/afas-live";
import { parseEffenaar } from "../scripts/adapters/effenaar";
import { parseJca } from "../scripts/adapters/johan-cruijff-arena";
import { parseLanxess } from "../scripts/adapters/lanxess-arena";
import { fromJsonLd } from "../scripts/adapters/sitemap-jsonld";
import { parseZiggoDome } from "../scripts/adapters/ziggo-dome";
import { parse013 } from "../scripts/adapters/013";
import { parseGelredome } from "../scripts/adapters/gelredome";
import { parseUitagendaRotterdam } from "../scripts/adapters/uitagenda-rotterdam";
import { inferYear, parseUitagendaUtrecht } from "../scripts/adapters/uitagenda-utrecht";
import { BEAT_SITES, beatEventUrls, parseBeatEvent } from "../scripts/adapters/beat-venues";
import { DLIVE_SITES, parseDlive } from "../scripts/adapters/d-live";
import { parseWestfalenhalle, westfalenhalleCategory } from "../scripts/adapters/westfalenhalle";
import { parseRudolfWeberArena } from "../scripts/adapters/rudolf-weber-arena";
import { parseGrugahalle } from "../scripts/adapters/grugahalle";
import { parseIngShowDate, parseIngShowList } from "../scripts/adapters/ing-arena";
import { parseSparkassenpark, parseSparkassenparkTitle } from "../scripts/adapters/sparkassenpark";

// Fixtures are trimmed copies of the real pages (25 Nov 2026). When a site changes its layout,
// these tests keep passing but the live run reports the source as failed or as an outage.
const fixture = (name: string) => readFileSync(`tests/fixtures/${name}`, "utf8");

describe("AFAS Live (HTML)", () => {
  const ev = parseAfasLive(fixture("afaslive-agenda.html"));
  it("reads title, date, url and the time from the ticket link", () => {
    expect(ev).toHaveLength(4);
    expect(ev[0]).toMatchObject({ venueId: "afas-live", title: "We All Sing ABBA", start: "2026-11-25T20:00:00+01:00", hasTime: true, url: "https://www.afaslive.nl/agenda/we-all-sing-abba", sourceId: "6291700" });
  });
  it("leaves the time empty when the page has none", () => {
    expect(ev[1]).toMatchObject({ title: "Quido van de Graaf", hasTime: false });
  });
  it("maps sold-out and moved classes", () => {
    expect(ev[2].status).toBe("uitverkocht");
    expect(ev[3]).toMatchObject({ title: "EsDeeKid", status: "verplaatst" });
  });
});

describe("LANXESS arena (HTML)", () => {
  const ev = parseLanxess(fixture("lanxess-eventkalender.html"));
  it("reads data attributes, time and category", () => {
    expect(ev[0]).toMatchObject({ venueId: "lanxess-arena", title: "Westlife", start: "2026-11-25T19:30:00+01:00", sourceCategory: "Konzert", sourceId: "1281" });
    expect(ev[1]).toMatchObject({ title: "Kölner Haie - Straubing Tigers", sourceCategory: "Eishockey" });
  });
  it("does not read a date like 07.12 as a time, and reads 'Verschoben'", () => {
    expect(ev[2]).toMatchObject({ title: "NIMO", start: "2026-12-07T20:00:00+01:00", status: "verplaatst" });
  });
});

describe("Effenaar (page data)", () => {
  const ev = parseEffenaar(fixture("effenaar-agenda.html"));
  it("reads events from the embedded search results, date only", () => {
    expect(ev).toHaveLength(3);
    expect(ev[0]).toMatchObject({ venueId: "effenaar", title: "Kovacs", hasTime: false, url: "https://www.effenaar.nl/agenda/kovacs-nieuwe-datum" });
    expect(ev[1].start).toBe("2027-10-20T12:00:00+02:00");
  });
  it("fails loudly when the page structure changes", () => {
    expect(() => parseEffenaar("<html><body>nieuw ontwerp</body></html>")).toThrow(/page data/);
  });
});

describe("Johan Cruijff ArenA (HTML with datetime)", () => {
  const ev = parseJca(fixture("jca-kalender.html"));
  it("uses the machine-readable datetime", () => {
    expect(ev[0]).toMatchObject({ venueId: "johan-cruijff-arena", title: "Ajax - FC Thun", start: "2026-11-26T18:45:00+01:00", hasTime: true, sourceId: "461409" });
  });
});

describe("sitemap + JSON-LD", () => {
  it("maps a schema.org event and treats midnight as 'no time'", () => {
    const e = fromJsonLd({ type: "MusicEvent", name: "Band", startDate: "2027-06-12T00:00:00+02:00", performers: ["Band"], url: "https://x.example.com/e" }, "https://x.example.com/e", "veltins-arena", "DE");
    expect(e).toMatchObject({ title: "Band", hasTime: false, artists: ["Band"], sourceCategory: "music" });
  });
  it("skips events without a date", () => {
    expect(fromJsonLd({ type: "Event", name: "X", performers: [] }, "https://x.example.com", "veltins-arena", "DE")).toBeUndefined();
  });
});


describe("Ziggo Dome (own agenda API)", () => {
  const { events, hasMore } = parseZiggoDome(fixture("ziggodome-agenda.json"));
  it("reads performer, local time, ticket link and genre (also when genres is a JSON string)", () => {
    expect(hasMore).toBe(true);
    expect(events[0]).toMatchObject({ venueId: "ziggo-dome", title: "The Script", start: "2026-11-26T19:00:00+01:00", hasTime: true, sourceCategory: "Pop", ticketUrl: "https://www.ticketmaster.nl/event/1516159579" });
  });
  it("maps SoldOut and Canceled", () => {
    expect(events.map((e) => e.status)).toEqual([undefined, "uitverkocht", "geannuleerd"]);
  });
  it("fails loudly on an unexpected response", () => {
    expect(() => parseZiggoDome('{"error":"x"}')).toThrow(/onverwacht/);
  });
});

describe("013 (Markdown programme)", () => {
  const ev = parse013(fixture("013-programma.md"));
  it("reads every line with date, time and status", () => {
    expect(ev[0]).toMatchObject({ venueId: "013", title: "Cul's Cult", start: "2026-11-25T21:00:00+01:00", sourceId: "152587" });
    expect(ev.find((e) => e.title === "Sugar Spine")?.status).toBe("uitverkocht");
    expect(ev.at(-1)?.start.slice(0, 4)).toBe("2027");
  });
});

describe("GelreDome (Webflow HTML, paged)", () => {
  const html = fixture("gelredome-agenda.html");
  it("reads the date label and the next page", () => {
    const { events, next } = parseGelredome(html);
    expect(next).toBe("https://www.gelredome.nl/agenda?473b7315_page=2");
    expect(events[0]).toMatchObject({ venueId: "gelredome", title: "Transmission", start: "2026-11-28T12:00:00+01:00", hasTime: false, url: "https://www.gelredome.nl/evenement/transmission-2026" });
    expect(events.every((e) => e.status === undefined)).toBe(true); // hidden "Uitverkocht" labels are ignored
  });
  it("treats a visible sold-out label as sold out", () => {
    const visible = html.replace(/class="label is-red w-condition-invisible"><div>Uitverkocht/, 'class="label is-red"><div>Uitverkocht');
    expect(parseGelredome(visible).events[0].status).toBe("uitverkocht");
  });
});

describe("Uitagenda Rotterdam (Ahoy via city agenda JSON)", () => {
  const { events, totalPages } = parseUitagendaRotterdam(fixture("uitagenda-rotterdam.json"), "rotterdam-ahoy", "rotterdam-ahoy");
  it("reads date, genre and sold-out", () => {
    expect(totalPages).toBe(2);
    expect(events.map((e) => e.title)).toEqual(["EXCELLENT woonbeurs", "UB40 ft. Ali Campbell", "De Vrienden van Amstel LIVE"]);
    expect(events[1]).toMatchObject({ venueId: "rotterdam-ahoy", start: "2026-12-15T20:00:00+01:00", sourceCategory: "Muziek" });
    expect(events[2].status).toBe("uitverkocht");
  });
  it("drops items from another location", () => {
    expect(parseUitagendaRotterdam(fixture("uitagenda-rotterdam.json"), "rotterdam-ahoy", "rtm-stage").events).toHaveLength(0);
  });
});

describe("UITagenda Utrecht (TivoliVredenburg via city agenda)", () => {
  const r = parseUitagendaUtrecht(fixture("uitagenda-utrecht.html"), new Date("2026-11-25T12:00:00Z"));
  it("keeps only Tivoli items, single days, with time", () => {
    expect(r.lastPage).toBeGreaterThan(1);
    expect(r.events.length).toBeGreaterThan(0);
    expect(r.events.every((e) => e.venueId === "tivolivredenburg")).toBe(true);
    expect(r.events.find((e) => e.title === "Shantel")).toMatchObject({ start: "2026-11-25T20:30:00+01:00", hasTime: true });
    expect(r.events.some((e) => e.title === "NKK NOW Zanggroepen")).toBe(false); // date range
  });
  it("infers the year for dates without one", () => {
    const today = new Date("2026-11-25T12:00:00Z");
    expect([inferYear(25, 11, today), inferYear(3, 1, today), inferYear(24, 11, today), inferYear(20, 11, today)]).toEqual([2026, 2027, 2026, 2027]);
  });
});


describe("be•at venues (AFAS Dome, Lotto Arena, Vorst Nationaal, Trixxo Arena)", () => {
  it("turns each show time into its own event, with local time and ticket link", () => {
    const ev = parseBeatEvent(fixture("beat-afasdome-event.html"), "https://www.afas-dome.be/evenement/night-of-the-proms-2027-35c4d434", BEAT_SITES[0]);
    expect(ev.map((e) => e.start)).toEqual(["2027-11-19T20:30:00+01:00", "2027-11-20T20:30:00+01:00", "2027-11-21T15:00:00+01:00"]);
    expect(ev[0]).toMatchObject({ venueId: "sportpaleis", title: "Night of the Proms 2027", ticketUrl: "https://www.ticketmaster.be/event/72259572?language=nl-be&brand=afasdome" });
  });
  it("handles summer time and two shows on one day", () => {
    const ev = parseBeatEvent(fixture("beat-lotto-event.html"), "https://www.lotto-arena.be/evenement/likeme-in-concert-2027-6018c9d2", BEAT_SITES[1]);
    expect(ev.map((e) => e.start)).toEqual(["2027-04-10T14:30:00+02:00", "2027-04-10T18:00:00+02:00"]);
  });
  it("ignores shows at another venue of the group", () => {
    expect(parseBeatEvent(fixture("beat-lotto-event.html"), "https://x", BEAT_SITES[0])).toEqual([]);
  });
  it("reads Dutch event pages from the sitemap, without language duplicates", () => {
    const xml = "<urlset><url><loc>https://www.lotto-arena.be/evenement/a-1</loc></url><url><loc>https://www.lotto-arena.be/nl/evenement/a-1</loc></url><url><loc>https://www.lotto-arena.be/fr/evenement/a-1</loc></url><url><loc>https://www.lotto-arena.be/kalender</loc></url></urlset>";
    expect(beatEventUrls(xml, "https://www.lotto-arena.be")).toEqual(["https://www.lotto-arena.be/evenement/a-1"]);
  });
});

describe("d.live (PSD Bank Dome, Merkur Spiel-Arena, Mitsubishi Electric Halle)", () => {
  const ev = parseDlive(fixture("dlive-dates.json"), DLIVE_SITES[0]);
  it("reads the feed's wall-clock time as Düsseldorf time (the trailing Z is wrong in the feed)", () => {
    expect(ev[0]).toMatchObject({ venueId: "psd-bank-dome", title: "MUSE", start: "2026-11-25T19:30:00+01:00", sourceCategory: "Konzerte", ticketUrl: "https://www.livenation.de/muse-tickets-adp647" });
    expect(ev[2].start).toBe("2027-04-08T20:00:00+02:00");
  });
  it("maps canceled and postponed", () => {
    expect(ev.map((e) => e.status)).toEqual([undefined, "geannuleerd", "verplaatst"]);
  });
});

describe("Westfalenhalle (HTML)", () => {
  const ev = parseWestfalenhalle(fixture("westfalenhalle-eventfinder.html"));
  it("reads date, link and the site's own categories", () => {
    expect(ev.map((e) => [e.title, e.start.slice(0, 10), e.sourceCategory])).toEqual([
      ["KAYA YANAR", "2026-11-27", "Comedy"],
      ["NIGHT OF THE PROMS", "2026-11-28", "Musik"],
      ["CARDS & GAMES Dortmund", "2026-11-29", undefined],
    ]);
  });
  it("lets music win over other categories", () => {
    expect([westfalenhalleCategory("19,2,41"), westfalenhalleCategory("1"), westfalenhalleCategory("")]).toEqual(["Musik", "Comedy", undefined]);
  });
});

describe("Rudolf Weber-Arena (HTML)", () => {
  const ev = parseRudolfWeberArena(fixture("rwa-events.html"));
  it("reads date, time and cancellations", () => {
    expect(ev[0]).toMatchObject({ venueId: "arena-oberhausen", title: "Night of the Proms", start: "2026-11-29T18:00:00+01:00", hasTime: true, sourceId: "722" });
    expect(ev.at(-1)).toMatchObject({ title: "Killa Hakan", status: "geannuleerd" });
  });
});

describe("Grugahalle (HTML)", () => {
  it("reads title and date", () => {
    const ev = parseGrugahalle(fixture("grugahalle-list.html"));
    expect(ev[0]).toMatchObject({ venueId: "grugahalle", title: "Özcan Cosar – VIP", start: "2026-11-28T12:00:00+01:00", hasTime: false, sourceId: "25793" });
  });
});

describe("ING Arena (WordPress + show page)", () => {
  it("finds the French date on the show page", () => {
    expect(parseIngShowDate(fixture("ing-show.html"))).toEqual({ y: 2027, mo: 10, d: 3 });
    expect(parseIngShowDate("<div>geen datum</div>")).toBeUndefined();
  });
  it("decodes titles from the API list", () => {
    expect(parseIngShowList('[{"id":1,"link":"https://ing.arena.brussels/show/a/","title":{"rendered":"Ren&eacute; &#038; Co"}}]')).toEqual([{ id: 1, url: "https://ing.arena.brussels/show/a/", title: "René & Co" }]);
  });
});


describe("SparkassenPark (WordPress, date in title)", () => {
  it("takes the date out of the title and strips the place name", () => {
    expect(parseSparkassenparkTitle("PUR 04.06.2027 SparkassenPark Mönchengladbach")).toEqual({ title: "PUR", y: 2027, mo: 6, d: 4 });
    expect(parseSparkassenparkTitle("Limp Bizkit 23.06.26 SKP Mönchengladbach")).toMatchObject({ title: "Limp Bizkit", y: 2026 });
    expect(parseSparkassenparkTitle("BOBfest 2026 | 25.07.2026")).toMatchObject({ title: "BOBfest 2026", mo: 7, d: 25 });
    expect(parseSparkassenparkTitle("Brings and Friends")).toBeUndefined();
  });
  it("decodes HTML entities and builds events", () => {
    const ev = parseSparkassenpark('[{"id":5,"link":"https://sparkassenpark.de/veranstaltung/x/","title":{"rendered":"Simon &amp; Garfunkel 01.07.2027 SparkassenPark"}}]');
    expect(ev[0]).toMatchObject({ venueId: "sparkassenpark", title: "Simon & Garfunkel", start: "2027-07-01T12:00:00+02:00", hasTime: false });
  });
});

describe("Melkweg (Next.js page data)", async () => {
  const { parseMelkweg } = await import("../scripts/adapters/melkweg");
  const ev = parseMelkweg(fixture("melkweg-agenda.html"));
  it("reads events with status, kind of night and genre tags; skips private events", () => {
    expect(ev).toHaveLength(3);
    expect(ev[0]).toMatchObject({ venueId: "melkweg", title: "Def & brittneySGAT", start: "2026-11-26T19:30:00+01:00", hasTime: true, status: "uitverkocht", sourceCategory: "Concert, Hiphop, Rap", url: "https://www.melkweg.nl/nl/agenda/def-djbrittneysgat-26-11-2026", sourceId: "28566" });
    expect(ev[1].sourceCategory).toBe("Clubnacht, Nederhop, EDM, Deephouse");
    expect(ev.map((e) => e.title)).not.toContain("Galafeest Montessori Lyceum");
  });
  it("fails loudly when the page structure changes", () => {
    expect(() => parseMelkweg("<html></html>")).toThrow(/page data/);
  });
});

describe("Muziekgieterij (JSON-LD on the agenda page)", async () => {
  const { parseJsonLdPage } = await import("../scripts/adapters/jsonld-page");
  const page = { venueId: "muziekgieterij", country: "NL" as const, url: "https://muziekgieterij.nl/" };
  const ev = parseJsonLdPage(fixture("muziekgieterij-home.html"), page);
  it("reads times as real UTC and keeps line-up and ticket link", () => {
    expect(ev[1]).toMatchObject({ venueId: "muziekgieterij", title: "Froukje", start: "2026-11-26T20:00:00+01:00", hasTime: true, artists: ["Jaïr Faria", "Froukje"], sourceCategory: "music" });
    expect(ev[1].ticketUrl).toMatch(/^https:\/\/muziekgieterij\.stager\.co\//);
    expect(new Set(ev.map((e) => e.sourceId)).size).toBe(ev.length);
  });
  it("fails loudly without JSON-LD", () => {
    expect(() => parseJsonLdPage("<html></html>", page)).toThrow(/JSON-LD/);
  });
});

describe("Gashouder (HTML programme, months without year)", async () => {
  const { parseGashouder } = await import("../scripts/adapters/gashouder");
  const ev = parseGashouder(fixture("gashouder-home.html"), new Date("2026-11-26T08:00:00Z"));
  it("reads date, time, kind and status, and rolls the year over after December", () => {
    expect(ev[0]).toMatchObject({ venueId: "gashouder", title: "Avatar", start: "2026-12-01T20:00:00+01:00", hasTime: true, sourceCategory: "live", url: "https://gashouder.nl/programma/avatar" });
    const feb = ev.find((e) => e.start.startsWith("2027-02"));
    expect(feb).toBeDefined();
    expect(ev.some((e) => e.status === "uitverkocht")).toBe(true);
  });
  it("skips running exhibitions without a single date", () => {
    expect(ev.map((e) => e.title)).not.toContain("The making of Gashouder");
  });
});

describe("Paard (JSON-LD per event in the agenda list)", async () => {
  const { parseJsonLdPage } = await import("../scripts/adapters/jsonld-page");
  const ev = parseJsonLdPage(fixture("paard-events.html"), { venueId: "paard", country: "NL", url: "https://www.paard.nl/en/event/" });
  it("reads local times without offset as Dutch time and uses the event page as id", () => {
    expect(ev[0]).toMatchObject({ venueId: "paard", title: "SONS", start: "2026-11-26T19:00:00+01:00", hasTime: true, url: "https://www.paard.nl/en/event/sons-4/", sourceId: "https://www.paard.nl/en/event/sons-4/" });
    expect(ev).toHaveLength(3);
  });
});

describe("Hedon (Angular transfer state)", async () => {
  const { parseHedon } = await import("../scripts/adapters/hedon");
  const ev = parseHedon(fixture("hedon-home.html"));
  it("reads UTC start, sold-out status, genres and ticket link; skips shows elsewhere", () => {
    expect(ev).toHaveLength(2);
    expect(ev[0]).toMatchObject({ venueId: "hedon", title: "THE DIRTY DADDIES", start: "2027-01-29T20:30:00+01:00", hasTime: true, status: "uitverkocht", sourceCategory: "Rock, Pop / Rock", url: "https://www.hedon-zwolle.nl/voorstelling/32830/the-dirty-daddies", sourceId: "32830" });
    expect(ev[0].ticketUrl).toMatch(/^https:\/\/shop\.tickets\.cm\.com\//);
  });
  it("fails loudly without transfer state", () => {
    expect(() => parseHedon("<html></html>")).toThrow(/ng-state/);
  });
});
