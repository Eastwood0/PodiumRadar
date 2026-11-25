import { describe, expect, it } from "vitest";
import { extractJsonLdEvents } from "../scripts/lib/jsonld";

const page = (blocks: string[]) =>
  `<html><head>${blocks.map((b) => `<script type="application/ld+json">${b}</script>`).join("")}</head><body></body></html>`;

describe("extractJsonLdEvents", () => {
  it("finds MusicEvent objects inside @graph and ItemList", () => {
    const html = page([
      JSON.stringify({ "@context": "https://schema.org", "@graph": [{ "@type": "Organization", name: "Zaal" }, { "@type": "MusicEvent", name: "Band A", startDate: "2027-03-01T20:00:00+01:00", location: { "@type": "Place", name: "Zaal" }, performer: [{ "@type": "MusicGroup", name: "Band A" }], offers: { url: "https://tickets.example.com/a" } }] }),
      JSON.stringify({ "@type": "ItemList", itemListElement: [{ "@type": "ListItem", item: { "@type": ["Event"], name: "Show B", startDate: "2027-04-02" } }] }),
    ]);
    const { events, blocks, parseErrors } = extractJsonLdEvents(html);
    expect(blocks).toBe(2);
    expect(parseErrors).toBe(0);
    expect(events.map((e) => e.name)).toEqual(["Band A", "Show B"]);
    expect(events[0]).toMatchObject({ type: "MusicEvent", locationName: "Zaal", performers: ["Band A"], offersUrl: "https://tickets.example.com/a" });
  });

  it("counts broken JSON without throwing", () => {
    const { events, parseErrors } = extractJsonLdEvents(page(["{ not json", JSON.stringify({ "@type": "Event", name: "X" })]));
    expect(parseErrors).toBe(1);
    expect(events).toHaveLength(1);
  });

  it("ignores non-event types", () => {
    expect(extractJsonLdEvents(page([JSON.stringify({ "@type": "WebSite", name: "x" })])).events).toEqual([]);
  });
});
