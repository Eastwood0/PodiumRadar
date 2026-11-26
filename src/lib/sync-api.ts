/**
 * The link-code API (phase 3, B42–B44, hardened after the Codex review of 26 Nov 2026), served by src/worker.ts.
 * One row per link code: sha-256(code) → list of artist names. No e-mail, no names of people, no IP addresses.
 * The code travels in the `X-Sync-Code` header, never in the URL, so it does not end up in request logs.
 *
 *   POST   /api/sync   {artists}                → 201 {code, artists, updatedAt}   new code (list may not be empty)
 *   GET    /api/sync   X-Sync-Code              → 200 {artists, updatedAt}          404 if unknown
 *   PUT    /api/sync   X-Sync-Code {artists}    → 200 {artists, updatedAt}          only for an existing code
 *   DELETE /api/sync   X-Sync-Code              → 204                               revoke the code everywhere
 *
 * Free-plan protection (B42): at most NEW_CODES_PER_DAY new codes and WRITES_PER_DAY writes per UTC day
 * (each counted write is two rows: the change and the counter, so well below D1's 100,000 rows/day), one
 * change per code per MIN_PUT_INTERVAL_MS, and codes unused for a year are removed now and then.
 */

/** The subset of the D1 API this file uses (kept local, so no extra type package is needed). */
export interface D1Like {
  prepare(sql: string): { bind(...values: unknown[]): { first<T>(): Promise<T | null>; run(): Promise<unknown> } };
  exec(sql: string): Promise<unknown>;
}
export interface Env {
  DB: D1Like;
  ASSETS: { fetch(req: Request): Promise<Response> };
}

export const MAX_ARTISTS = 100;
const MAX_NAME = 120;
const MAX_BODY_BYTES = 16_384;
export const NEW_CODES_PER_DAY = 200;
export const WRITES_PER_DAY = 20_000;
const MIN_PUT_INTERVAL_MS = 1_000;
const UNUSED_DAYS = 365;
/** Crockford base32 without I, L, O, U: 26 characters = 130 bits, of which 128 random. */
const ALPHABET = "0123456789ABCDEFGHJKMNPQRSTVWXYZ";
const CODE_RE = /^[0-9A-HJKMNP-TV-Z]{26}$/;
const EMAIL_RE = /[^\s@]+@[^\s@]+\.[a-z]{2,}/i;

const HEADERS = { "content-type": "application/json; charset=utf-8", "cache-control": "no-store", "x-robots-tag": "noindex, nofollow", "x-content-type-options": "nosniff" };
const json = (status: number, body?: unknown) => new Response(body === undefined ? null : JSON.stringify(body), { status, headers: HEADERS });
export const fail = (status: number, error: string) => json(status, { error });

export function newCode(random: (bytes: Uint8Array<ArrayBuffer>) => Uint8Array = (b) => crypto.getRandomValues(b)): string {
  const bytes = random(new Uint8Array(16));
  let bits = 0;
  let value = 0;
  let out = "";
  for (const byte of bytes) {
    value = (value << 8) | byte;
    bits += 8;
    while (bits >= 5) {
      out += ALPHABET[(value >>> (bits - 5)) & 31];
      bits -= 5;
    }
  }
  return (out + ALPHABET[(value << (5 - bits)) & 31]).slice(0, 26);
}

/** Accepts the code as typed: lower case, spaces and dashes allowed; O/I/L read as 0/1/1. */
export function cleanCode(raw: string): string | undefined {
  const c = raw.toUpperCase().replace(/[\s-]/g, "").replace(/O/g, "0").replace(/[IL]/g, "1");
  return CODE_RE.test(c) ? c : undefined;
}

async function hash(code: string): Promise<string> {
  const d = await crypto.subtle.digest("SHA-256", new TextEncoder().encode(`podiumradar:${code}`));
  return [...new Uint8Array(d)].map((b) => b.toString(16).padStart(2, "0")).join("");
}

type Parsed = { artists: string[] } | { error: [number, string] };

/** Reads {artists: string[]} from the body. The size is checked before reading (Content-Length) and in bytes. */
async function readArtists(req: Request, allowEmpty: boolean): Promise<Parsed> {
  if (!/^application\/json\b/i.test(req.headers.get("content-type") ?? "")) return { error: [400, "ongeldige lijst"] };
  const declared = Number(req.headers.get("content-length") ?? "0");
  if (declared > MAX_BODY_BYTES) return { error: [413, "te groot"] };
  const bytes = await req.arrayBuffer();
  if (bytes.byteLength > MAX_BODY_BYTES) return { error: [413, "te groot"] };
  let body: unknown;
  try {
    body = JSON.parse(new TextDecoder().decode(bytes));
  } catch {
    return { error: [400, "ongeldige lijst"] };
  }
  const list = (body as { artists?: unknown } | null)?.artists;
  if (!Array.isArray(list)) return { error: [400, "ongeldige lijst"] };
  if (list.length > MAX_ARTISTS) return { error: [413, `maximaal ${MAX_ARTISTS} artiesten`] };
  if (!list.every((a) => typeof a === "string" && a.trim().length > 0 && a.length <= MAX_NAME)) return { error: [400, "ongeldige lijst"] };
  if (list.some((a: string) => EMAIL_RE.test(a))) return { error: [400, "geen e-mailadressen"] };
  if (!allowEmpty && !list.length) return { error: [400, "lege lijst"] };
  return { artists: [...new Set(list.map((a: string) => a.trim()))] };
}

/** Browsers send Origin on POST/PUT/DELETE; a missing header (curl, tests) is allowed, "null" or another site is not. */
function sameOrigin(origin: string | null, host: string): boolean {
  if (origin === null) return true;
  try {
    return new URL(origin).host === host;
  } catch {
    return false;
  }
}

let schemaReady: Promise<unknown> | undefined;
const ensureSchema = (db: D1Like) =>
  (schemaReady ??= db
    .exec(
      "CREATE TABLE IF NOT EXISTS sync (code_hash TEXT PRIMARY KEY, artists TEXT NOT NULL, updated_at TEXT NOT NULL)\nCREATE TABLE IF NOT EXISTS quota (key TEXT PRIMARY KEY, n INTEGER NOT NULL)",
    )
    .catch((e: unknown) => {
      schemaReady = undefined; // try again on the next request
      throw e;
    }));

/** Counts one unit against today's budget for `kind`; false when the budget is used up. */
async function spend(db: D1Like, kind: "create" | "write", limit: number, now: string): Promise<boolean> {
  const row = await db
    .prepare("INSERT INTO quota (key, n) VALUES (?, 1) ON CONFLICT(key) DO UPDATE SET n = n + 1 RETURNING n")
    .bind(`${kind}:${now.slice(0, 10)}`)
    .first<{ n: number }>();
  return (row?.n ?? 0) <= limit;
}

export async function handleApi(req: Request, env: Env, url = new URL(req.url)): Promise<Response> {
  if (!/^\/api\/sync\/?$/.test(url.pathname)) return fail(404, "onbekend adres");
  if (req.method !== "GET" && !sameOrigin(req.headers.get("origin"), url.host)) return fail(403, "andere site");
  await ensureSchema(env.DB);
  const now = new Date().toISOString();
  const tooBusy = () => fail(429, "even te druk; probeer het later opnieuw");

  if (req.method === "POST") {
    const parsed = await readArtists(req, false);
    if ("error" in parsed) return fail(...parsed.error);
    if (!(await spend(env.DB, "create", NEW_CODES_PER_DAY, now)) || !(await spend(env.DB, "write", WRITES_PER_DAY, now))) return tooBusy();
    const code = newCode();
    await env.DB.prepare("INSERT INTO sync (code_hash, artists, updated_at) VALUES (?, ?, ?)").bind(await hash(code), JSON.stringify(parsed.artists), now).run();
    if (Math.random() < 0.02) {
      const cutoff = new Date(Date.now() - UNUSED_DAYS * 86_400_000).toISOString();
      await env.DB.prepare("DELETE FROM sync WHERE updated_at < ?").bind(cutoff).run();
    }
    return json(201, { code, artists: parsed.artists, updatedAt: now });
  }

  const code = cleanCode(req.headers.get("x-sync-code") ?? "");
  if (!code) return fail(400, "ongeldige code");
  const key = await hash(code);
  const row = await env.DB.prepare("SELECT artists, updated_at FROM sync WHERE code_hash = ?").bind(key).first<{ artists: string; updated_at: string }>();

  if (req.method === "GET") return row ? json(200, { artists: JSON.parse(row.artists) as string[], updatedAt: row.updated_at }) : fail(404, "code onbekend");
  if (req.method === "PUT") {
    const parsed = await readArtists(req, true);
    if ("error" in parsed) return fail(...parsed.error);
    if (!row) return fail(404, "code onbekend");
    if (Date.parse(now) - Date.parse(row.updated_at) < MIN_PUT_INTERVAL_MS) return tooBusy();
    if (!(await spend(env.DB, "write", WRITES_PER_DAY, now))) return tooBusy();
    await env.DB.prepare("UPDATE sync SET artists = ?, updated_at = ? WHERE code_hash = ?").bind(JSON.stringify(parsed.artists), now, key).run();
    return json(200, { artists: parsed.artists, updatedAt: now });
  }
  if (req.method === "DELETE") {
    if (row) await env.DB.prepare("DELETE FROM sync WHERE code_hash = ?").bind(key).run();
    return json(204);
  }
  return fail(405, "methode niet toegestaan");
}
