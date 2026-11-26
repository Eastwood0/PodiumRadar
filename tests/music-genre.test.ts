import { describe, expect, it } from "vitest";
import { artistKey, genresFromTags, genresInText } from "../scripts/lib/music-genre";

describe("genresInText", () => {
  it("reads source labels in Dutch, German and English", () => {
    expect(genresInText("Hardstyle")).toEqual(["Dance & DJ"]);
    expect(genresInText("Klassik")).toEqual(["Klassiek"]);
    expect(genresInText("Hip-Hop / Rap")).toEqual(["Hiphop & R&B"]);
    expect(genresInText("Schlager")).toEqual(["Schlager"]);
    expect(genresInText("Nederlandstalig")).toEqual(["Nederlandstalig"]);
    expect(genresInText("Deutschrap")).toEqual(["Hiphop & R&B"]);
  });
  it("puts post-punk under rock and dance-pop under pop and dance", () => {
    expect(genresInText("post-punk")).toEqual(["Rock"]);
    expect(genresInText("dance-pop")).toEqual(expect.arrayContaining(["Pop", "Dance & DJ"]));
  });
  it("does not read nationality as a genre", () => {
    expect(genresInText("dutch")).toEqual([]);
    expect(genresInText("Kensington")).toEqual([]);
  });
});

describe("genresFromTags", () => {
  it("lets the strongest tags win and drops stray ones", () => {
    const tags = [
      { name: "alternative rock", count: 12 },
      { name: "rock", count: 8 },
      { name: "britpop", count: 3 },
      { name: "electronic", count: 2 },
      { name: "dutch", count: 9 },
    ];
    expect(genresFromTags(tags)).toEqual(["Rock"]);
  });
  it("keeps two genres when both are strong", () => {
    expect(genresFromTags([{ name: "trance", count: 10 }, { name: "pop", count: 6 }, { name: "progressive trance", count: 4 }])).toEqual(["Dance & DJ", "Pop"]);
  });
  it("returns nothing without useful tags", () => {
    expect(genresFromTags([])).toEqual([]);
    expect(genresFromTags([{ name: "seen live", count: 5 }])).toEqual([]);
  });
});

describe("artistKey", () => {
  it("normalises names for the cache", () => {
    expect(artistKey("Beyoncé")).toBe("beyonce");
    expect(artistKey("Kool & The Gang")).toBe("kool and the gang");
  });
});

describe("pickArtist (MusicBrainz match)", async () => {
  const { pickArtist } = await import("../scripts/genres");
  const muse = (id: string, votes: number, score = 100) => ({ id, name: "Muse", score, tags: [{ name: "rock", count: votes }] });
  it("takes the best-known namesake", () => {
    expect(pickArtist("Muse", [muse("small", 1), muse("big", 40)])?.id).toBe("big");
  });
  it("accepts an alias and ignores other names and low scores", () => {
    expect(pickArtist("Beyonce", [{ id: "b", name: "Beyoncé", score: 100 }])?.id).toBe("b");
    expect(pickArtist("Rowwen Heze", [{ id: "x", name: "Rowwen Hèze Tribute", score: 95 }])).toBeUndefined();
    expect(pickArtist("Muse", [muse("weak", 50, 70)])).toBeUndefined();
    expect(pickArtist("Doe Maar", [{ id: "d", name: "Doe Maar!", score: 92, aliases: [{ name: "Doe Maar" }] }])?.id).toBe("d");
  });
});

describe("dance styles", async () => {
  const { danceStylesInText, danceStylesFromTags, eventDanceStyles, applyArtistGenres } = await import("../scripts/lib/music-genre");
  it("reads styles from labels and titles", () => {
    expect(danceStylesInText("Clubnacht, Nederhop, EDM, Deephouse")).toEqual(["House", "EDM"]);
    expect(danceStylesInText("Hardcore")).toEqual(["Hardstyle & hardcore"]);
    expect(danceStylesInText("hardcore punk")).toEqual([]);
    expect(eventDanceStyles("Awakenings: Techno all night", "dance")).toEqual(["Techno"]);
    expect(danceStylesInText("Drum & Bass")).toEqual(["Drum & bass"]);
  });
  it("votes with tag counts", () => {
    expect(danceStylesFromTags([{ name: "techno", count: 9 }, { name: "minimal techno", count: 3 }, { name: "house", count: 1 }])).toEqual(["Techno"]);
  });
  it("fills dance styles from the artist cache for dance events", () => {
    const events: { category: string; artists: { name: string }[]; musicGenres: "Dance & DJ"[]; danceStyles?: ("Techno" | "House")[] }[] = [{ category: "muziek", artists: [{ name: "Charlotte de Witte" }], musicGenres: ["Dance & DJ"] }];
    const out = applyArtistGenres(events, { "charlotte de witte": { genres: ["Dance & DJ"], dance: ["Techno"], checked: "2026-11-26" } });
    expect(out[0].danceStyles).toEqual(["Techno"]);
  });
});
