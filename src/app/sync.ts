/** Talks to /api/sync (src/worker.ts). Every call can fail (offline, no API yet); callers show a short message. */
import { type FollowState, getFollowState, mergeArtists, onFollowChange, setFollowState } from "./follow";

const API = "/api/sync";

async function call<T>(path: string, init?: RequestInit): Promise<T> {
  const res = await fetch(API + path, { ...init, headers: { "content-type": "application/json", ...init?.headers } });
  if (!res.ok) throw new Error(String(res.status));
  return (res.status === 204 ? undefined : await res.json()) as T;
}

/** Groups of four for reading and typing: "K7Q2 9XBD …". */
export const formatCode = (code: string) => code.replace(/(.{4})(?=.)/g, "$1 ");
export const codeHref = (code: string) => `#koppel-${code}`;

/** Makes a new code for the current list and remembers it. */
export async function createLink(): Promise<string> {
  const s = getFollowState();
  const { code } = await call<{ code: string }>("", { method: "POST", body: JSON.stringify({ artists: s.artists }) });
  setFollowState({ ...getFollowState(), code }, false);
  return code;
}

/** Links this device to an existing code: merges both lists, saves the result on both sides. */
export async function joinLink(code: string): Promise<FollowState> {
  const remote = await call<{ artists: string[] }>(`/${encodeURIComponent(code)}`);
  const s = getFollowState();
  const artists = mergeArtists(remote.artists, s.artists);
  const next = { ...s, artists, code };
  setFollowState(next, false);
  if (artists.length !== remote.artists.length) await call(`/${encodeURIComponent(code)}`, { method: "PUT", body: JSON.stringify({ artists }) });
  return next;
}

/** Fetches the list of the linked code (the other device may have changed it). */
export async function refreshLink(): Promise<void> {
  const s = getFollowState();
  if (!s.code) return;
  const remote = await call<{ artists: string[] }>(`/${encodeURIComponent(s.code)}`);
  setFollowState({ ...getFollowState(), artists: remote.artists }, false);
}

/** Stops linking on this device; the list stays here, the server forgets it. */
export async function unlink(): Promise<void> {
  const s = getFollowState();
  if (!s.code) return;
  setFollowState({ ...s, code: undefined }, false);
  await call(`/${encodeURIComponent(s.code)}`, { method: "DELETE" });
}

let timer: ReturnType<typeof setTimeout> | undefined;
let failed = false;
const failListeners = new Set<(f: boolean) => void>();
export const onSyncFailure = (fn: (f: boolean) => void) => {
  failListeners.add(fn);
  return () => {
    failListeners.delete(fn);
  };
};
const setFailed = (f: boolean) => {
  failed = f;
  failListeners.forEach((l) => l(f));
};
export const syncFailed = () => failed;

/** After a local change: push the whole list to the linked code, half a second later (taps come in bursts). */
onFollowChange((s) => {
  if (!s.code) return;
  clearTimeout(timer);
  timer = setTimeout(() => {
    const cur = getFollowState(); // the latest list, not the one of the first tap
    if (!cur.code) return;
    call(`/${encodeURIComponent(cur.code)}`, { method: "PUT", body: JSON.stringify({ artists: cur.artists }) }).then(
      () => setFailed(false),
      () => setFailed(true),
    );
  }, 500);
});
