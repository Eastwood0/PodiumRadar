/**
 * Writes public/data/agenda.json for the website from data/events.json, data/status.json and the venue list.
 * Runs before every build (npm run build). Without data it writes an empty agenda, so the site still builds.
 */
import { existsSync, mkdirSync, readFileSync, writeFileSync } from "node:fs";
import type { Event } from "../src/lib/schema";
import { buildSiteData } from "../src/lib/site-data";
import { loadVenues } from "../src/lib/venues";

const read = <T>(p: string, f: T): T => (existsSync(p) ? (JSON.parse(readFileSync(p, "utf8")) as T) : f);
const { events, generatedAt } = read<{ events: Event[]; generatedAt?: string }>("data/events.json", { events: [] });
const { sources } = read<{ sources: Record<string, { ok: boolean; count: number; lastSuccess?: string; venues: string[] }> }>("data/status.json", { sources: {} });

const site = buildSiteData(events, loadVenues(), sources, generatedAt ?? new Date(0).toISOString());
mkdirSync("public/data", { recursive: true });
const json = JSON.stringify(site);
writeFileSync("public/data/agenda.json", json);
console.log(`public/data/agenda.json: ${site.events.length} events, ${Math.round(json.length / 1024)} kB`);
