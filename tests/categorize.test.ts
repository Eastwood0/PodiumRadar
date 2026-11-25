import { describe, expect, it } from "vitest";
import { classify } from "../scripts/lib/categorize";

const none = { muziek: [], overig: [] as [string, never][] };
const c = (title: string, source?: string) => {
  const r = classify(title, source, none);
  return `${r.category}/${r.genre}/${r.reason}`;
};

describe("classify", () => {
  it("trusts the venue's own label in several languages", () => {
    expect(c("Westlife", "Konzert")).toBe("muziek/Concert/bron");
    expect(c("Hazel Brugger", "Comedy")).toBe("overig/Comedy/bron");
    expect(c("Kölner Haie - Straubing Tigers", "Eishockey")).toBe("overig/Sport/bron");
    expect(c("Matthias Goerne zingt Winterreise", "Klassieke muziek")).toBe("muziek/Klassiek/bron");
    expect(c("Thunderdome 2026", "Hardcore, Dance")).toBe("muziek/Dance/bron");
    expect(c("Gad Elmaleh", "Humour")).toBe("overig/Comedy/bron");
    expect(c("EXCELLENT woonbeurs", "Evenementen")).toBe("overig/Beurs/bron");
    expect(c("FOTODOK Book Talks", "Lezingen")).toBe("overig/Lezing/bron");
  });

  it("recognises sport, fairs, family shows and comedy in titles", () => {
    expect(c("Ajax - FC Thun")).toBe("overig/Sport/titel");
    expect(c("Icon League")).toBe("overig/Sport/titel");
    expect(c("CARDS & GAMES Dortmund")).toBe("overig/Beurs/titel");
    expect(c("De Letterliedjes Show (6+)")).toBe("overig/Familie/titel");
    expect(c("Let’s Dance")).toBe("overig/Show/titel");
    expect(c("Die besten Comedians Deutschlands")).toBe("overig/Comedy/titel");
  });

  it("recognises music words, and marks plain names as a guess", () => {
    expect(c("Lord of the Rings in Concert")).toBe("muziek/Klassiek/titel");
    expect(c("Legends of Rock Tribute Festival XL")).toBe("muziek/Festival/titel");
    expect(c("Muse")).toBe("muziek/Concert/gok");
  });

  it("applies manual corrections first", () => {
    const corr = { muziek: ["Let's Dance Band"], overig: [["Kaya Yanar", "Comedy"]] as [string, "Comedy"][] };
    expect(classify("KAYA YANAR", "Musik", corr)).toMatchObject({ category: "overig", genre: "Comedy", reason: "correctie" });
    expect(classify("Özcan Cosar – VIP", undefined, { muziek: [], overig: [["ozcan cosar", "Comedy"]] })).toMatchObject({ genre: "Comedy" });
  });
});

describe("classify with the real corrections file", () => {
  it("knows the comedians that venues list without a category", () => {
    expect(classify("Torsten Sträter")).toMatchObject({ category: "overig", genre: "Comedy", reason: "correctie" });
    expect(classify("Atze Schröder - „Lovemachine”")).toMatchObject({ genre: "Comedy" });
  });
  it("leaves musicians alone", () => {
    expect(classify("Take That").category).toBe("muziek");
  });
});
