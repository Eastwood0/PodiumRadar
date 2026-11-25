import { readFileSync } from "node:fs";
import { parse } from "yaml";
import { VenueConfigSchema, type Venue } from "./schema";

/** Parse and validate venue configuration text (YAML). Throws with a readable message on invalid input. */
export function parseVenueConfig(yamlText: string): Venue[] {
  const result = VenueConfigSchema.safeParse(parse(yamlText));
  if (!result.success) {
    const details = result.error.issues.map((i) => `- ${i.path.join(".")}: ${i.message}`).join("\n");
    throw new Error(`config/venues.yml is ongeldig:\n${details}`);
  }
  return result.data.venues;
}

export function loadVenues(path = "config/venues.yml"): Venue[] {
  return parseVenueConfig(readFileSync(path, "utf8"));
}
