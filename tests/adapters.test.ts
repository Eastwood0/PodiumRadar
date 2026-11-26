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

describe("Patronaat (HTML programme)", async () => {
  const { parsePatronaat } = await import("../scripts/adapters/patronaat");
  const ev = parsePatronaat(fixture("patronaat-programma.html"));
  it("reads date, sold-out label and genre tags", () => {
    expect(ev).toHaveLength(3);
    expect(ev[1]).toMatchObject({ venueId: "patronaat", title: "Davina Michelle + support", start: "2026-11-26T12:00:00+01:00", hasTime: false, status: "uitverkocht", sourceCategory: "pop", url: "https://patronaat.nl/event/davina-michelle-support-26-11-26/" });
  });
});

describe("Melkweg bot check", async () => {
  const { isBotCheck } = await import("../scripts/adapters/melkweg");
  it("recognises the firewall challenge page and not the real agenda", () => {
    expect(isBotCheck(fixture("melkweg-botcheck.html"))).toBe(true);
    expect(isBotCheck(fixture("melkweg-agenda.html"))).toBe(false);
  });
});

describe("Palladium via koeln.de (JSON-LD)", async () => {
  const { parseJsonLdPage } = await import("../scripts/adapters/jsonld-page");
  const ev = parseJsonLdPage(fixture("koeln-palladium.html"), { venueId: "palladium-koeln", country: "DE", url: "https://www.koeln.de/veranstaltungsort/palladium-koeln/", location: /palladium/i });
  it("keeps Palladium events with their own page as id", () => {
    expect(ev).toHaveLength(3);
    expect(ev[0]).toMatchObject({ venueId: "palladium-koeln", start: "2026-11-29T20:00:00+01:00", hasTime: true, url: "https://www.koeln.de/event/esdeekid-council-house-rat-tour/" });
  });
});

describe("Klokgebouw (HTML agenda without year)", async () => {
  const { parseKlokgebouw } = await import("../scripts/adapters/klokgebouw");
  const ev = parseKlokgebouw(fixture("klokgebouw-agenda.html"), new Date("2026-11-26T10:00:00Z"));
  it("reads day, kind and title and picks the coming year", () => {
    expect(ev).toHaveLength(4);
    expect(ev[2]).toMatchObject({ venueId: "klokgebouw", title: "Joy Indoor Festival", start: "2026-12-12T12:00:00+01:00", hasTime: false, sourceCategory: "Dance", sourceId: "1345" });
  });
});

describe("Grenswerk (HTML agenda without year)", async () => {
  const { parseGrenswerk } = await import("../scripts/adapters/grenswerk");
  const ev = parseGrenswerk(fixture("grenswerk-agenda.html"), new Date("2026-11-26T10:00:00Z"));
  it("reads start time, sold-out and genre; skips shows in the Maaspoort theatre", () => {
    const jacek = ev.find((e) => e.title === "Jacek Stachursky");
    expect(jacek).toMatchObject({ start: "2026-12-05T19:00:00+01:00", hasTime: true, sourceCategory: "concert, Pop", ticketUrl: "https://tubilet.com/pl/wydarzenia/29/szczegoly" });
    expect(ev.find((e) => e.title === "Fortunate Sons")?.status).toBe("uitverkocht");
    expect(ev.map((e) => e.title)).not.toContain("DeWolff");
  });
});

describe("Pinkpop for Megaland (line-up per day)", async () => {
  const { parsePinkpop } = await import("../scripts/adapters/pinkpop");
  const ev = parsePinkpop(fixture("pinkpop-home.html"));
  it("makes one event per festival day with that day's acts", () => {
    expect(ev.map((e) => [e.title, e.start])).toEqual([
      ["Pinkpop 2027 (vrijdag)", "2027-06-18T12:00:00+02:00"],
      ["Pinkpop 2027 (zaterdag)", "2027-06-19T12:00:00+02:00"],
      ["Pinkpop 2027 (zondag)", "2027-06-20T12:00:00+02:00"],
    ]);
    expect(ev[2].artists).toContain("blink-182");
    expect(ev[0]).toMatchObject({ venueId: "megaland", sourceCategory: "festival", hasTime: false });
  });
});

describe("Doornroosje (HTML programme with month headings)", async () => {
  const { parseDoornroosje } = await import("../scripts/adapters/doornroosje");
  const ev = parseDoornroosje(fixture("doornroosje-home.html"));
  it("takes the year from the month heading and the date from the previous item for same-day shows", () => {
    expect(ev[0]).toMatchObject({ venueId: "doornroosje", title: "Shantel & Bucovina Club Soundsystem", start: "2026-11-26T12:00:00+01:00", hasTime: false });
    const sameDay = ev.find((e) => e.title === "NAFT");
    expect(sameDay?.start).toBe("2026-11-26T12:00:00+01:00");
    expect(ev.find((e) => e.title === "The Veils")?.artists).toEqual(["The Veils", "Anthonie Tonnon"]);
  });
});

describe("De Bosuil (HTML programme with month headings)", async () => {
  const { parseBosuil } = await import("../scripts/adapters/bosuil");
  const ev = parseBosuil(fixture("bosuil-programma.html"));
  it("reads day, genre, title and sold-out label", () => {
    expect(ev).toHaveLength(4);
    expect(ev[1]).toMatchObject({ venueId: "de-bosuil", title: "The Fortunate Sons", start: "2026-11-28T12:00:00+01:00", status: "uitverkocht", sourceCategory: "Rock" });
  });
});

describe("Mezz (own WordPress API)", async () => {
  const { parseMezz } = await import("../scripts/adapters/mezz");
  const ev = parseMezz(fixture("mezz-events.json"));
  it("reads Dutch dates, status and genre tags; skips shows in the Chassé theatre", () => {
    expect(ev).toHaveLength(2);
    expect(ev[0]).toMatchObject({ venueId: "mezz", title: "Prins S. en De Geit", start: "2026-11-26T12:00:00+01:00", hasTime: false, url: "https://www.mezz.nl/programma/prinssendegeit/", sourceId: "25100" });
    expect(ev[0].sourceCategory).toContain("hiphop");
    expect(ev[1].status).toBe("uitverkocht");
  });
});

describe("André Rieu for the Vrijthof", async () => {
  const { parseAndreRieu } = await import("../scripts/adapters/andre-rieu");
  const ev = parseAndreRieu(fixture("andrerieu-home.html"));
  it("keeps only the Vrijthof dates and reads the day in Dutch time", () => {
    expect(ev.length).toBeGreaterThanOrEqual(1);
    expect(ev.every((e) => e.venueId === "vrijthof")).toBe(true);
    expect(ev[0]).toMatchObject({ title: "André Rieu", start: "2027-07-01T12:00:00+02:00", url: "https://www.andrerieu.com/nl/tour/maastricht-1-juli-2027-nederland" });
  });
});

describe("Spot Groningen (De Oosterpoort + Stadsschouwburg)", async () => {
  const { parseSpot } = await import("../scripts/adapters/spot-groningen");
  const ev = parseSpot(fixture("spot-programma.html"));
  it("splits the two halls, reads time with offset and genres, skips other locations", () => {
    expect(ev).toHaveLength(4);
    expect(new Set(ev.map((e) => e.venueId))).toEqual(new Set(["oosterpoort", "stadsschouwburg-groningen"]));
    const breij = ev.find((e) => e.title === "Claudia de Breij");
    expect(breij).toMatchObject({ venueId: "stadsschouwburg-groningen", start: "2026-11-26T20:15:00+01:00", hasTime: true, status: "uitverkocht", sourceCategory: "cabaret" });
  });
});

describe("De Kattendans (Theater for WordPress)", async () => {
  const { parseWpTheatre } = await import("../scripts/adapters/wp-theatre");
  const ev = parseWpTheatre(fixture("kattendans-programma.html"), "kattendans");
  it("reads date with two-digit year, start time, category and sold-out", () => {
    expect(ev[1]).toMatchObject({ venueId: "kattendans", title: "Oscar Smit", start: "2026-11-26T20:30:00+01:00", hasTime: true, sourceCategory: "Cabaret", url: "https://kattendans.nl/voorstelling/oscar-smit/" });
    expect(ev[2]).toMatchObject({ title: "Roué Verveer", start: "2027-02-23T20:15:00+01:00", status: "uitverkocht" });
  });
});

describe("Maaspoort (programme pages)", async () => {
  const { parseMaaspoort } = await import("../scripts/adapters/maaspoort");
  const ev = parseMaaspoort(fixture("maaspoort-programma.html"));
  it("reads date and time from the show link, title + subtitle, genre and the cancelled label", () => {
    expect(ev).toHaveLength(3);
    expect(ev[0]).toMatchObject({ venueId: "maaspoort", title: "Johnny de Mol & band: Goed dat jij bestaat", artists: ["Johnny de Mol & band"], start: "2026-11-26T20:15:00+01:00", status: "geannuleerd", sourceCategory: "Show" });
    expect(ev[1].status).toBe("gepland");
  });
  it("skips shows in Grenswerk (own adapter)", () => {
    const html = fixture("maaspoort-programma.html").replace("Frans Boermans zaal", "Grenswerk");
    expect(parseMaaspoort(html)).toHaveLength(2);
  });
});

describe("Parkstad Limburg Theaters (three houses)", async () => {
  const { parsePlt, pltPages } = await import("../scripts/adapters/plt");
  const html = fixture("plt-programma.html");
  const ev = parsePlt(html);
  it("maps each tile to its house by the logo and reads genre, date and time", () => {
    expect(ev.map((e) => e.venueId)).toEqual(["toon-hermans-theater", "plt-heerlen", "plt-kerkrade"]);
    expect(ev[1]).toMatchObject({ title: "CATS", start: "2026-11-26T20:00:00+01:00", sourceCategory: "Musical" });
    expect(ev[0].title).toBe("Lex Uiting: Truuk Nao 't Zuuje");
  });
  it("reads the page count from the pagination", () => expect(pltPages(html)).toBe(53));
});

describe("Ticketmatic theatres (show page JSON-LD)", async () => {
  const { parseTicketmaticPage } = await import("../scripts/adapters/ticketmatic-theatre");
  it("Munttheater: TheaterEvent with performer and the first genre pill", () => {
    const url = "https://www.munttheater.nl/agenda/coming-on-strong-golden-earring-tribute";
    const ev = parseTicketmaticPage(fixture("munttheater-show.html"), url, { venueId: "munttheater", genre: ($) => $(".event-tags-wrapper .tag-pill").first().text().trim() });
    expect(ev).toHaveLength(1);
    expect(ev[0]).toMatchObject({ venueId: "munttheater", artists: ["Golden Earring Tribute"], start: "2027-01-20T20:15:00+01:00", hasTime: true, sourceCategory: "Muziek", sourceId: `${url}|2027-01-20T20:15:00+01:00` });
  });
  it("Stadsschouwburg Utrecht: company from the header data and genre from the info bar", () => {
    const ev = parseTicketmaticPage(fixture("stadsschouwburg-utrecht-show.html"), "https://stadsschouwburg-utrecht.nl/agenda/seizoen-2026-2027/x", {
      venueId: "stadsschouwburg-utrecht",
      genre: ($) => $(".event-info-wrapper p.item.lowercase").first().text().trim(),
    });
    expect(ev[0]).toMatchObject({ title: "Richard Groenendijk: Gelukkig heb je mij nog", artists: ["Richard Groenendijk"], start: "2027-02-24T20:00:00+01:00", sourceCategory: "Cabaret" });
  });
  it("tolerates a page without header data", () => {
    expect(parseTicketmaticPage("<html></html>", "https://x.nl/a", { venueId: "munttheater" })).toEqual([]);
  });
});

describe("Carré (site JSON)", async () => {
  const { parseCarre } = await import("../scripts/adapters/carre");
  const ev = parseCarre(fixture("carre-production.json"), "https://carre.nl/voorstelling/agnes-obel");
  it("reads every performance with sales status and genre name; skips performances elsewhere", () => {
    expect(ev).toHaveLength(2);
    expect(ev[0]).toMatchObject({ venueId: "carre", title: "Agnes Obel", start: "2027-09-27T20:00:00+02:00", status: "gepland", sourceCategory: "Concert internationaal", sourceId: "carre-36657" });
    expect(ev[1].status).toBe("uitverkocht");
  });
  it("rejects JSON of another shape", () => expect(() => parseCarre('{"node":1}', "https://carre.nl/x")).toThrow());
});

describe("DeLaMar (production page)", async () => {
  const { parseDelamar } = await import("../scripts/adapters/delamar");
  const ev = parseDelamar(fixture("delamar-production.html"), "https://delamar.nl/voorstellingen/sara-kroos/");
  it("reads one event per performance with time, genre and ticket link", () => {
    expect(ev).toHaveLength(2);
    expect(ev[0]).toMatchObject({ venueId: "delamar", title: "Sara Kroos: Prikkelarme Kermis", artists: ["Sara Kroos"], start: "2026-12-07T20:30:00+01:00", sourceCategory: "Cabaret", ticketUrl: "https://tickets.delamar.nl/nl/buyingflow/tickets/48417/106661/" });
  });
  it("returns nothing for a genre overview page without a production title", () => expect(parseDelamar("<html><body></body></html>", "https://delamar.nl/voorstellingen/cabaret/")).toEqual([]));
});

describe("Musis & Stadstheater (site API)", async () => {
  const { parseMusis } = await import("../scripts/adapters/musis");
  const { events, next } = parseMusis(fixture("musis-events.json"));
  it("reads time with offset, performer, genre tags without series labels, and the next page", () => {
    expect(events).toHaveLength(3);
    expect(events[0]).toMatchObject({ venueId: "musis-arnhem", start: "2026-11-26T20:30:00+01:00", status: "verplaatst", sourceCategory: "Muziektheater, Toneel", sourceId: "musis-10034" });
    expect(events[0].sourceCategory).not.toMatch(/Gelrepas|Language/);
    expect(next).toContain("page=2");
  });
});

describe("De Oranjerie Roermond (theaterroermond.nl)", async () => {
  const { parseRoermondAgenda, parseRoermondProduction } = await import("../scripts/adapters/theater-roermond");
  it("lists each production once with its genre", () => {
    expect(parseRoermondAgenda(fixture("roermond-agenda.html"))).toEqual([
      { url: "https://www.theaterroermond.nl/agenda/titanique", genre: "Musical" },
      { url: "https://www.theaterroermond.nl/agenda/the-best-of-sven-matthijs", genre: "Special" },
    ]);
  });
  it("reads the performances (not the dinner or parking rows) and picks the coming year", () => {
    const ev = parseRoermondProduction(fixture("roermond-production.html"), "https://www.theaterroermond.nl/agenda/titanique", "Musical", new Date("2026-11-26T12:00:00Z"));
    expect(ev.map((e) => e.start)).toEqual(["2026-11-27T20:00:00+01:00", "2026-11-28T20:00:00+01:00"]);
    // "Vr 27 nov" is a Friday in 2026, not in 2027: after the date it stays in the past (the pipeline drops it).
    const later = parseRoermondProduction(fixture("roermond-production.html"), "https://www.theaterroermond.nl/agenda/titanique", "Musical", new Date("2026-12-15T12:00:00Z"));
    expect(later[0].start).toBe("2026-11-27T20:00:00+01:00");
  });
});

describe("Year for a date without year (weekday check)", async () => {
  const { yearFor } = await import("../scripts/adapters/theater-roermond");
  const today = new Date("2026-11-26T12:00:00Z");
  it("uses the weekday: Sunday 27 June is in 2027; without weekday the next occurrence", () => {
    expect(yearFor(27, 6, "zo", today)).toBe(2027);
    expect(yearFor(27, 6, "za", today)).toBe(2026); // a Saturday 27 June is in the past: dropped later, not moved a year
    expect(yearFor(27, 6, undefined, today)).toBe(2027);
  });
});

describe("De Oranjerie Roermond, production with one date", async () => {
  const { parseRoermondProduction } = await import("../scripts/adapters/theater-roermond");
  it("reads the single-date layout (date in a div)", () => {
    const ev = parseRoermondProduction(fixture("roermond-production-single.html"), "https://www.theaterroermond.nl/agenda/the-best-of-sven-matthijs", "Special", new Date("2026-11-26T12:00:00Z"));
    expect(ev).toHaveLength(1);
    expect(ev[0]).toMatchObject({ title: "The Best of Sven & Matthijs!", start: "2026-12-01T20:00:00+01:00" });
  });
});

describe("Uit in Amsterdam (iamsterdam.com) for Melkweg and Paradiso", async () => {
  const { parseIamsterdamPage, parseIamsterdamDetail, cardEvents } = await import("../scripts/adapters/iamsterdam");
  const { cards, total } = parseIamsterdamPage(fixture("iamsterdam-agenda.html"));
  it("reads the cards from the RSC payload with location and dates", () => {
    expect(total).toBe(131);
    expect(cards).toHaveLength(3);
    expect(cards[0]).toMatchObject({ title: "Cheeky Monday", location: "Melkweg", dates: ["2026-10-26T23:00:00.000Z", "2026-11-30T23:00:00.000Z"] });
  });
  it("keeps only our venues and reads card times as Amsterdam wall-clock time", () => {
    expect(cardEvents(cards[2], cards[2].dates)).toEqual([]);
    const [ev] = cardEvents(cards[0], cards[0].dates.slice(0, 1));
    expect(ev).toMatchObject({ venueId: "melkweg", start: "2026-10-26T23:00:00+01:00", hasTime: true, url: "https://www.iamsterdam.com/uit/agenda/nachtleven/clubbing/cheeky-monday" });
  });
  it("takes the status of a one-day card from its badges", () => {
    const [ev] = cardEvents({ ...cards[0], badges: ["Geannuleerd"] }, cards[0].dates.slice(0, 1));
    expect(ev.status).toBe("geannuleerd");
  });
  it("reads every date and the sold-out flag from a detail page", () => {
    const detail = parseIamsterdamDetail(fixture("iamsterdam-event.html"));
    expect(detail).toEqual({ dates: ["2026-11-04T19:00:00+00:00", "2027-03-17T19:00:00+00:00"], soldOut: true, cancelled: false });
    const evs = cardEvents({ ...cards[0], location: "Paradiso" }, detail.dates, detail);
    expect(evs.map((e) => [e.venueId, e.start, e.status])).toEqual([
      ["paradiso", "2026-11-04T19:00:00+01:00", "uitverkocht"],
      ["paradiso", "2027-03-17T19:00:00+01:00", "uitverkocht"],
    ]);
  });
});

describe("Clubs (B49)", async () => {
  const { parseWeTicketFeed, agendaLinks } = await import("../scripts/adapters/clubs");
  const { parseJsonLdPage } = await import("../scripts/adapters/jsonld-page");
  const { classify } = await import("../scripts/lib/categorize");
  it("Garage Noord: reads the WeTicket RSS feed with UTC start times", () => {
    const ev = parseWeTicketFeed(fixture("weticket-feed.xml"), "garage-noord");
    expect(ev).toHaveLength(2);
    expect(ev[0]).toMatchObject({ venueId: "garage-noord", start: "2026-11-26T21:00:00+01:00", hasTime: true, sourceCategory: "clubnacht" });
    expect(ev[0].url).toMatch(/^https:\/\/garagenoord\.weticket\.io\//);
    expect(() => parseWeTicketFeed("<rss><channel></channel></rss>", "garage-noord")).toThrow();
  });
  it("Lofi: JSON-LD nights get the club label and count as Dance & DJ", () => {
    const ev = parseJsonLdPage(fixture("lofi-events.html"), { venueId: "lofi", country: "NL", url: "https://lofi.amsterdam/events/", category: "clubnacht" });
    expect(ev).toHaveLength(2);
    expect(ev[0]).toMatchObject({ venueId: "lofi", sourceCategory: "clubnacht", hasTime: false });
    expect(classify(ev[0].title, ev[0].sourceCategory).genre).toBe("Dance");
  });
  it("Complex: finds the event pages on the agenda, without the archive or other pages", () => {
    const links = agendaLinks(fixture("complex-agenda.html"), "https://complexmaastricht.nl/agenda", /^https:\/\/complexmaastricht\.nl\/agenda\/(?!archive)[^/?#]+$/);
    expect(links).toEqual(["https://complexmaastricht.nl/agenda/atmoz-5-12-26", "https://complexmaastricht.nl/agenda/bingoloco-04-12-26", "https://complexmaastricht.nl/agenda/bingoloco-04-12-26lateshow"]);
  });
});
