import type { SiteData, SiteVenue } from "../lib/site-data";
import { formatDateTime } from "./lib";

/**
 * How complete a venue's agenda is, in one sentence, or "" when there is nothing to warn about (Codex: "make clear
 * how complete the agenda is"). A city agenda as the only source may miss shows; a failed update shows old data.
 */
export function sourceNote(data: SiteData, v: SiteVenue): string {
  const own = data.sources.filter((s) => s.venues.includes(v.id));
  if (!own.length) return v.ns ? `Nog geen agenda voor ${v.n}: ${v.ns}` : "";
  const full = own.filter((s) => !s.partial);
  if (full.length && full.every((s) => !s.ok)) {
    const last = full.map((s) => s.lastSuccess).filter(Boolean).sort().at(-1);
    return `De laatste update van ${v.n} is mislukt; dit is de stand van ${last ? formatDateTime(last) : "eerder"}. Kijk bij twijfel op de site van de zaal.`;
  }
  if (!full.length) return `${v.n} komt uit een stadsagenda; daar staat niet altijd elke show in. Kijk bij twijfel op de site van de zaal.`;
  return "";
}
