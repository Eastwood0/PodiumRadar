/**
 * The link-code API (phase 3, B42–B44), served by src/worker.ts. The API keeps one row per link code:
 * sha-256(code) → list of artist names. No e-mail, no names of people, no IP addresses are stored.
 *
 *   POST   /api/sync          {artists}  → 201 {code}       new code for this list
 *   GET    /api/sync/<code>              → 200 {artists}    404 if unknown
 *   PUT    /api/sync/<code>   {artists}  → 200              only for an existing code
 *   DELETE /api/sync/<code>              → 204              forget the list (unlink)
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
const MAX_BODY = 16_384;
/** Crockford base32 without I, L, O, U: 26 characters = 130 bits, of which 128 random. */
const ALPHABET = "0123456789ABCDEFGHJKMNPQRSTVWXYZ";
const CODE_RE = /^[0-9A-HJKMNP-TV-Z]{26}$/;

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

/** Reads {artists: string[]} from the body; undefined when it is not a valid list. */
async function readArtists(req: Request): Promise<string[] | "too-large" | undefined> {
  if (!/^application\/json\b/i.test(req.headers.get("content-type") ?? "")) return undefined;
  const text = await req.text();
  if (text.length > MAX_BODY) return "too-large";
  let body: unknown;
  try {
    body = JSON.parse(text);
  } catch {
    return undefined;
  }
  const list = (body as { artists?: unknown } | null)?.artists;
  if (!Array.isArray(list)) return undefined;
  if (list.length > MAX_ARTISTS) return "too-large";
  if (!list.every((a) => typeof a === "string" && a.trim().length > 0 && a.length <= MAX_NAME)) return undefined;
  return [...new Set(list.map((a: string) => a.trim()))];
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
  (schemaReady ??= db.exec("CREATE TABLE IF NOT EXISTS sync (code_hash TEXT PRIMARY KEY, artists TEXT NOT NULL, updated_at TEXT NOT NULL)").catch((e: unknown) => {
    schemaReady = undefined; // try again on the next request
    throw e;
  }));

export async function handleApi(req: Request, env: Env, url = new URL(req.url)): Promise<Response> {
  const m = url.pathname.match(/^\/api\/sync(?:\/([^/]+))?\/?$/);
  if (!m) return fail(404, "onbekend adres");
  if (req.method !== "GET" && !sameOrigin(req.headers.get("origin"), url.host)) return fail(403, "andere site");
  await ensureSchema(env.DB);
  const now = new Date().toISOString();

  if (!m[1]) {
    if (req.method !== "POST") return fail(405, "alleen POST");
    const artists = await readArtists(req);
    if (artists === "too-large") return fail(413, `maximaal ${MAX_ARTISTS} artiesten`);
    if (!artists) return fail(400, "ongeldige lijst");
    const code = newCode();
    await env.DB.prepare("INSERT INTO sync (code_hash, artists, updated_at) VALUES (?, ?, ?)").bind(await hash(code), JSON.stringify(artists), now).run();
    return json(201, { code, artists });
  }

  const code = cleanCode(decodeURIComponent(m[1]));
  if (!code) return fail(400, "ongeldige code");
  const key = await hash(code);
  if (req.method === "GET") {
    const row = await env.DB.prepare("SELECT artists, updated_at FROM sync WHERE code_hash = ?").bind(key).first<{ artists: string; updated_at: string }>();
    return row ? json(200, { artists: JSON.parse(row.artists) as string[], updatedAt: row.updated_at }) : fail(404, "code onbekend");
  }
  if (req.method === "PUT") {
    const artists = await readArtists(req);
    if (artists === "too-large") return fail(413, `maximaal ${MAX_ARTISTS} artiesten`);
    if (!artists) return fail(400, "ongeldige lijst");
    const exists = await env.DB.prepare("SELECT 1 AS x FROM sync WHERE code_hash = ?").bind(key).first<{ x: number }>();
    if (!exists) return fail(404, "code onbekend");
    await env.DB.prepare("UPDATE sync SET artists = ?, updated_at = ? WHERE code_hash = ?").bind(JSON.stringify(artists), now, key).run();
    return json(200, { artists, updatedAt: now });
  }
  if (req.method === "DELETE") {
    await env.DB.prepare("DELETE FROM sync WHERE code_hash = ?").bind(key).run();
    return json(204);
  }
  return fail(405, "methode niet toegestaan");
}

