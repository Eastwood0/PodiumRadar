import { useEffect, useId, useMemo, useRef, useState } from "react";
import { wholeLabel } from "./places";
import { norm, typoDistance } from "./search";

export interface VenueOption {
  id: string;
  n: string;
  city: string;
  cc: "NL" | "BE" | "DE";
  /** Shows that match the other filters. */
  count: number;
  /** Set for a whole region or city ("provincie", "stad", …) instead of one venue. */
  kind?: string;
  /** Number of venues in that region or city. */
  venues?: number;
  /** Extra words that find it, e.g. the province of a venue's city. */
  alt?: string;
}

const COUNTRY = { NL: "Nederland", BE: "België", DE: "Duitsland" } as const;
const ORDER = ["NL", "BE", "DE"] as const;
const collator = new Intl.Collator("nl", { sensitivity: "base", numeric: true });

const group = (o: VenueOption) => (o.kind ? -1 : ORDER.indexOf(o.cc));

/** Regions and cities first, then venues A–Z within each country, Nederland first (the list the picker opens with). */
export function sortVenues(list: VenueOption[]): VenueOption[] {
  return [...list].sort((a, b) => group(a) - group(b) || ORDER.indexOf(a.cc) - ORDER.indexOf(b.cc) || collator.compare(a.n, b.n));
}

/** "Noord-Brabant (hele provincie)", "Amsterdam (hele stad)" or "Ziggo Dome, Amsterdam". */
export function optionLabel(o: { n: string; city: string; kind?: string }): string {
  return o.kind ? `${o.n} (${wholeLabel(o.kind)})` : `${o.n}, ${o.city}`;
}

/**
 * How well a typed text matches a venue (lower is better, undefined = no match). Every typed word must match the
 * start of a word in the name or city; one typo is forgiven in words of four letters or more ("melkwge").
 */
export function venueScore(query: string, v: VenueOption): number | undefined {
  const q = norm(query);
  if (!q) return 0;
  const name = norm(v.n);
  if (name.startsWith(q)) return 0;
  const words = `${name} ${norm(v.city)} ${norm(v.alt ?? "")}`.split(" ").filter(Boolean);
  let total = 1;
  for (const t of q.split(" ")) {
    if (words.some((w) => w.startsWith(t))) continue;
    if (t.length >= 4 && words.some((w) => typoDistance(t, w.slice(0, t.length), 1) <= 1)) {
      total += 1;
      continue;
    }
    return undefined;
  }
  return total;
}

/**
 * Searchable venue choice (WAI-ARIA combobox): type part of a name or city, or open the A–Z list per country.
 * Arrow keys move, Enter picks, Escape closes, Tab leaves. Replaces a long native select.
 */
export function VenuePicker({
  venues,
  selected,
  onChange,
}: {
  venues: VenueOption[];
  /** The chosen venue, also when it has no shows under the other filters: it must stay visible and clearable. */
  selected?: { id: string; n: string; city: string; kind?: string };
  onChange: (id: string) => void;
}) {
  const [q, setQ] = useState("");
  const [open, setOpen] = useState(false);
  const [active, setActive] = useState(-1);
  const id = useId();
  const wrap = useRef<HTMLDivElement>(null);
  const list = useRef<HTMLUListElement>(null);
  const value = selected?.id ?? "";

  const hits = useMemo(() => {
    const sorted = sortVenues(venues);
    if (!q.trim()) return sorted.filter((v) => v.kind !== "stad"); // whole cities appear once you type
    return sorted
      .map((v) => ({ v, s: venueScore(q, v) }))
      .filter((x): x is { v: VenueOption; s: number } => x.s !== undefined)
      .sort((a, b) => a.s - b.s)
      .map((x) => x.v);
  }, [venues, q]);

  useEffect(() => {
    const close = (ev: MouseEvent) => {
      if (wrap.current && !wrap.current.contains(ev.target as Node)) {
        setOpen(false);
        setQ(""); // typed text that was not picked does not linger: the field shows the active choice again
      }
    };
    document.addEventListener("mousedown", close);
    return () => document.removeEventListener("mousedown", close);
  }, []);
  useEffect(() => {
    list.current?.querySelector<HTMLElement>(`[data-i="${active}"]`)?.scrollIntoView({ block: "nearest" });
  }, [active, open]);

  const pick = (v: VenueOption | undefined) => {
    onChange(v?.id ?? "");
    setQ("");
    setOpen(false);
    setActive(-1);
  };
  const close = () => {
    setOpen(false);
    setQ("");
    setActive(-1);
  };
  const grouped = !q.trim();

  return (
    <div className="vpick" ref={wrap}>
      <label htmlFor={`${id}-in`} className="sr-only">
        Zaal
      </label>
      <div className="vpick__field">
        <input
          id={`${id}-in`}
          type="text"
          role="combobox"
          aria-expanded={open}
          aria-controls={`${id}-list`}
          aria-autocomplete="list"
          aria-activedescendant={open && active >= 0 && hits[active] ? `${id}-${active}` : undefined}
          autoComplete="off"
          spellCheck={false}
          placeholder={selected ? optionLabel(selected) : "Alle zalen · zoek zaal, stad of regio"}
          className={selected ? "has-value" : undefined}
          value={q}
          onChange={(ev) => {
            setQ(ev.target.value);
            setOpen(true);
            setActive(ev.target.value.trim() ? 0 : -1);
          }}
          onFocus={() => setOpen(true)}
          onClick={() => setOpen(true)}
          onKeyDown={(ev) => {
            if (ev.key === "ArrowDown") {
              ev.preventDefault();
              setActive((i) => (!open ? 0 : Math.min(i + 1, hits.length - 1)));
              setOpen(true);
            } else if (ev.key === "ArrowUp") {
              ev.preventDefault();
              setActive((i) => (!open || i < 0 ? hits.length - 1 : Math.max(i - 1, 0)));
              setOpen(true);
            } else if (ev.key === "Enter") {
              if (!open || !hits[active]) return; // nothing highlighted: Enter changes nothing
              ev.preventDefault();
              pick(hits[active]);
            } else if (ev.key === "Escape" || ev.key === "Tab") close();
          }}
        />
        {selected && (
          <button type="button" className="vpick__clear" onClick={() => pick(undefined)}>
            <span aria-hidden="true">×</span>
            <span className="sr-only">Keuze wissen ({selected.n})</span>
          </button>
        )}
      </div>
      {open && (
        <ul id={`${id}-list`} role="listbox" aria-label="Zalen" className="vpick__list" ref={list}>
          {hits.length === 0 && (
            <li className="vpick__none" role="status">
              Geen zaal gevonden voor “{q.trim()}”
            </li>
          )}
          {hits.map((v, i) => (
            <li key={v.id} role="presentation">
              {grouped && (i === 0 || group(hits[i - 1]) !== group(v)) && (
                <span className="vpick__group" aria-hidden="true">
                  {v.kind ? "Regio’s" : COUNTRY[v.cc]}
                </span>
              )}
              <div
                id={`${id}-${i}`}
                data-i={i}
                role="option"
                aria-selected={v.id === value}
                className={`vpick__opt${i === active ? " is-active" : ""}`}
                onMouseDown={(ev) => ev.preventDefault()}
                onMouseEnter={() => setActive(i)}
                onClick={() => pick(v)}
              >
                <span className="vpick__name">{v.n}</span>
                <span className="vpick__meta">
                  {v.kind ? `${wholeLabel(v.kind)} · ${v.venues} ${v.venues === 1 ? "zaal" : "zalen"}` : v.city}
                  {(!grouped || v.kind) && ` · ${v.cc}`}
                </span>
                <span className="vpick__count">{v.count}</span>
              </div>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
