import { useEffect, useSyncExternalStore } from "react";
import type { SiteData, SiteEvent, SiteVenue } from "../lib/site-data";
import { findShow, formatDate, formatTime, showHref, showKey } from "./lib";

/**
 * "Voorstel": pick two or three shows and send them as one message to the group app (Codex, 27 Nov 2026).
 * The picks are kept in this browser only.
 */
const KEY = "pr.voorstel";
const MAX = 6;
const listeners = new Set<() => void>();
let picks: string[] = read();

function read(): string[] {
  try {
    const v = JSON.parse(localStorage.getItem(KEY) ?? "[]") as unknown;
    return Array.isArray(v) ? v.filter((x): x is string => typeof x === "string").slice(0, MAX) : [];
  } catch {
    return []; // private mode or no storage: the proposal simply starts empty
  }
}
function write(next: string[]) {
  picks = next;
  try {
    localStorage.setItem(KEY, JSON.stringify(next));
  } catch {
    // not stored: the proposal still works until the page is closed
  }
  for (const l of listeners) l();
}
const subscribe = (l: () => void) => {
  listeners.add(l);
  return () => listeners.delete(l);
};
export const useProposal = () => useSyncExternalStore(subscribe, () => picks, () => picks);
export const toggleProposal = (key: string) => write(picks.includes(key) ? picks.filter((k) => k !== key) : [...picks, key].slice(-MAX));

/** The text that goes to the group app: one line per show, with the link to its page. */
export function proposalText(events: SiteEvent[], venues: Map<string, SiteVenue>, base: string): string {
  const lines = events.map((e, i) => {
    const v = venues.get(e.v);
    return `${i + 1}. ${e.t} · ${formatDate(e.s)}${e.h ? ` ${formatTime(e.s)}` : ""} · ${v?.n ?? ""}, ${v?.city ?? ""}${e.st === "u" ? " (uitverkocht)" : ""}\n${base}${showHref(e)}`;
  });
  return `Zin in een van deze?\n\n${lines.join("\n\n")}`;
}

export const siteBase = () => (typeof location === "undefined" ? "" : `${location.origin}${location.pathname}`);

/** Opens the phone's share sheet; on a laptop WhatsApp Web, so it always ends up in a chat. */
export function shareText(title: string, text: string, url?: string): void {
  if (typeof navigator !== "undefined" && navigator.share) {
    navigator.share({ title, text, ...(url ? { url } : {}) }).catch(() => undefined); // closing the sheet is not an error
    return;
  }
  window.open(`https://wa.me/?text=${encodeURIComponent(url ? `${text}\n${url}` : text)}`, "_blank", "noopener");
}

/** ＋ on a show: add it to (or take it out of) the proposal. */
export function ProposalToggle({ e, big = false }: { e: SiteEvent; big?: boolean }) {
  const list = useProposal();
  const key = showKey(e);
  const on = list.includes(key);
  return (
    <button type="button" className={`pick${big ? " pick--big" : ""}${on ? " is-on" : ""}`} aria-pressed={on} onClick={() => toggleProposal(key)}>
      <span aria-hidden="true">{on ? "✓" : "＋"}</span>
      {big ? <span>Voorstel aan vrienden</span> : <span className="sr-only">{e.t} in je voorstel aan vrienden</span>}
    </button>
  );
}

/** Bar at the bottom while shows are picked: send them in one message, or start over. */
export function ProposalBar({ data, venues }: { data: SiteData; venues: Map<string, SiteVenue> }) {
  const list = useProposal();
  const events = list.map((k) => findShow(data.events, k)).filter((e): e is SiteEvent => !!e);
  const waiting = !data.complete && events.length < list.length; // a pick from later in the year is still loading
  // Shows that are over or gone from the agenda drop out once the whole agenda is in (Codex).
  useEffect(() => {
    if (data.complete && events.length < list.length) write(events.map(showKey));
  }, [data.complete, events, list.length]);
  if (!list.length) return null;
  return (
    <div className="pbar" role="region" aria-label="Voorstel aan vrienden">
      <p className="pbar__n" aria-live="polite">
        {events.length} in je voorstel
      </p>
      <button type="button" className="btn" disabled={!events.length || waiting} onClick={() => shareText("Voorstel", proposalText(events, venues, siteBase()))}>
        {waiting ? "Even laden…" : "Deel voorstel"}
      </button>
      <button
        type="button"
        className="btn btn--quiet"
        onClick={() => {
          write([]);
          document.getElementById("inhoud")?.focus({ preventScroll: true }); // the bar and its buttons are gone
        }}
      >
        Wis
      </button>
    </div>
  );
}
