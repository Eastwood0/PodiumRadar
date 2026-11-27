import { useEffect, useState } from "react";
import type { SiteData, SiteEvent, SiteVenue } from "../lib/site-data";
import { EventCard } from "./EventCard";
import { MONTHS_LONG, monthKey } from "./lib";

const PAGE = 60;
/** The first render shows a screenful only, so the first shows appear sooner on a slow phone; the rest follows at once. */
const FIRST = 16;

/** Chronological list with month headings; renders in pages so long lists stay fast on phones. */
export function EventList({ events, venues, data, showVenue = true, empty, fresh }: { events: SiteEvent[]; venues: Map<string, SiteVenue>; data: SiteData; showVenue?: boolean; empty: React.ReactNode; fresh?: (e: SiteEvent) => boolean }) {
  const [shown, setShown] = useState(FIRST);
  useEffect(() => {
    const id = requestAnimationFrame(() => setTimeout(() => setShown((n) => Math.max(n, PAGE)), 0));
    return () => cancelAnimationFrame(id);
  }, []);
  if (!events.length) return <div className="empty">{empty}</div>;
  const visible = events.slice(0, shown);
  const groups: { key: string; items: SiteEvent[] }[] = [];
  for (const e of visible) {
    const k = monthKey(e.s);
    if (groups.at(-1)?.key !== k) groups.push({ key: k, items: [] });
    groups.at(-1)!.items.push(e);
  }
  return (
    <div className="list">
      {groups.map((g) => {
        const [y, m] = g.key.split("-");
        return (
          <section key={g.key} className="month" aria-label={`${MONTHS_LONG[+m - 1]} ${y}`}>
            <h2 className="month__h">
              {MONTHS_LONG[+m - 1]} <span>{y}</span>
            </h2>
            {g.items.map((e) => (
              <EventCard key={e.id} e={e} venue={venues.get(e.v)!} data={data} showVenue={showVenue} fresh={fresh} />
            ))}
          </section>
        );
      })}
      {shown < events.length && (
        <button type="button" className="more" onClick={() => setShown((n) => n + PAGE)}>
          Toon meer ({events.length - shown} over)
        </button>
      )}
    </div>
  );
}
