import type { SiteVenue } from "../lib/site-data";

/**
 * Areas you can filter on instead of one venue: provinces and well-known areas spanning two or more cities, and
 * every city with two or more venues ("Heel Amsterdam"). The filter value is "plaats:<id>". A province with only
 * one city (Utrecht, Groningen) is covered by that city. Every city here must exist in config/venues.yml (test).
 */
export const PLACE_PREFIX = "plaats:";

interface Area {
  id: string;
  name: string;
  /** What kind of area, shown under the name. */
  kind: string;
  cc: "NL" | "BE" | "DE";
  cities: string[];
  /** Other words people type for it. */
  aliases?: string[];
}

export const AREAS: Area[] = [
  { id: "randstad", name: "Randstad", kind: "gebied", cc: "NL", cities: ["Amsterdam", "Haarlem", "Rotterdam", "Den Haag", "Utrecht"] },
  { id: "noord-holland", name: "Noord-Holland", kind: "provincie", cc: "NL", cities: ["Amsterdam", "Haarlem"] },
  { id: "zuid-holland", name: "Zuid-Holland", kind: "provincie", cc: "NL", cities: ["Rotterdam", "Den Haag"] },
  { id: "gelderland", name: "Gelderland", kind: "provincie", cc: "NL", cities: ["Arnhem", "Nijmegen"] },
  { id: "noord-brabant", name: "Noord-Brabant", kind: "provincie", cc: "NL", cities: ["'s-Hertogenbosch", "Bergeijk", "Breda", "Eindhoven", "Tilburg"], aliases: ["brabant"] },
  { id: "limburg", name: "Limburg", kind: "provincie", cc: "NL", cities: ["Heerlen", "Kerkrade", "Landgraaf", "Maastricht", "Roermond", "Sittard", "Venlo", "Weert"] },
  { id: "zuid-limburg", name: "Zuid-Limburg", kind: "gebied", cc: "NL", cities: ["Heerlen", "Kerkrade", "Landgraaf", "Maastricht", "Sittard"], aliases: ["heuvelland"] },
  { id: "vlaanderen", name: "Vlaanderen", kind: "gewest", cc: "BE", cities: ["Antwerpen", "Hasselt"], aliases: ["flanders"] },
  { id: "nrw", name: "Noordrijn-Westfalen", kind: "deelstaat", cc: "DE", cities: ["Dortmund", "Düsseldorf", "Essen", "Gelsenkirchen", "Keulen", "Mönchengladbach", "Oberhausen"], aliases: ["nrw", "nordrhein westfalen"] },
  { id: "ruhrgebied", name: "Ruhrgebied", kind: "gebied", cc: "DE", cities: ["Dortmund", "Essen", "Gelsenkirchen", "Oberhausen"], aliases: ["ruhr", "ruhrgebiet"] },
];

export interface Place {
  /** Filter value, "plaats:<id>". */
  id: string;
  name: string;
  /** "provincie", "gebied", "stad", … */
  kind: string;
  cc: "NL" | "BE" | "DE";
  aliases: string[];
  cities: string[];
}

const citySlug = (c: string) =>
  c
    .toLowerCase()
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-|-$/g, "");

/** The areas plus every city with two or more venues. */
export function placesFor(venues: SiteVenue[]): Place[] {
  const perCity = new Map<string, SiteVenue[]>();
  for (const v of venues) perCity.set(v.city, [...(perCity.get(v.city) ?? []), v]);
  const cities: Place[] = [...perCity]
    .filter(([, vs]) => vs.length >= 2)
    .map(([city, vs]) => ({ id: `${PLACE_PREFIX}stad-${citySlug(city)}`, name: city, kind: "stad", cc: vs[0].cc, aliases: [], cities: [city] }));
  const areas: Place[] = AREAS.map((a) => ({ id: `${PLACE_PREFIX}${a.id}`, name: a.name, kind: a.kind, cc: a.cc, aliases: a.aliases ?? [], cities: a.cities }));
  return [...areas, ...cities];
}

/** "hele provincie", "heel gebied", "hele stad". */
export const wholeLabel = (kind: string) => (kind === "gebied" ? "heel gebied" : `hele ${kind}`);

/** Names of the areas a city lies in, so a search on "brabant" also finds the venues in Eindhoven. */
export function areaWords(city: string): string {
  return AREAS.filter((a) => a.cities.includes(city))
    .flatMap((a) => [a.name, ...(a.aliases ?? [])])
    .join(" ");
}

/** True when the venue filter (one venue id or "plaats:<id>") lets this venue through. */
export function matchesPlace(filter: string, v: SiteVenue, places: Place[]): boolean {
  if (!filter) return true;
  if (!filter.startsWith(PLACE_PREFIX)) return v.id === filter;
  const p = places.find((x) => x.id === filter);
  return !!p && p.cities.includes(v.city);
}
