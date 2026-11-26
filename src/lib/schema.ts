import { z } from "zod";
import { MUSIC_GENRES } from "./genres";

/** Datamodel from docs/BOUWPLAN.md §7. */

export const VenueCountry = z.enum(["NL", "BE", "DE"]);
export const EventCountry = z.enum(["NL", "BE", "DE", "GB", "FR"]);

/** Only http(s) links: blocks javascript: and other schemes in links rendered on the site. */
const HttpUrl = z.url({ protocol: /^https?$/ });

export const VenueSchema = z.object({
  id: z.string().regex(/^[a-z0-9]+(-[a-z0-9]+)*$/, "id must be a lowercase slug"),
  name: z.string().min(1),
  aliases: z.array(z.string().min(1)).default([]),
  city: z.string().min(1),
  country: VenueCountry,
  tier: z.enum(["A", "B"]),
  /** false until name, location and sources are verified in phase 1. */
  verified: z.boolean().default(false),
  lat: z.number().min(-90).max(90).optional(),
  lng: z.number().min(-180).max(180).optional(),
  website: HttpUrl.optional(),
  sources: z
    .object({
      ticketmasterVenueIds: z.array(z.string().min(1)).default([]),
      site: z
        .object({
          level: z.union([z.literal(1), z.literal(2), z.literal(3)]),
          adapter: z.string().min(1),
          url: HttpUrl,
        })
        .optional(),
    })
    .default({ ticketmasterVenueIds: [] }),
});
export type Venue = z.infer<typeof VenueSchema>;

export const VenueConfigSchema = z
  .object({ venues: z.array(VenueSchema).min(1) })
  .superRefine((cfg, ctx) => {
    const seen = new Set<string>();
    cfg.venues.forEach((v, i) => {
      if (seen.has(v.id)) {
        ctx.addIssue({ code: "custom", message: `duplicate venue id "${v.id}"`, path: ["venues", i, "id"] });
      }
      seen.add(v.id);
      if (v.verified && (v.lat === undefined || v.lng === undefined || !v.website)) {
        ctx.addIssue({
          code: "custom",
          message: `verified venue "${v.id}" needs lat, lng and website`,
          path: ["venues", i],
        });
      }
    });
  });
export type VenueConfig = z.infer<typeof VenueConfigSchema>;

export const EventSchema = z.object({
  id: z.string().min(1),
  title: z.string().min(1),
  artists: z
    .array(z.object({ name: z.string().min(1), ticketmasterAttractionId: z.string().optional() }))
    .min(1),
  venueId: z.string().nullable(),
  venueName: z.string().min(1),
  city: z.string().min(1),
  country: EventCountry,
  start: z.iso.datetime({ offset: true }),
  hasTime: z.boolean(),
  status: z.enum(["gepland", "uitverkocht", "verplaatst", "geannuleerd"]),
  onSaleStart: z.iso.datetime({ offset: true }).optional(),
  category: z.enum(["muziek", "overig"]),
  /** Display genre, e.g. "Concert", "Comedy", "Sport" (scripts/lib/categorize.ts). */
  genre: z.string().min(1).optional(),
  /** Music genres (max 2) from the source, the title or the artist's MusicBrainz tags (B31). */
  musicGenres: z.array(z.enum(MUSIC_GENRES)).max(2).optional(),
  ticketUrl: HttpUrl,
  imageUrl: HttpUrl.optional(),
  sources: z
    .array(z.object({ name: z.string().min(1), sourceId: z.string().min(1), url: HttpUrl }))
    .min(1),
  firstSeen: z.iso.date(),
  lastSeen: z.iso.date(),
});
export type Event = z.infer<typeof EventSchema>;
