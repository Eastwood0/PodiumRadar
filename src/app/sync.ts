/**
 * Talks to /api/sync (src/lib/sync-api.ts). The code goes in the X-Sync-Code header, never in the URL.
 * Every call can fail (offline, busy); callers show a short message and the local list always stays.
 */
import { type FollowState, getFollowState, mergeArtists, onFollowChange, setFollowState } from "./follow";

const API = "/api/sync";

class SyncError extends Error {
  constructor(readonly status: number) {
    super(String(status));
  }
}

async function call<T>(code: string | undefined, init: RequestInit = {}): Promise<T> {
  const headers: Record<string, string> = { "content-type": "application/json" };
  if (code) headers["x-sync-code"] = code;
  const res = await fetch(API, { ...init, headers });
  if (!res.ok) throw new SyncError(res.status);
  return (res.status === 204 ? undefined : await res.json()) as T;
}
const put = (code: string, artists: string[]) => call<{ artists: string[] }>(code, { method: "PUT", body: JSON.stringify({ artists }) });

/** Short Dutch message for a failed call. */
export function syncMessage(e: unknown): string {
  const status = e instanceof SyncError ? e.status : 0;
  if (status === 404) return "Deze code bestaat niet (meer). Controleer de tekens, of maak een nieuwe code.";
  if (status === 400) return "Dit is geen geldige code of lijst.";
  if (status === 429) return "Het is even te druk. Je lijst staat veilig op dit apparaat; probeer het straks opnieuw.";
  return "Koppelen lukt nu niet. Je lijst blijft op dit apparaat bewaard; probeer het later opnieuw.";
}

/** Groups of four for reading and typing: "K7Q2 9XBD …". */
export const formatCode = (code: string) => code.replace(/(.{4})(?=.)/g, "$1 ");
export const codeHref = (code: string) => `#koppel-${code}`;
export const cleanTyped = (typed: string) => typed.replace(/[\s-]/g, "").toUpperCase();

/** Makes a new code for the current list (not empty) and remembers it. */
export async function createLink(): Promise<string> {
  const { code } = await call<{ code: string }>(undefined, { method: "POST", body: JSON.stringify({ artists: getFollowState().artists }) });
  setFollowState({ ...getFollowState(), code, pending: false }, false);
  return code;
}

/** What to do with this device's own list when linking to an existing code. */
export type JoinMode = "samenvoegen" | "overnemen";

/**
 * Links this device to an existing code. "samenvoegen": both lists together (saved on the server too);
 * "overnemen": this device takes the list of the code. The code is remembered only after it worked.
 */
export async function joinLink(code: string, mode: JoinMode): Promise<FollowState> {
  const remote = await call<{ artists: string[] }>(code);
  const s = getFollowState();
  const artists = mode === "samenvoegen" ? mergeArtists(remote.artists, s.artists) : remote.artists;
  if (artists.length !== remote.artists.length) await put(code, artists);
  const next = { ...getFollowState(), artists, code, pending: false };
  setFollowState(next, false);
  return next;
}

/**
 * Brings this device up to date with its code. A change that never reached the server is sent first; a server
 * answer is used only if nothing was tapped while it was on its way.
 */
export async function refreshLink(): Promise<void> {
  const s = getFollowState();
  if (!s.code) return;
  if (s.pending) return flush();
  const rev = s.rev;
  const remote = await call<{ artists: string[] }>(s.code);
  const now = getFollowState();
  if (now.rev === rev && now.code === s.code) setFollowState({ ...now, artists: remote.artists }, false);
}

/** This device stops using the code; the list stays here and on the other devices. */
export function unlinkDevice(): void {
  setFollowState({ ...getFollowState(), code: undefined, pending: false }, false);
}

/** Revokes the code everywhere: the server forgets the list. This device keeps its list and forgets the code afterwards. */
export async function revokeLink(): Promise<void> {
  const s = getFollowState();
  if (!s.code) return;
  await call(s.code, { method: "DELETE" });
  unlinkDevice();
}

const failListeners = new Set<(f: boolean) => void>();
let lastFailed = false;
export const onSyncFailure = (fn: (f: boolean) => void) => {
  failListeners.add(fn);
  return () => {
    failListeners.delete(fn);
  };
};
const setFailed = (f: boolean) => {
  lastFailed = f;
  failListeners.forEach((l) => l(f));
};
export const syncFailed = () => lastFailed || !!getFollowState().pending;

let flushing: Promise<void> | undefined;
/** Sends the latest local list for the linked code, one request at a time; repeats if more taps came in meanwhile. */
export function flush(): Promise<void> {
  flushing ??= (async () => {
    try {
      for (;;) {
        const s = getFollowState();
        if (!s.code || !s.pending) return;
        await put(s.code, s.artists);
        const now = getFollowState();
        if (now.rev === s.rev) {
          setFollowState({ ...now, pending: false }, false);
          setFailed(false);
          return;
        }
      }
    } catch (e) {
      setFailed(true);
      throw e;
    } finally {
      flushing = undefined;
    }
  })();
  return flushing;
}

let timer: ReturnType<typeof setTimeout> | undefined;
/** After a local change: send it a second later (taps come in bursts; the server allows one change per second). */
onFollowChange((s) => {
  if (!s.code) return;
  clearTimeout(timer);
  timer = setTimeout(() => flush().catch(() => undefined), 1100);
});
