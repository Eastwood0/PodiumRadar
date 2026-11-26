import { describe, expect, it } from "vitest";
import { isAllowed, parseRobots } from "../scripts/lib/robots";

const txt = `
User-agent: Googlebot
Disallow: /

User-agent: *
Disallow: /admin/
Disallow: /*?sort=
Allow: /admin/public$
Sitemap: https://example.com/sitemap.xml
`;

describe("robots.txt", () => {
  const r = parseRobots(txt);
  it("uses the * group when no specific group matches", () => {
    expect(isAllowed(r, "/agenda")).toBe(true);
    expect(isAllowed(r, "/admin/x")).toBe(false);
  });
  it("supports wildcards and $ anchors, longest match wins", () => {
    expect(isAllowed(r, "/agenda?sort=date")).toBe(false);
    expect(isAllowed(r, "/admin/public")).toBe(true);
    expect(isAllowed(r, "/admin/public/2")).toBe(false);
  });
  it("collects sitemaps", () => {
    expect(r.sitemaps).toEqual(["https://example.com/sitemap.xml"]);
  });
  it("prefers a group naming our bot", () => {
    const own = parseRobots("User-agent: *\nDisallow: /\n\nUser-agent: PodiumradarBot\nDisallow: /private\n");
    expect(isAllowed(own, "/agenda")).toBe(true);
    expect(isAllowed(own, "/private/a")).toBe(false);
  });
  it("allows everything for an empty file", () => {
    expect(isAllowed(parseRobots(""), "/anything")).toBe(true);
  });
  it("reads Crawl-delay for our group", () => {
    expect(parseRobots("User-agent: *\nCrawl-delay: 2\nDisallow: /x\n").crawlDelay).toBe(2);
    expect(parseRobots("User-agent: SemrushBot\nCrawl-delay: 10\n\nUser-agent: *\nDisallow: /x\n").crawlDelay).toBeUndefined();
  });
});
