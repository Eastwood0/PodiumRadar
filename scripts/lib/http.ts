import { isAllowed, parseRobots, type RobotsRules } from "./robots";

/** Honest identification; contact via the repository (no e-mail addresses in the repo). */
export const USER_AGENT = "Mozilla/5.0 (compatible; PodiumradarBot/0.1; +https://github.com/Eastwood0/PodiumRadar)";
const MIN_INTERVAL_MS = 1100; // max 1 request per second per host (CLAUDE.md)
const TIMEOUT_MS = 20_000;

const lastRequestAt = new Map<string, number>();
/** Longer pause per host when its robots.txt sets a Crawl-delay (capped at 10 s so a run stays within its time limit). */
const hostInterval = new Map<string, number>();
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
    const wait = (lastRequestAt.get(host) ?? 0) + (hostInterval.get(host) ?? MIN_INTERVAL_MS) - Date.now();
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

/** `redirect`: "manual" for pages (politeGet checks every redirect target itself), "follow" for robots.txt and APIs. */
async function rawFetch(url: string, accept: string, userAgent = USER_AGENT, redirect: RequestRedirect = "follow"): Promise<FetchResult & { location?: string }> {
  const started = Date.now();
  try {
    const res = await fetch(url, {
      headers: { "User-Agent": userAgent, Accept: accept, "Accept-Language": "nl,en;q=0.8,de;q=0.6" },
      redirect,
      signal: AbortSignal.timeout(TIMEOUT_MS),
    });
    const location = res.status >= 300 && res.status < 400 ? res.headers.get("location") ?? undefined : undefined;
    const body = await res.text();
    return {
      location: location ? new URL(location, url).href : undefined,
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
      onHost(host, () => rawFetch(`${origin}/robots.txt`, "text/plain")).then((r) => {
        // RFC 9309 §2.3.1.4: robots.txt unreachable (5xx or no connection) means "assume everything is disallowed".
        if (r.status === 0 || r.status >= 500) return DISALLOW_ALL;
        const rules = r.ok && !/<html/i.test(r.body.slice(0, 500)) ? parseRobots(r.body) : null;
        if (rules?.crawlDelay) hostInterval.set(host, Math.max(MIN_INTERVAL_MS, Math.min(rules.crawlDelay, 10) * 1000));
        return rules;
      }),
    );
  }
  return robotsCache.get(origin)!;
}

const DISALLOW_ALL: RobotsRules = { allow: [], disallow: ["/"], sitemaps: [] };
const MAX_REDIRECTS = 5;

/**
 * Polite GET: checks robots.txt first, then fetches with per-host rate limiting. Redirects are followed by hand,
 * so every target is checked against its own robots.txt and waits its turn on its own host.
 */
export async function politeGet(
  url: string,
  accept = "text/html,application/xhtml+xml,application/json;q=0.9,*/*;q=0.8",
): Promise<FetchResult & { robotsBlocked?: boolean }> {
  let current = url;
  for (let hop = 0; hop <= MAX_REDIRECTS; hop++) {
    const u = new URL(current);
    const robots = await getRobots(u.origin);
    if (robots && !isAllowed(robots, u.pathname + u.search)) {
      return { ok: false, status: 0, url, finalUrl: current, contentType: "", body: "", ms: 0, robotsBlocked: true };
    }
    const r = await onHost(u.host, () => rawFetch(current, accept, USER_AGENT, "manual"));
    if (!r.location) return { ...r, url, finalUrl: current };
    current = r.location;
  }
  return { ok: false, status: 0, url, finalUrl: current, contentType: "", body: "", ms: 0, error: "te veel doorverwijzingen" };
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
export function apiGet(url: string, accept = "application/json", userAgent = API_USER_AGENT): Promise<FetchResult> {
  return onHost(new URL(url).host, () => rawFetch(url, accept, userAgent));
}

/** The "Application/version ( contact-url )" form that MusicBrainz asks for; browser-like strings get throttled. */
export const API_USER_AGENT = "Podiumradar/0.1 ( https://github.com/Eastwood0/PodiumRadar )";
