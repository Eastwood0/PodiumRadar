/**
 * Dagelijkse ophaalrun (bouwplan §5, fase 1). Draait alle adapters, normaliseert, ontdubbelt,
 * bewaakt storingen (< 50% van vorige keer) en schrijft data/events.json + data/status.json.
 * Gebruik: npm run fetch   (optioneel FETCH_ONLY=afaslive.nl,effenaar.nl)
 */
import { existsSync, mkdirSync, readFileSync, writeFileSync } from "node:fs";
import type { Event } from "../src/lib/schema";
import { loadVenues } from "../src/lib/venues";
import { ADAPTERS } from "./adapters";
import { carryFirstSeen, dedupe, isOutage, sortEvents, toEvents, type SourceStatus } from "./lib/pipeline";

const EVENTS_FILE = "data/events.json";
const STATUS_FILE = "data/status.json";

function readJson<T>(path: string, fallback: T): T {
  try {
    return existsSync(path) ? (JSON.parse(readFileSync(path, "utf8")) as T) : fallback;
  } catch {
    return fallback;
  }
}

async function main() {
  const startedAt = new Date();
  const today = new Intl.DateTimeFormat("en-CA", { timeZone: "Europe/Amsterdam" }).format(startedAt);
  const venues = new Map(loadVenues().map((v) => [v.id, v]));
  const previous = readJson<{ events: Event[] }>(EVENTS_FILE, { events: [] }).events;
  const prevStatus = readJson<{ sources: Record<string, SourceStatus> }>(STATUS_FILE, { sources: {} }).sources;
  const only = process.env.FETCH_ONLY?.split(",").filter(Boolean);
  const adapters = ADAPTERS.filter((a) => !only || only.includes(a.name));

  const results = await Promise.allSettled(adapters.map((a) => a.fetch()));
  const all: Event[] = [];
  // Keep status only for sources that still exist; removed adapters disappear from the status page.
  const known = new Set(ADAPTERS.map((a) => a.name));
  const status: Record<string, SourceStatus> = Object.fromEntries(Object.entries(prevStatus).filter(([name]) => known.has(name)));

  adapters.forEach((a, i) => {
    const r = results[i];
    const prevOwn = previous.filter((e) => e.sources.some((s) => s.name === a.name) && e.start.slice(0, 10) >= today);
    const prevCount = prevStatus[a.name]?.count;
    const keepOld = (error: string, outage = false): void => {
      all.push(...prevOwn);
      status[a.name] = { ...(prevStatus[a.name] ?? { count: 0, venues: a.venues }), ok: false, outage, error, venues: a.venues };
      console.warn(`✗ ${a.name}: ${error} — vorige data (${prevOwn.length}) behouden`);
    };
    if (r.status === "rejected") return keepOld(String(r.reason?.message ?? r.reason).slice(0, 300));
    const { events, dropped } = toEvents(r.value, a.name, venues, today);
    if (isOutage(events.length, prevCount)) return keepOld(`${events.length} events, vorige keer ${prevCount}: behandeld als storing`, true);
    if (!events.length && !prevCount) {
      status[a.name] = { ok: false, count: 0, error: "0 events gevonden", venues: a.venues, dropped };
      console.warn(`✗ ${a.name}: 0 events`);
      return;
    }
    all.push(...events);
    status[a.name] = { ok: true, count: events.length, previousCount: prevCount, lastSuccess: startedAt.toISOString(), venues: a.venues, dropped };
    console.log(`✓ ${a.name}: ${events.length} events${dropped ? ` (${dropped} ongeldig, overgeslagen)` : ""}`);
  });

  // Events from sources not run this time (FETCH_ONLY) stay as they were.
  const ran = new Set(adapters.map((a) => a.name));
  all.push(...previous.filter((e) => e.sources.every((s) => !ran.has(s.name)) && e.start.slice(0, 10) >= today));

  const events = sortEvents(carryFirstSeen(dedupe(all), previous));
  mkdirSync("data", { recursive: true });
  writeFileSync(EVENTS_FILE, JSON.stringify({ generatedAt: startedAt.toISOString(), events }, null, 1) + "\n");
  writeFileSync(STATUS_FILE, JSON.stringify({ generatedAt: startedAt.toISOString(), sources: status }, null, 2) + "\n");
  const failed = Object.values(status).filter((s) => !s.ok).length;
  console.log(`\n${events.length} events, ${Object.keys(status).length - failed} bronnen ok, ${failed} met storing. ${Math.round((Date.now() - startedAt.getTime()) / 1000)} s.`);
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
