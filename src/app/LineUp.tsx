import { useMemo, useState } from "react";
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
  const [full, setFull] = useState(false);
  return <BillView b={b} full={full} onToggle={() => setFull((x) => !x)} />;
}

/**
 * The bill itself: six headliners, the rest behind "Meer namen" (B53: the full bill took two phone screens).
 * The build also renders it straight into the page (index.astro), so the first screen shows the line-up before the
 * full agenda has been downloaded; that static copy has no toggle.
 */
export function BillView({ b, full = false, onToggle }: { b: Bill; full?: boolean; onToggle?: () => void }) {
  if (!b.headliners.length) return null;
  const until = new Date(Date.parse(b.to) - 86_400_000).toISOString();
  const more = b.support.length + b.club.length;
  return (
    <section className="bill" aria-labelledby="bill-h">
      {/* First what people come for on a phone: tonight and this weekend, before the big names (Codex). */}
      <nav className="bill__quick" aria-label="Snel naar">
        <a className="btn" href="#agenda/vandaag">
          Vandaag
        </a>
        <a className="btn" href="#agenda/weekend">
          Dit weekend
        </a>
        <a className="btn" href="#agenda/week">
          7 dagen
        </a>
      </nav>
      <h1 id="bill-h" className="bill__h">
        Podiumradar presenteert, van {longDate(`${b.from}T12:00:00Z`)} tot {longDate(until)}
      </h1>
      <ul className="bill__row bill__row--1">
        {b.headliners.map((x) => (
          <Act key={x.name} b={x} />
        ))}
      </ul>
      <div className="bill__foot">
        {onToggle && more > 0 && (
          <button type="button" className="btn btn--quiet" aria-expanded={full} aria-controls="bill-more" onClick={onToggle}>
            {full ? "Minder namen" : `Meer namen (${more})`}
          </button>
        )}
        <a className="bill__all" href="#agenda">
          Naar de agenda
        </a>
      </div>
      <div id="bill-more">
        {full && b.support.length > 0 && (
          <ul className="bill__row bill__row--2">
            {b.support.map((x) => (
              <Act key={x.name} b={x} />
            ))}
          </ul>
        )}
        {full && b.club.length > 0 && (
          <ul className="bill__row bill__row--3" aria-label="In de middelgrote zalen">
            {b.club.map((x) => (
              <Act key={x.name} b={x} />
            ))}
          </ul>
        )}
      </div>
    </section>
  );
}
