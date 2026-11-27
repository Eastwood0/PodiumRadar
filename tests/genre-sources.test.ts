import { describe, expect, it } from "vitest";
import { classify } from "../scripts/lib/categorize";
import { applyArtistGenres, artistKey, type DanceStyle, eventDanceStyles, eventGenres, fromItunesGenre, genresInText, type MusicGenre, tributeTarget, withoutTour } from "../scripts/lib/music-genre";
import { artistsFromTitle } from "../scripts/lib/normalize";
import { pickItunes } from "../scripts/genres";

const none = { muziek: [], overig: [] };

describe("line-ups and act names (B55)", () => {
  it("splits a club night after 'presents' so every DJ can be looked up", () => {
    expect(artistsFromTitle("Claydrum presents Nico Moreno / Carla Schmitt / Melvin Spix", { lineup: true })).toEqual(["Nico Moreno", "Carla Schmitt", "Melvin Spix"]);
    expect(artistsFromTitle("Amelie Lens, Reinier Zonneveld b2b Kobosil & more", { lineup: true })).toEqual(["Amelie Lens", "Reinier Zonneveld", "Kobosil"]);
  });
  it("does not split a band name with '&' when nothing else says it is a list", () => {
    expect(artistsFromTitle("Simon & Garfunkel Story", { lineup: true })).toEqual(["Simon & Garfunkel Story"]);
    expect(artistsFromTitle("Kool & The Gang")).toEqual(["Kool & The Gang"]);
  });
  it("drops '& band', '& Vrienden', '30 Jahre' and 'All Night' so the act can be looked up", () => {
    expect(artistsFromTitle("Maaike Ouboter & band")).toEqual(["Maaike Ouboter"]);
    expect(artistsFromTitle("BLØF & Vrienden")).toEqual(["BLØF"]);
    expect(artistsFromTitle("30 Jahre Peter Wackel")).toEqual(["Peter Wackel"]);
    expect(artistsFromTitle("Lucky Done Gone - All Night")).toEqual(["Lucky Done Gone"]);
    expect(artistsFromTitle("Elmiene+ Jahson Paynter")).toEqual(["Elmiene", "Jahson Paynter"]);
    expect(tributeTarget("We All Sing ABBA")).toBe("ABBA");
  });
  it("drops tour names, years and notes from the act's name", () => {
    expect(artistsFromTitle("Oasis Live '27")).toEqual(["Oasis"]);
    expect(artistsFromTitle("Froukje - Extra show")).toEqual(["Froukje"]);
    expect(artistsFromTitle("John Summit – Europe CTRL Escape Tour")).toEqual(["John Summit"]);
    expect(artistsFromTitle("Deryck Whibley (Sum 41)")).toEqual(["Deryck Whibley"]);
    expect(artistsFromTitle("Stef Bos: Een nieuwe show")).toEqual(["Stef Bos"]);
  });
});

describe("category words inside compound words, venue type as fallback", () => {
  it("reads PubQuiz, Banenbeurs, TattooCon and IEM as not music", () => {
    for (const t of ["PubQuiz: Bij Benee", "De Noordelijke Banenbeurs 2027", "30th TattooCon Dortmund", "IEM Cologne 2027"]) expect(classify(t, undefined, none).category, t).toBe("overig");
  });
  it("reads basketball, illusionists and children's musicals as not music, hit shows as pop", () => {
    for (const t of ["Donar Groningen – Kangoeroes Basket Mechelen 2026", "Hans Klok - The Illusionists", "De Nog Grotere Slijmmusical"]) expect(classify(t, undefined, none).category, t).toBe("overig");
    expect(genresInText("Qmusic Top 40 Live")).toEqual(["Pop"]);
    expect(genresInText("Classic Hits In Concert")).toEqual(["Pop"]);
  });
  it("reads Lunchconcert and Herfstconcert as music", () => {
    expect(classify("Kyella: Lunchconcert", undefined, none, "theater").category).toBe("muziek");
    expect(classify("Verrassende Ontmoetingen: Herfstconcert", undefined, none, "theater").category).toBe("muziek");
  });
  it("keeps Bad Company a band but Jakop Ahlbom Company a theatre group", () => {
    expect(classify("Bad Company", undefined, none).category).toBe("muziek");
    expect(classify("Jakop Ahlbom Company: A Fine Mess", undefined, none).category).toBe("overig");
  });
  it("uses the venue type only when nothing else is known", () => {
    expect(classify("Jade Mintjens: Bedankt om te komen", undefined, none, "theater")).toMatchObject({ category: "overig", reason: "gok" });
    expect(classify("Exproz", undefined, none, "club")).toMatchObject({ category: "muziek", genre: "Dance" });
    expect(classify("Exproz", undefined, none)).toMatchObject({ category: "muziek", genre: "Concert" });
  });
});

describe("iTunes Search as second source", () => {
  it("maps Apple's genre names", () => {
    expect(fromItunesGenre("Techno")).toEqual({ genres: ["Dance & DJ"], dance: ["Techno"] });
    expect(fromItunesGenre("Hip-Hop/Rap").genres).toEqual(["Hiphop & R&B"]);
    expect(fromItunesGenre("Singer/Songwriter").genres).toEqual(["Folk & singer-songwriter"]);
    expect(fromItunesGenre("Metal").genres).toEqual(["Metal & punk"]);
  });
  it("gives no genre for comedy, soundtracks and children's music", () => {
    for (const g of ["Comedy", "Soundtrack", "Children's Music"]) expect(fromItunesGenre(g).genres, g).toEqual([]);
  });
  it("accepts only an artist with exactly this name, never a near namesake", () => {
    const results = [{ artistName: "Nico Morano", primaryGenreName: "Pop" }, { artistName: "Nico Moreno", primaryGenreName: "Techno" }];
    expect(pickItunes("Nico Moreno", results)?.primaryGenreName).toBe("Techno");
    expect(pickItunes("Nico Moren", results)).toBeUndefined();
  });
});

describe("applying artist genres", () => {
  const cache = {
    [artistKey("Nico Moreno")]: { genres: ["Dance & DJ" as const], dance: ["Techno" as const], checked: "2026-11-27" },
    [artistKey("Carla Schmitt")]: { genres: ["Dance & DJ" as const], dance: ["Techno" as const], checked: "2026-11-27" },
    [artistKey("Melvin Spix")]: { genres: ["Dance & DJ" as const], dance: ["House" as const], checked: "2026-11-27" },
    [artistKey("AC/DC")]: { genres: ["Rock" as const], checked: "2026-11-27" },
    [artistKey("Remy van Kesteren")]: { genres: ["Klassiek" as const], checked: "2026-11-27" },
    [artistKey("Jade Mintjens")]: { genres: [], checked: "2026-11-27", itunes: "2026-11-27" },
  };
  type Ev = { category: string; genre?: string; categoryGuess?: true; artists: { name: string }[]; musicGenres?: MusicGenre[]; danceStyles?: DanceStyle[] };
  const ev = (artists: string[], extra: Partial<Ev> = {}): Ev => ({ category: "muziek", artists: artists.map((name) => ({ name })), ...extra });

  it("gives a club night the style most of its line-up has", () => {
    const [e] = applyArtistGenres([ev(["Nico Moreno", "Carla Schmitt", "Melvin Spix"], { musicGenres: ["Dance & DJ"] })], cache);
    expect(e.danceStyles).toEqual(["Techno"]);
  });
  it("labels a tribute show with the genre of the act it pays tribute to", () => {
    expect(tributeTarget("AC/DC tribute")).toBe("AC/DC");
    expect(tributeTarget("Tribute to Queen")).toBe("Queen");
    expect(applyArtistGenres([ev(["AC/DC tribute"])], cache)[0].musicGenres).toEqual(["Rock"]);
  });
  it("turns a theatre guess into a concert only when the performer is a known musician", () => {
    const guess = { category: "overig", genre: "Toneel", categoryGuess: true as const };
    expect(applyArtistGenres([ev(["Remy van Kesteren"], guess)], cache)[0]).toMatchObject({ category: "muziek", musicGenres: ["Klassiek"] });
    expect(applyArtistGenres([ev(["Jade Mintjens"], guess)], cache)[0]).toMatchObject({ category: "overig" });
    // A real theatre label (no guess) is never overruled.
    expect(applyArtistGenres([ev(["Remy van Kesteren"], { category: "overig", genre: "Toneel" })], cache)[0].category).toBe("overig");
  });
});

describe("false positives found by Codex (27 Nov 2026)", () => {
  it("does not read tour names as genres", () => {
    expect(eventGenres("U2 – World Tour", undefined, "Concert")).toEqual([]);
    expect(eventDanceStyles("Sienna Spiro – My House Tour", undefined)).toEqual([]);
    expect(withoutTour("Sienna Spiro – My House Tour 2027")).toBe("Sienna Spiro");
  });
  it("keeps hardcore punk out of Dance & DJ, also as the venue's own label", () => {
    expect(classify("Integrity", "Hardcore punk", none).genre).not.toBe("Dance");
    expect(genresInText("hardcore punk")).toEqual(["Metal & punk"]);
    expect(genresInText("hardcore")).toContain("Dance & DJ");
  });
  it("reads 'klassiekers' (pop classics) as no genre, 'Klassieke muziek' as classical", () => {
    expect(classify("The Scene", "klassiekers / tributes", none).genre).not.toBe("Klassiek");
    expect(classify("Winterreise", "Klassieke muziek", none).genre).toBe("Klassiek");
  });
  it("puts a horse show under sport", () => {
    expect(classify("Jumping Amsterdam – Concours Hippique", undefined, none).category).toBe("overig");
  });
  it("finds the act behind a tribute show, also after a show name", () => {
    expect(tributeTarget("Völkerball – A Tribute to Rammstein")).toBe("Rammstein");
    expect(tributeTarget("Starman – David Bowie Tribute")).toBe("David Bowie");
    expect(tributeTarget("60 years of Pink Floyd: A Pink Floyd Experience")).toBe("Pink Floyd");
    expect(tributeTarget("Nathan Ball")).toBeUndefined();
  });
  it("skips namesakes with different genres on iTunes", () => {
    const two = [{ artistName: "Annie", primaryGenreName: "Pop" }, { artistName: "Annie", primaryGenreName: "Electronic" }];
    expect(pickItunes("Annie", two)).toBeUndefined();
  });
});

