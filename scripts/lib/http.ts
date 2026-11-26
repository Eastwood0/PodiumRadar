import { isAllowed, parseRobots, type RobotsRules } from "./robots";

/** Honest identification; contact via the repository (no e-mail addresses in the repo). */
export const USER_AGENT = "Mozilla/5.0 (compatible; PodiumradarBot/0.1; +https://github.com/Eastwood0/PodiumRadar)";
const MIN_INTERVAL_MS = 1100; // max 1 request per second per host (CLAUDE.md)
const TIMEOUT_MS = 20_000;

const lastRequestAt = new Map<string, number>();
const hostQueues = new Map<string, Promise<unknown>>();
const robotsCache = new Map<string, Promise<RobotsRules | null>>();

export interface FetchResult {
  ok: boolean;
  status: number;
  url: string;
  finalUrl: string;
  contentType: string;
  body: string;
  error?: string;
  ms: number;
}

const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));

/** Serialises requests per host and keeps at least MIN_INTERVAL_MS between them. */
function onHost<T>(host: string, task: () => Promise<T>): Promise<T> {
  const prev = hostQueues.get(host) ?? Promise.resolve();
  const next = prev.then(async () => {
    const wait = (lastRequestAt.get(host) ?? 0) + MIN_INTERVAL_MS - Date.now();
    if (wait > 0) await sleep(wait);
    try {
      return await task();
    } finally {
      lastRequestAt.set(host, Date.now());
    }
  });
  hostQueues.set(host, next.catch(() => undefined));
  return next;
}

async function rawFetch(url: string, accept: string): Promise<FetchResult> {
  const started = Date.now();
  try {
    const res = await fetch(url, {
      headers: { "User-Agent": USER_AGENT, Accept: accept, "Accept-Language": "nl,en;q=0.8,de;q=0.6" },
      redirect: "follow",
      signal: AbortSignal.timeout(TIMEOUT_MS),
    });
    const body = await res.text();
    return {
      ok: res.ok,
      status: res.status,
      url,
      finalUrl: res.url,
      contentType: res.headers.get("content-type") ?? "",
      body,
      ms: Date.now() - started,
    };
  } catch (e) {
    return { ok: false, status: 0, url, finalUrl: url, contentType: "", body: "", error: String(e), ms: Date.now() - started };
  }
}

export function getRobots(origin: string): Promise<RobotsRules | null> {
  if (!robotsCache.has(origin)) {
    const host = new URL(origin).host;
    robotsCache.set(
      origin,
      onHost(host, () => rawFetch(`${origin}/robots.txt`, "text/plain")).then((r) =>
        r.ok && !/<html/i.test(r.body.slice(0, 500)) ? parseRobots(r.body) : null,
      ),
    );
  }
  return robotsCache.get(origin)!;
}

/** Polite GET: checks robots.txt first, then fetches with per-host rate limiting. */
export async function politeGet(
  url: string,
  accept = "text/html,application/xhtml+xml,application/json;q=0.9,*/*;q=0.8",
): Promise<FetchResult & { robotsBlocked?: boolean }> {
  const u = new URL(url);
  const robots = await getRobots(u.origin);
  if (robots && !isAllowed(robots, u.pathname + u.search)) {
    return { ok: false, status: 0, url, finalUrl: url, contentType: "", body: "", ms: 0, robotsBlocked: true };
  }
  return onHost(u.host, () => rawFetch(url, accept));
}

/** politeGet that throws when the page is blocked by robots.txt or does not return 2xx. */
export async function fetchText(url: string, accept?: string): Promise<{ body: string; finalUrl: string }> {
  const r = await politeGet(url, accept);
  if (r.robotsBlocked) throw new Error(`robots.txt staat ${url} niet toe`);
  if (!r.ok) throw new Error(`${url}: ${r.status || r.error}`);
  return { body: r.body, finalUrl: r.finalUrl };
}

/**
 * GET for documented public APIs with their own published rate limit (e.g. MusicBrainz: 1 request per
 * second, User-Agent required). Same per-host queue and pause as politeGet; robots.txt is meant for
 * crawlers of web pages and not consulted here. Only use for APIs listed in docs/BRONNEN.md.
 */
export function apiGet(url: string, accept = "application/json"): Promise<FetchResult> {
  return onHost(new URL(url).host, () => rawFetch(url, accept));
}
