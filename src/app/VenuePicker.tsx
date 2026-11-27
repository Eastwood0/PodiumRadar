import { useEffect, useId, useMemo, useRef, useState } from "react";
import { norm, typoDistance } from "./search";

export interface VenueOption {
  id: string;
  n: string;
  city: string;
  cc: "NL" | "BE" | "DE";
  /** Shows that match the other filters. */
  count: number;
}

const COUNTRY = { NL: "Nederland", BE: "België", DE: "Duitsland" } as const;
const ORDER = ["NL", "BE", "DE"] as const;
const collator = new Intl.Collator("nl", { sensitivity: "base", numeric: true });

/** Sorted A–Z within each country, Nederland first (the list the picker opens with). */
export function sortVenues(list: VenueOption[]): VenueOption[] {
  return [...list].sort((a, b) => ORDER.indexOf(a.cc) - ORDER.indexOf(b.cc) || collator.compare(a.n, b.n));
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
  const words = `${name} ${norm(v.city)}`.split(" ");
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
export function VenuePicker({ venues, value, onChange }: { venues: VenueOption[]; value: string; onChange: (id: string) => void }) {
  const [q, setQ] = useState("");
  const [open, setOpen] = useState(false);
  const [active, setActive] = useState(0);
  const id = useId();
  const wrap = useRef<HTMLDivElement>(null);
  const list = useRef<HTMLUListElement>(null);
  const selected = venues.find((v) => v.id === value);

  const hits = useMemo(() => {
    const sorted = sortVenues(venues);
    if (!q.trim()) return sorted;
    return sorted
      .map((v) => ({ v, s: venueScore(q, v) }))
      .filter((x): x is { v: VenueOption; s: number } => x.s !== undefined)
      .sort((a, b) => a.s - b.s)
      .map((x) => x.v);
  }, [venues, q]);

  useEffect(() => {
    const close = (ev: MouseEvent) => {
      if (wrap.current && !wrap.current.contains(ev.target as Node)) setOpen(false);
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
          aria-activedescendant={open && hits[active] ? `${id}-${active}` : undefined}
          autoComplete="off"
          spellCheck={false}
          placeholder={selected ? `${selected.n}, ${selected.city}` : "Alle zalen · zoek zaal of stad"}
          className={selected ? "has-value" : undefined}
          value={q}
          onChange={(ev) => {
            setQ(ev.target.value);
            setOpen(true);
            setActive(0);
          }}
          onFocus={() => setOpen(true)}
          onClick={() => setOpen(true)}
          onKeyDown={(ev) => {
            if (ev.key === "ArrowDown") {
              ev.preventDefault();
              setOpen(true);
              setActive((i) => Math.min(i + 1, hits.length - 1));
            } else if (ev.key === "ArrowUp") {
              ev.preventDefault();
              setActive((i) => Math.max(i - 1, 0));
            } else if (ev.key === "Enter") {
              if (!open) return;
              ev.preventDefault();
              pick(hits[active]);
            } else if (ev.key === "Escape") {
              setOpen(false);
              setQ("");
            } else if (ev.key === "Tab") setOpen(false);
          }}
        />
        {selected && (
          <button type="button" className="vpick__clear" onClick={() => pick(undefined)}>
            <span aria-hidden="true">×</span>
            <span className="sr-only">Zaalkeuze wissen ({selected.n})</span>
          </button>
        )}
      </div>
      {open && (
        <ul id={`${id}-list`} role="listbox" aria-label="Zalen" className="vpick__list" ref={list}>
          {hits.length === 0 && (
            <li className="vpick__none" role="presentation">
              Geen zaal gevonden voor “{q.trim()}”
            </li>
          )}
          {hits.map((v, i) => (
            <li key={v.id} role="presentation">
              {grouped && (i === 0 || hits[i - 1].cc !== v.cc) && (
                <span className="vpick__group" aria-hidden="true">
                  {COUNTRY[v.cc]}
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
                  {v.city}
                  {!grouped && ` · ${v.cc}`}
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
