/**
 * Decodes the compact, reference-based JSON some Next.js sites put in their page data
 * (e.g. the Sportpaleis group): a flat array of [type, value] entries where
 *   [0, x]            is a plain value,
 *   [1, [i, j, ...]]  is an array of references,
 *   [2, [[k, v], ...]] is an object whose keys and values are references,
 *   [-1]              is undefined.
 * Entry 0 is the root. Shared references are decoded once.
 */
export function decodeCompactJson(entries: unknown): unknown {
  if (!Array.isArray(entries) || !entries.length) throw new Error("compact JSON: lege of ongeldige invoer");
  const memo = new Map<number, unknown>();
  const visiting = new Set<number>();
  const decode = (i: number): unknown => {
    if (memo.has(i)) return memo.get(i);
    if (visiting.has(i)) throw new Error(`compact JSON: kringverwijzing bij ${i}`);
    const entry = entries[i];
    if (Array.isArray(entry) && entry.length === 1 && entry[0] === -1) return undefined;
    if (!Array.isArray(entry) || entry.length !== 2) throw new Error(`compact JSON: ongeldig item ${i}`);
    visiting.add(i);
    const [type, value] = entry as [number, unknown];
    let out: unknown;
    if (type === 0) out = value;
    else if (type === 1) out = (value as number[]).map(decode);
    else if (type === 2) out = Object.fromEntries((value as [number, number][]).map(([k, v]) => [String(decode(k)), decode(v)]));
    else throw new Error(`compact JSON: onbekend type ${type} bij ${i}`);
    visiting.delete(i);
    memo.set(i, out);
    return out;
  };
  return decode(0);
}
