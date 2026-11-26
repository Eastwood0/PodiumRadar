import { describe, expect, it } from "vitest";
import { cleanCode, type D1Like, type Env, handleApi, MAX_ARTISTS, newCode } from "../src/lib/sync-api";
import worker from "../src/worker";

/** In-memory stand-in for D1 that understands exactly the statements the worker uses. */
function fakeDb(): D1Like & { rows: Map<string, { artists: string; updated_at: string }> } {
  const rows = new Map<string, { artists: string; updated_at: string }>();
  return {
    rows,
    exec: async () => undefined,
    prepare(sql: string) {
      return {
        bind(...v: unknown[]) {
          return {
            async first<T>() {
              const row = rows.get(String(v[0]));
              if (!row) return null;
              return (sql.startsWith("SELECT 1") ? { x: 1 } : row) as T;
            },
            async run() {
              if (sql.startsWith("INSERT")) rows.set(String(v[0]), { artists: String(v[1]), updated_at: String(v[2]) });
              else if (sql.startsWith("UPDATE")) rows.set(String(v[2]), { artists: String(v[0]), updated_at: String(v[1]) });
              else if (sql.startsWith("DELETE")) rows.delete(String(v[0]));
              return {};
            },
          };
        },
      };
    },
  };
}

const env = (): Env & { DB: ReturnType<typeof fakeDb> } => ({ DB: fakeDb(), ASSETS: { fetch: async () => new Response("static") } });
const BASE = "https://podiumradar.example/api/sync";
const body = (artists: unknown, extra: RequestInit = {}) => ({ method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ artists }), ...extra });
const call = (e: Env, path: string, init?: RequestInit) => handleApi(new Request(BASE + path, init), e);

describe("link code", () => {
  it("is 26 characters from the unambiguous alphabet and differs every time", () => {
    const a = newCode();
    expect(a).toMatch(/^[0-9A-HJKMNP-TV-Z]{26}$/);
    expect(newCode()).not.toBe(a);
  });
  it("is read as typed: lower case, dashes, O for 0", () => {
    const c = newCode(() => new Uint8Array(16).fill(0));
    expect(c).toBe("0".repeat(26));
    expect(cleanCode("oooo-0000 0000-0000-0000-0000-00")).toBe(c);
    expect(cleanCode("too-short")).toBeUndefined();
  });
});

describe("/api/sync", () => {
  it("creates a code, stores only a hash of it, and returns the list for that code", async () => {
    const e = env();
    const res = await call(e, "", body(["Backstreet Boys", "Within Temptation"]));
    expect(res.status).toBe(201);
    const { code } = (await res.json()) as { code: string };
    expect([...e.DB.rows.keys()][0]).toMatch(/^[0-9a-f]{64}$/);
    expect([...e.DB.rows.keys()][0]).not.toContain(code);
    const got = await call(e, `/${code}`);
    expect(await got.json()).toMatchObject({ artists: ["Backstreet Boys", "Within Temptation"] });
    expect(got.headers.get("cache-control")).toBe("no-store");
  });

  it("two codes each see only their own list", async () => {
    const e = env();
    const a = ((await (await call(e, "", body(["Anouk"]))).json()) as { code: string }).code;
    const b = ((await (await call(e, "", body(["Rammstein"]))).json()) as { code: string }).code;
    await call(e, `/${a}`, { ...body(["Anouk", "Racoon"]), method: "PUT" });
    expect(((await (await call(e, `/${a}`)).json()) as { artists: string[] }).artists).toEqual(["Anouk", "Racoon"]);
    expect(((await (await call(e, `/${b}`)).json()) as { artists: string[] }).artists).toEqual(["Rammstein"]);
  });

  it("refuses invalid and unknown codes", async () => {
    const e = env();
    expect((await call(e, "/not-a-code")).status).toBe(400);
    expect((await call(e, `/${newCode()}`)).status).toBe(404);
    expect((await call(e, `/${newCode()}`, { ...body(["X"]), method: "PUT" })).status).toBe(404); // PUT does not create codes
  });

  it("refuses lists that are too long, malformed or not JSON", async () => {
    const e = env();
    expect((await call(e, "", body(Array.from({ length: MAX_ARTISTS + 1 }, (_, i) => `Artist ${i}`)))).status).toBe(413);
    expect((await call(e, "", body("Anouk"))).status).toBe(400);
    expect((await call(e, "", body([""]))).status).toBe(400);
    expect((await call(e, "", body(["x".repeat(121)]))).status).toBe(400);
    expect((await call(e, "", { method: "POST", headers: { "content-type": "text/plain" }, body: "{}" })).status).toBe(400);
    expect((await call(e, "", { method: "POST", headers: { "content-type": "application/json" }, body: "x".repeat(20_000) })).status).toBe(413);
    expect(e.DB.rows.size).toBe(0);
  });

  it("refuses writes from another site", async () => {
    const res = await call(env(), "", body(["Anouk"], { headers: { "content-type": "application/json", origin: "https://evil.example" } }));
    expect(res.status).toBe(403);
  });

  it("forgets a list on DELETE", async () => {
    const e = env();
    const { code } = (await (await call(e, "", body(["Anouk"]))).json()) as { code: string };
    expect((await call(e, `/${code}`, { method: "DELETE" })).status).toBe(204);
    expect((await call(e, `/${code}`)).status).toBe(404);
  });

  it("passes everything outside /api/ to the static files and hides errors", async () => {
    const e = env();
    expect(await (await worker.fetch(new Request("https://podiumradar.example/"), e)).text()).toBe("static");
    const broken: Env = { ...e, DB: { ...e.DB, prepare: () => { throw new Error("db down"); } } };
    const res = await worker.fetch(new Request(`${BASE}/${newCode()}`), broken);
    expect(res.status).toBe(503);
    expect(await res.json()).toEqual({ error: "tijdelijk niet beschikbaar" });
  });
});
