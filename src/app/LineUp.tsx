import { useMemo } from "react";
import type { SiteData, SiteVenue } from "../lib/site-data";
import { artistHref, type Bill, bill, type BillEntry, MONTHS_LONG, parts } from "./lib";

const longDate = (iso: string) => {
  const p = parts(iso);
  return `${p.d} ${MONTHS_LONG[p.m - 1]}`;
};
const shortDate = (iso: string) => {
  const p = parts(iso);
  return `${p.d}/${p.m}`;
};

function Act({ b }: { b: BillEntry }) {
  return (
    <li className="bill__act">
      <a href={artistHref(b.name)}>{b.name}</a>
      <span className="bill__meta">
        {b.nights > 1 ? `${b.nights} avonden` : shortDate(b.s)} {b.venue.city}
      </span>
    </li>
  );
}

/** The opening of the overview, set like a festival bill: what is on in the coming 30 days. */
export function LineUp({ data, venues }: { data: SiteData; venues: Map<string, SiteVenue> }) {
  const b = useMemo(() => bill(data.events, venues, data.generatedAt), [data, venues]);
  return <BillView b={b} />;
}

/**
 * The bill itself. The build also renders it straight into the page (index.astro), so the first screen
 * shows the line-up before the full agenda has even been downloaded.
 */
export function BillView({ b }: { b: Bill }) {
  if (!b.headliners.length) return null;
  const shown = b.headliners.length + b.support.length + b.club.length;
  const until = new Date(Date.parse(b.to) - 86_400_000).toISOString();
  return (
    <section className="bill" aria-labelledby="bill-h">
      <h1 id="bill-h" className="bill__h">
        Podiumradar presenteert, van {longDate(`${b.from}T12:00:00Z`)} tot {longDate(until)}
      </h1>
      <ul className="bill__row bill__row--1">
        {b.headliners.map((x) => (
          <Act key={x.name} b={x} />
        ))}
      </ul>
      {b.support.length > 0 && (
        <ul className="bill__row bill__row--2">
          {b.support.map((x) => (
            <Act key={x.name} b={x} />
          ))}
        </ul>
      )}
      {b.club.length > 0 && (
        <ul className="bill__row bill__row--3" aria-label="In de middelgrote zalen">
          {b.club.map((x) => (
            <Act key={x.name} b={x} />
          ))}
        </ul>
      )}
      {b.total > shown && (
        <p className="bill__more">
          En nog {b.total - shown} andere concerten in deze periode. <a href="#agenda">Naar de agenda</a>
        </p>
      )}
    </section>
  );
}
