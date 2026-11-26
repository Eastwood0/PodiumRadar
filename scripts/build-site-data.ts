/**
 * Writes public/data/agenda.json for the website from data/events.json, data/status.json and the venue list.
 * Runs before every build (npm run build). Without data it writes an empty agenda, so the site still builds.
 */
import { existsSync, mkdirSync, readdirSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import type { Event } from "../src/lib/schema";
import { buildSiteData, splitSiteData } from "../src/lib/site-data";
import { loadVenues } from "../src/lib/venues";

const read = <T>(p: string, f: T): T => (existsSync(p) ? (JSON.parse(readFileSync(p, "utf8")) as T) : f);
const { events, generatedAt } = read<{ events: Event[]; generatedAt?: string }>("data/events.json", { events: [] });
const { sources } = read<{ sources: Record<string, { ok: boolean; count: number; lastSuccess?: string; venues: string[] }> }>("data/status.json", { sources: {} });

const site = buildSiteData(events, loadVenues(), sources, generatedAt ?? new Date(0).toISOString());
// First part (next 30 days) for the first screen, the rest in a second file the page loads right after (B48).
// The second file is named after this run, so a browser can never combine a first part and a rest from different runs.
const stamp = site.generatedAt.replace(/[^0-9]/g, "").slice(0, 14);
const laterName = `agenda-later-${stamp}.json`;
const { first, rest } = splitSiteData(site, `data/${laterName}`);
mkdirSync("public/data", { recursive: true });
for (const f of readdirSync("public/data")) if (/^agenda-later.*\.json$/.test(f)) rmSync(`public/data/${f}`);
const json = JSON.stringify(first);
writeFileSync("public/data/agenda.json", json);
writeFileSync(`public/data/${laterName}`, JSON.stringify(rest));
console.log(`public/data/agenda.json: ${first.events.length} events, ${Math.round(json.length / 1024)} kB; ${laterName}: ${rest.events.length} events`);
