/**
 * Dekkingsrapport (bouwplan §11 fase 1): per venue hoeveel events we hebben, uit welke bron, en welke venues
 * nog geen bron hebben (met het oordeel uit de bron-inventarisatie). Schrijft docs/dekking.md.
 */
import { existsSync, readFileSync, writeFileSync } from "node:fs";
import type { Event } from "../src/lib/schema";
import { loadVenues } from "../src/lib/venues";
import type { SourceStatus } from "./lib/pipeline";

const read = <T>(p: string, f: T): T => (existsSync(p) ? (JSON.parse(readFileSync(p, "utf8")) as T) : f);
const { events, generatedAt } = read<{ events: Event[]; generatedAt?: string }>("data/events.json", { events: [] });
const { sources } = read<{ sources: Record<string, SourceStatus> }>("data/status.json", { sources: {} });
const probe = read<{ reports: { id: string; verdict: { level: string; how: string } }[] }>("docs/probe.json", { reports: [] });
const verdict = new Map(probe.reports.map((r) => [r.id, r.verdict]));

/** Why a venue has no source yet (kept in sync with the comment in scripts/adapters/index.ts). */
const NO_SOURCE: Record<string, string> = {
  brabanthallen: "site toont bots een captcha; toegang gevraagd (docs/verzoek-toegang.md)",
  "de-kuip": "geen agenda op eigen site; via Ticketmaster zodra de sleutel werkt",
  goffertpark: "geen eigen agenda (openluchtterrein); via Ticketmaster",
  megaland: "geen eigen site meer (domein te koop); via Ticketmaster",
  vrijthof: "plein zonder eigen agenda; via Ticketmaster",
  "koning-boudewijnstadion": "geen eigen concertagenda; via Ticketmaster",
  "mecc-maastricht": "datums staan niet in de API; vooral beurzen, lage prioriteit",
  "palladium-koeln": "datum niet machineleesbaar op de eventpagina; volgt",
  "signal-iduna-park": "site laadt alles via JavaScript, vooral voetbal; via Ticketmaster",
};

const rows = loadVenues().map((v) => {
  const own = events.filter((e) => e.venueId === v.id);
  const src = Object.entries(sources).filter(([, s]) => s.venues.includes(v.id));
  const music = own.filter((e) => e.category === "muziek").length;
  const last = own.at(-1)?.start.slice(0, 10) ?? "—";
  const state = src.length ? src.map(([n, s]) => `${n} ${s.ok ? "✅" : s.outage ? "⚠️ storing" : "❌"}`).join(", ") : "—";
  const v1 = verdict.get(v.id);
  const todo = src.length ? "" : NO_SOURCE[v.id] ?? (v1 ? `niveau ${v1.level}: ${v1.how}` : "nog niet onderzocht");
  return { v, own: own.length, music, last, state, todo };
});

const covered = rows.filter((r) => r.own > 0).length;
const md = [
  "# Dekking per venue",
  "",
  `Gegenereerd door \`npm run coverage\` uit \`data/events.json\` (${generatedAt ?? "nog geen data"}).`,
  "",
  `**${covered} van ${rows.length} venues** hebben data, samen ${events.length} events (${events.filter((e) => e.category === "muziek").length} muziek).`,
  "",
  "| Venue | Land | Events | Muziek | Tot | Bron | Nog te doen |",
  "|---|---|---|---|---|---|---|",
  ...rows.map((r) => `| ${r.v.name} | ${r.v.country} | ${r.own} | ${r.music} | ${r.last} | ${r.state} | ${r.todo} |`),
  "",
].join("\n");
writeFileSync("docs/dekking.md", md);
console.log(md);
