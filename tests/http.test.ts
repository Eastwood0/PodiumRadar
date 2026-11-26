import { afterEach, describe, expect, it, vi } from "vitest";
import { politeGet } from "../scripts/lib/http";

/** Fake network: url → [status, body, location?]. */
function network(routes: Record<string, [number, string, string?]>) {
  const seen: string[] = [];
  vi.stubGlobal("fetch", async (url: string) => {
    seen.push(url);
    const [status, body, location] = routes[url] ?? [404, ""];
    return new Response(status >= 300 && status < 400 ? null : body, { status, headers: location ? { location } : {} });
  });
  return seen;
}
afterEach(() => vi.unstubAllGlobals());

describe("politeGet and robots.txt (RFC 9309)", () => {
  it("treats an unreachable robots.txt (5xx) as 'everything disallowed'", async () => {
    const seen = network({ "https://a.example/robots.txt": [503, ""], "https://a.example/agenda": [200, "x"] });
    const r = await politeGet("https://a.example/agenda");
    expect(r.robotsBlocked).toBe(true);
    expect(seen).not.toContain("https://a.example/agenda");
  });
  it("treats a missing robots.txt (404) as 'everything allowed'", async () => {
    network({ "https://b.example/agenda": [200, "ok"] });
    expect((await politeGet("https://b.example/agenda")).body).toBe("ok");
  });
  it("checks a redirect target against that site's own robots.txt", async () => {
    const seen = network({
      "https://c.example/robots.txt": [200, "User-agent: *\nAllow: /\n"],
      "https://c.example/agenda": [301, "", "https://d.example/private/agenda"],
      "https://d.example/robots.txt": [200, "User-agent: *\nDisallow: /private\n"],
      "https://d.example/private/agenda": [200, "secret"],
    });
    const r = await politeGet("https://c.example/agenda");
    expect(r.robotsBlocked).toBe(true);
    expect(seen).not.toContain("https://d.example/private/agenda");
  }, 10_000);
  it("follows an allowed redirect and reports where it ended", async () => {
    network({ "https://e.example/old": [302, "", "/new"], "https://e.example/new": [200, "moved"] });
    const r = await politeGet("https://e.example/old");
    expect([r.body, r.finalUrl]).toEqual(["moved", "https://e.example/new"]);
  }, 10_000);
});
