import { describe, expect, it } from "vitest";
import { cleanCode, type D1Like, type Env, handleApi, MAX_ARTISTS, NEW_CODES_PER_DAY, newCode } from "../src/lib/sync-api";
import worker from "../src/worker";

/** In-memory stand-in for D1 that understands exactly the statements the API uses. */
function fakeDb() {
  const rows = new Map<string, { artists: string; updated_at: string }>();
  const quota = new Map<string, number>();
  const db: D1Like = {
    exec: async () => undefined,
    prepare(sql: string) {
      return {
        bind(...v: unknown[]) {
          return {
            async first<T>() {
              if (sql.startsWith("INSERT INTO quota")) {
                const n = (quota.get(String(v[0])) ?? 0) + 1;
                quota.set(String(v[0]), n);
                return { n } as T;
              }
              return (rows.get(String(v[0])) ?? null) as T | null;
            },
            async run() {
              if (sql.startsWith("INSERT INTO sync")) rows.set(String(v[0]), { artists: String(v[1]), updated_at: String(v[2]) });
              else if (sql.startsWith("UPDATE")) rows.set(String(v[2]), { artists: String(v[0]), updated_at: String(v[1]) });
              else if (sql.startsWith("DELETE FROM sync WHERE code_hash")) rows.delete(String(v[0]));
              return {};
            },
          };
        },
      };
    },
  };
  return { db, rows, quota };
}

const setup = () => {
  const f = fakeDb();
  const env: Env = { DB: f.db, ASSETS: { fetch: async () => new Response("static") } };
  return { ...f, env };
};
const URL_ = "https://podiumradar.example/api/sync";
const json = (method: string, artists: unknown, headers: Record<string, string> = {}): RequestInit => ({ method, headers: { "content-type": "application/json", ...headers }, body: JSON.stringify({ artists }) });
const call = (env: Env, init?: RequestInit, path = "") => handleApi(new Request(URL_ + path, init), env);
const create = async (env: Env, artists: string[]) => ((await (await call(env, json("POST", artists))).json()) as { code: string }).code;
const withCode = (code: string, init: RequestInit = {}): RequestInit => ({ ...init, headers: { ...(init.headers as Record<string, string>), "x-sync-code": code } });
/** Lets the per-code pause (1 s between changes) pass without waiting. */
const age = (rows: Map<string, { updated_at: string }>) => rows.forEach((r) => (r.updated_at = "2026-01-01T00:00:00.000Z"));

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
  it("creates a code, stores only a hash of it, and reads the list with the code in a header", async () => {
    const { env, rows } = setup();
    const code = await create(env, ["Backstreet Boys", "Within Temptation"]);
    expect([...rows.keys()][0]).toMatch(/^[0-9a-f]{64}$/);
    expect([...rows.keys()][0]).not.toContain(code);
    const got = await call(env, withCode(code));
    expect(await got.json()).toMatchObject({ artists: ["Backstreet Boys", "Within Temptation"] });
    expect(got.headers.get("cache-control")).toBe("no-store");
  });

  it("two codes each see only their own list", async () => {
    const { env, rows } = setup();
    const a = await create(env, ["Anouk"]);
    const b = await create(env, ["Rammstein"]);
    age(rows);
    expect((await call(env, withCode(a, json("PUT", ["Anouk", "Racoon"])))).status).toBe(200);
    expect(((await (await call(env, withCode(a))).json()) as { artists: string[] }).artists).toEqual(["Anouk", "Racoon"]);
    expect(((await (await call(env, withCode(b))).json()) as { artists: string[] }).artists).toEqual(["Rammstein"]);
  });

  it("refuses invalid and unknown codes, and a code in the URL", async () => {
    const { env } = setup();
    expect((await call(env, withCode("not-a-code"))).status).toBe(400);
    expect((await call(env, withCode(newCode()))).status).toBe(404);
    expect((await call(env, withCode(newCode(), json("PUT", ["X"])))).status).toBe(404); // PUT does not create codes
    expect((await call(env, {}, `/${newCode()}`)).status).toBe(404);
  });

  it("refuses lists that are too long, empty on creation, malformed, too large or hold an e-mail address", async () => {
    const { env, rows } = setup();
    expect((await call(env, json("POST", Array.from({ length: MAX_ARTISTS + 1 }, (_, i) => `Artist ${i}`)))).status).toBe(413);
    expect((await call(env, json("POST", []))).status).toBe(400);
    expect((await call(env, json("POST", "Anouk"))).status).toBe(400);
    expect((await call(env, json("POST", [""]))).status).toBe(400);
    expect((await call(env, json("POST", ["x".repeat(121)]))).status).toBe(400);
    expect((await call(env, json("POST", [["iemand", "voorbeeld.nl"].join("@")]))).status).toBe(400);
    expect((await call(env, { method: "POST", headers: { "content-type": "text/plain" }, body: "{}" })).status).toBe(400);
    expect((await call(env, { method: "POST", headers: { "content-type": "application/json", "content-length": "99999" }, body: "{}" })).status).toBe(413);
    expect((await call(env, { method: "POST", headers: { "content-type": "application/json" }, body: "é".repeat(9000) })).status).toBe(413); // bytes, not characters
    expect(rows.size).toBe(0);
  });

  it("limits new codes per day and changes per code per second", async () => {
    const { env, quota } = setup();
    quota.set(`create:${new Date().toISOString().slice(0, 10)}`, NEW_CODES_PER_DAY);
    expect((await call(env, json("POST", ["Anouk"]))).status).toBe(429);
    quota.clear();
    const code = await create(env, ["Anouk"]);
    expect((await call(env, withCode(code, json("PUT", ["Anouk", "Racoon"])))).status).toBe(429); // within a second of creation
  });

  it("refuses writes from another site", async () => {
    const { env } = setup();
    expect((await call(env, json("POST", ["Anouk"], { origin: "https://evil.example" }))).status).toBe(403);
    expect((await call(env, json("POST", ["Anouk"], { origin: "null" }))).status).toBe(403);
  });

  it("revokes a code on DELETE", async () => {
    const { env } = setup();
    const code = await create(env, ["Anouk"]);
    expect((await call(env, withCode(code, { method: "DELETE" }))).status).toBe(204);
    expect((await call(env, withCode(code))).status).toBe(404);
  });

  it("passes everything outside /api/ to the static files and hides errors", async () => {
    const { env } = setup();
    expect(await (await worker.fetch(new Request("https://podiumradar.example/"), env)).text()).toBe("static");
    const broken: Env = { ...env, DB: { ...env.DB, prepare: () => { throw new Error("db down"); } } };
    const res = await worker.fetch(new Request(URL_, withCode(newCode())), broken);
    expect(res.status).toBe(503);
    expect(await res.json()).toEqual({ error: "tijdelijk niet beschikbaar" });
  });
});
