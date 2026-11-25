import { fetchText } from "../lib/http";
import { localToIso, monthNumber, TZ_BY_COUNTRY } from "../lib/dates";
import { statusFrom } from "../lib/normalize";
import type { Adapter, SourceEvent } from "./types";

const URL_MD = "https://www.013.nl/programma.md";

// - [Sevendust](https://www.013.nl/programma/128241/sevendust) — zondag 29 november 2026 20:00 — Tour (Uitverkocht)
const LINE = /^- \[(.+?)\]\((https:\/\/www\.013\.nl\/programma\/(\d+)\/[^)\s]*)\)\s+—\s+[a-z]+dag\s+(\d{1,2})\s+([a-z]+)\s+(\d{4})(?:\s+(\d{1,2}:\d{2}))?(.*)$/i;

/** Parses 013's own Markdown version of its programme (all events in one file). Level 1. */
export function parse013(md: string): SourceEvent[] {
  if (!md.includes("# Programma")) throw new Error("013: programma.md heeft een onverwachte vorm");
  const out: SourceEvent[] = [];
  for (const line of md.split("\n")) {
    const m = line.trim().match(LINE);
    if (!m) continue;
    const [, title, url, id, d, monthName, y, time, rest] = m;
    const mo = monthNumber(monthName);
    if (!mo) continue;
    const { start, hasTime } = localToIso(+y, mo, +d, time, TZ_BY_COUNTRY.NL);
    const status = statusFrom(rest.match(/\(([^)]+)\)\s*$/)?.[1]);
    out.push({ venueId: "013", title: title.replace(/\\([[\]])/g, "$1").trim(), start, hasTime, status, url, sourceId: id });
  }
  return out;
}

export const zero13: Adapter = {
  name: "013.nl",
  venues: ["013"],
  async fetch() {
    const { body } = await fetchText(URL_MD, "text/markdown,text/plain");
    return parse013(body);
  },
};
