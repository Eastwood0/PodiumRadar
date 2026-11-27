/**
 * In-app history, so "Terug" returns to the exact spot in the list you came from. The browser's own history has the
 * pages; this keeps the scroll position and how many rows were shown, which the browser loses because the app
 * renders each page anew.
 */
interface Entry {
  hash: string;
  y: number;
}

const stack: Entry[] = [];
/** Rows shown per list ("Toon meer"), by list key, so going back shows the same rows. */
export const shownRows = new Map<string, number>();

const current = () => (typeof location === "undefined" ? "" : location.hash || "#overzicht");

export function startNav(): void {
  stack.length = 0;
  stack.push({ hash: current(), y: 0 });
}

/**
 * Call on every hash change, before the new page renders (window.scrollY still belongs to the page you leave).
 * Returns the scroll position to restore when this was a step back, otherwise undefined (start at the top).
 */
export function navigated(leavingY: number): number | undefined {
  const next = current();
  if (stack.length >= 2 && stack[stack.length - 2].hash === next) {
    stack.pop();
    return stack[stack.length - 1].y;
  }
  if (stack.length) stack[stack.length - 1].y = leavingY;
  stack.push({ hash: next, y: 0 });
  return undefined;
}

/** After history.replaceState (a filter in the address): the current entry has a new address, not a new page. */
export function replaced(): void {
  if (stack.length) stack[stack.length - 1].hash = current();
}

/** True when "Terug" can go back within the site (not opened straight from a shared link). */
export const canGoBack = () => stack.length > 1;
