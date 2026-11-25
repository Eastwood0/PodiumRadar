import { load } from "cheerio";
import { fetchText } from "../lib/http";
import { localToIso, monthNumber, TZ_BY_COUNTRY } from "../lib/dates";
import type { Adapter, SourceEvent } from "./types";

const BASE = "https://www.gelredome.nl";

/** Parses one GelreDome agenda page (Webflow CMS list). Level 3 (HTML). */
export function parseGelredome(html: string): { events: SourceEvent[]; next?: string } {
  const $ = load(html);
  const events: SourceEvent[] = [];
  $(".card-overview-text--wrapper").each((_, el) => {
    const card = $(el);
    const wrapper = card.parent();
    const title = card.find(".cards-overview-heading").first().text().trim();
    const href = card.find('a[href^="/evenement/"]').attr("href");
    const dateLabel = card.find(".label-group .label").filter((_, l) => $(l).find(".date-transl").length > 0).first();
    const parts = dateLabel.children("div").map((_, d) => $(d).text().trim()).get(); // ["08", "mei", "2027"]
    const mo = monthNumber(parts[1] ?? "");
    if (!title || !href || !mo || !/^\d{1,2}$/.test(parts[0] ?? "") || !/^\d{4}$/.test(parts[2] ?? "")) return;
    const { start, hasTime } = localToIso(+parts[2], mo, +parts[0], undefined, TZ_BY_COUNTRY.NL);
    // Webflow keeps hidden labels in the page with class w-condition-invisible; only visible ones count.
    const soldOut = wrapper
      .find(".label.is-red")
      .toArray()
      .some((l) => !$(l).hasClass("w-condition-invisible") && /^uitverkocht$/i.test($(l).text().trim()));
    const ticket = card.find('a.button[target="_blank"]').attr("href");
    // Category tags of the card (the site's own filter tags), without the editorial tag "Populair".
    const tags = wrapper
      .find('[fs-cmsfilter-field="event-tag"]')
      .map((_, t) => $(t).text().trim())
      .get()
      .filter((t) => t && !/^populair$/i.test(t));
    events.push({
      venueId: "gelredome",
      title,
      start,
      hasTime,
      status: soldOut ? "uitverkocht" : undefined,
      sourceCategory: tags.join(", ") || undefined,
      url: BASE + href,
      ticketUrl: ticket?.startsWith("http") ? ticket : undefined,
      sourceId: href.replace("/evenement/", ""),
      imageUrl: wrapper.find("img.full-media").attr("src"),
    });
  });
  const nextHref = $("a.w-pagination-next").attr("href");
  return { events, next: nextHref ? new URL(nextHref, `${BASE}/agenda`).href : undefined };
}

export const gelredome: Adapter = {
  name: "gelredome.nl",
  venues: ["gelredome"],
  async fetch() {
    const all: SourceEvent[] = [];
    let url: string | undefined = `${BASE}/agenda`;
    for (let i = 0; url && i < 20; i++) {
      const { body } = await fetchText(url);
      const { events, next } = parseGelredome(body);
      all.push(...events);
      url = next;
    }
    return all;
  },
};
