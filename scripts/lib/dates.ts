/** Date helpers. All venues are in CET/CEST; radar countries may differ (GB). */

export const TZ_BY_COUNTRY: Record<string, string> = {
  NL: "Europe/Amsterdam",
  BE: "Europe/Brussels",
  DE: "Europe/Berlin",
  FR: "Europe/Paris",
  GB: "Europe/London",
};

const MONTHS: Record<string, number> = {
  jan: 1, januari: 1, januar: 1, january: 1, janvier: 1,
  feb: 2, februari: 2, februar: 2, february: 2, fevrier: 2,
  mrt: 3, maart: 3, mar: 3, maerz: 3, marz: 3, march: 3, mars: 3,
  apr: 4, april: 4, avril: 4,
  mei: 5, mai: 5, may: 5,
  jun: 6, juni: 6, june: 6, juin: 6,
  jul: 7, juli: 7, july: 7, juillet: 7,
  aug: 8, augustus: 8, august: 8, aout: 8,
  sep: 9, sept: 9, september: 9, septembre: 9,
  okt: 10, oktober: 10, oct: 10, october: 10, octobre: 10,
  nov: 11, november: 11, novembre: 11,
  dec: 12, december: 12, dez: 12, dezember: 12, decembre: 12,
};

/** Month number for a Dutch, German, English or French month name or abbreviation. */
export function monthNumber(name: string): number | undefined {
  const k = name.toLowerCase().normalize("NFD").replace(/[̀-ͯ]/g, "").replace(/[^a-z]/g, "");
  return MONTHS[k] ?? MONTHS[k.slice(0, 3)];
}

const pad = (n: number) => String(n).padStart(2, "0");

/** UTC offset (minutes) of a time zone at a given instant. */
function offsetMinutes(tz: string, at: Date): number {
  const s = new Intl.DateTimeFormat("en-US", { timeZone: tz, timeZoneName: "longOffset" }).formatToParts(at).find((p) => p.type === "timeZoneName")?.value ?? "GMT";
  const m = s.match(/GMT([+-])(\d{2}):?(\d{2})?/);
  return m ? (m[1] === "-" ? -1 : 1) * (Number(m[2]) * 60 + Number(m[3] ?? 0)) : 0;
}

/**
 * ISO 8601 string with offset for a local wall-clock time in a time zone.
 * Without a time, 12:00 is used for the offset and `hasTime` is false (the UI then shows only the date).
 */
export function localToIso(y: number, mo: number, d: number, time: string | undefined, tz: string): { start: string; hasTime: boolean } {
  const [h, mi] = time ? time.split(":").map(Number) : [12, 0];
  const guess = Date.UTC(y, mo - 1, d, h, mi);
  let off = offsetMinutes(tz, new Date(guess));
  off = offsetMinutes(tz, new Date(guess - off * 60_000)); // correct around DST switches
  const sign = off < 0 ? "-" : "+";
  const abs = Math.abs(off);
  const start = `${y}-${pad(mo)}-${pad(d)}T${pad(h)}:${pad(mi)}:00${sign}${pad(Math.floor(abs / 60))}:${pad(abs % 60)}`;
  return { start, hasTime: Boolean(time) };
}

/** Local calendar date (YYYY-MM-DD) of an instant in a time zone. */
export function localDate(iso: string, tz: string): string {
  return new Intl.DateTimeFormat("en-CA", { timeZone: tz, year: "numeric", month: "2-digit", day: "2-digit" }).format(new Date(iso));
}

/** Converts an ISO string (with or without offset, or date only) to { start, hasTime } in the given zone. */
export function normalizeIso(value: string, tz: string): { start: string; hasTime: boolean } | undefined {
  const dateOnly = value.match(/^(\d{4})-(\d{2})-(\d{2})$/);
  if (dateOnly) return localToIso(+dateOnly[1], +dateOnly[2], +dateOnly[3], undefined, tz);
  const local = value.match(/^(\d{4})-(\d{2})-(\d{2})[T ](\d{2}):(\d{2})(:\d{2}(\.\d+)?)?$/);
  if (local) return localToIso(+local[1], +local[2], +local[3], `${local[4]}:${local[5]}`, tz);
  const t = Date.parse(value);
  if (Number.isNaN(t)) return undefined;
  const parts = new Intl.DateTimeFormat("en-GB", { timeZone: tz, year: "numeric", month: "2-digit", day: "2-digit", hour: "2-digit", minute: "2-digit", hourCycle: "h23" }).formatToParts(new Date(t));
  const g = (k: string) => Number(parts.find((p) => p.type === k)?.value);
  return localToIso(g("year"), g("month"), g("day"), `${pad(g("hour"))}:${pad(g("minute"))}`, tz);
}

/** Finds the first "HH:MM", or "HH.MM uur/Uhr", in a text. A bare "07.12" (a date) is not a time. */
export function findTime(text: string): string | undefined {
  const m = text.match(/(?<![\d.])([01]?\d|2[0-3]):([0-5]\d)(?![\d.])/) ?? text.match(/(?<![\d.])([01]?\d|2[0-3])\.([0-5]\d)\s*(uur|uhr)\b/i);
  return m ? `${pad(Number(m[1]))}:${m[2]}` : undefined;
}
