/** What an adapter returns per event, before normalisation into the Event schema. */
export interface SourceEvent {
  venueId: string;
  title: string;
  /** Optional explicit line-up; otherwise derived from the title. */
  artists?: string[];
  /** ISO with offset, produced with scripts/lib/dates.ts. */
  start: string;
  hasTime: boolean;
  status?: "gepland" | "uitverkocht" | "verplaatst" | "geannuleerd";
  /** The source's own category label, if any (helps the muziek/overig split). */
  sourceCategory?: string;
  /** Page about this event on the source site. */
  url: string;
  /** Direct ticket link, if the source gives one. */
  ticketUrl?: string;
  /** Id of the event at the source (stable between runs), or the url. */
  sourceId: string;
  onSaleStart?: string;
  imageUrl?: string;
}

export interface Adapter {
  /** Source name shown in the UI and status page, e.g. "afaslive.nl". */
  name: string;
  venues: string[];
  /** Fetches all upcoming events. Throws on failure; never returns partial data silently. */
  fetch(): Promise<SourceEvent[]>;
}
