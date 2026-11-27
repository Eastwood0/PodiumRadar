/**
 * In-app history, so "Terug" returns to the exact spot in the list you came from. The browser's own history has the
 * pages; this keeps the scroll position and how many rows were shown, which the browser loses because the app
 * renders each page anew. Every browser entry gets a number in history.state: a step back is recognised by that
 * number, not by the address, so opening a link to the page you came from is a new step (Codex review).
 */
interface Entry {
  id: number;
  hash: string;
  y: number;
  /** The link followed from this page: its address and which one of the links with that address it was. */
  link?: { href: string; index: number };
}

let pendingLink: Entry["link"];
/** Called on a click on an in-page link, just before the address changes. */
export function rememberLink(href: string, index: number): void {
  pendingLink = { href, index };
}

const stack: Entry[] = [];
let currentId = 0;
let seq = 0;
/** Rows shown per list ("Toon meer"), by list key, so going back shows the same rows. */
export const shownRows = new Map<string, number>();

const current = () => (typeof location === "undefined" ? "" : location.hash || "#overzicht");
const stateId = (): number | undefined => {
  const s = typeof history === "undefined" ? undefined : (history.state as { navId?: unknown } | null);
  return typeof s?.navId === "number" ? s.navId : undefined;
};
const mark = (id: number) => {
  if (typeof history !== "undefined") history.replaceState({ ...((history.state as object | null) ?? {}), navId: id }, "");
};

export function startNav(): void {
  stack.length = 0;
  currentId = stateId() ?? ++seq;
  seq = Math.max(seq, currentId);
  mark(currentId);
  stack.push({ id: currentId, hash: current(), y: 0 });
}

/**
 * Call on every hash change, before the new page renders (window.scrollY still belongs to the page you leave).
 * `restore`: the scroll position when this was a step back or forward to a known page, else undefined (start at the
 * top). `from`: the address of the page you left, to put the focus back on the link that led there.
 */
export function navigated(leavingY: number): { restore?: number; from?: string; link?: Entry["link"] } {
  const leaving = stack.find((e) => e.id === currentId);
  if (leaving) {
    leaving.y = leavingY;
    if (pendingLink && pendingLink.href === current()) leaving.link = pendingLink;
  }
  pendingLink = undefined;
  const id = stateId();
  const known = id === undefined ? undefined : stack.find((e) => e.id === id);
  if (known) {
    currentId = known.id;
    return { restore: known.y, from: leaving?.hash, link: known.link };
  }
  // A new page: the entries after the current one are gone from the browser's history (it branched off here).
  const at = stack.findIndex((e) => e.id === currentId);
  stack.splice(at + 1);
  currentId = ++seq;
  mark(currentId);
  stack.push({ id: currentId, hash: current(), y: 0 });
  return {};
}

/** After history.replaceState (a filter in the address): the current entry has a new address, not a new page. */
export function replaced(): void {
  const e = stack.find((x) => x.id === currentId);
  if (e) e.hash = current();
}

/** Changes the address of the current page without a new history step, keeping its number. */
export function replaceHash(hash: string): void {
  history.replaceState(history.state, "", hash);
  replaced();
}

/** True when "Terug" can go back within the site (not opened straight from a shared link). */
export const canGoBack = () => stack.findIndex((e) => e.id === currentId) > 0;
