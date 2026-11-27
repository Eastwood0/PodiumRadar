import { useEffect, useId, useMemo, useRef, useState } from "react";
import { getFollowState, isFollowed, setFollowState, toggled } from "./follow";
import { type SearchHit, withFollowOption } from "./search";

/** Combobox: type, pick with arrows/enter or tap. Opens the artist or venue page. */
export function SearchBox({ search, failed = false }: { search: ((q: string) => SearchHit[]) | null; failed?: boolean }) {
  const [q, setQ] = useState("");
  const [open, setOpen] = useState(false);
  const [active, setActive] = useState(0);
  const listId = useId();
  const wrap = useRef<HTMLDivElement>(null);
  const hits = useMemo(() => (search ? withFollowOption(q, search(q)) : []), [search, q]);
  useEffect(() => {
    document.getElementById(`${listId}-${active}`)?.scrollIntoView({ block: "nearest" });
  }, [active, listId]);

  useEffect(() => {
    const close = (ev: MouseEvent) => {
      if (wrap.current && !wrap.current.contains(ev.target as Node)) setOpen(false);
    };
    document.addEventListener("mousedown", close);
    return () => document.removeEventListener("mousedown", close);
  }, []);

  const go = (hit: SearchHit | undefined) => {
    if (!hit) return;
    if (hit.kind === "volg" && hit.name) {
      const s = getFollowState();
      if (!isFollowed(s, hit.name)) setFollowState(toggled(s, hit.name));
    }
    location.hash = hit.href;
    setOpen(false);
    setQ("");
    (document.activeElement as HTMLElement | null)?.blur();
  };

  const showList = open && q.trim().length >= 2;
  return (
    <div className="search" ref={wrap}>
      <label htmlFor={`${listId}-input`} className="sr-only">
        Zoek artiest, zaal of regio
      </label>
      <svg className="search__icon" viewBox="0 0 24 24" aria-hidden="true">
        <circle cx="11" cy="11" r="7" />
        <path d="m20 20-4.2-4.2" />
      </svg>
      <input
        id={`${listId}-input`}
        type="search"
        role="combobox"
        aria-expanded={showList}
        aria-controls={listId}
        aria-activedescendant={showList && hits[active] ? `${listId}-${active}` : undefined}
        aria-autocomplete="list"
        autoComplete="off"
        placeholder={search ? "Zoek artiest, zaal of regio" : failed ? "Zoeken niet beschikbaar" : "Agenda laden…"}
        disabled={!search}
        value={q}
        onChange={(ev) => {
          setQ(ev.target.value);
          setOpen(true);
          setActive(0);
        }}
        onFocus={() => setOpen(true)}
        onKeyDown={(ev) => {
          if (ev.key === "ArrowDown") {
            ev.preventDefault();
            setActive((i) => Math.min(i + 1, hits.length - 1));
          } else if (ev.key === "ArrowUp") {
            ev.preventDefault();
            setActive((i) => Math.max(i - 1, 0));
          } else if (ev.key === "Enter") {
            if (!showList) return; // Enter after Escape must not run a hidden choice (such as "Volg")
            ev.preventDefault();
            go(hits[active]);
          } else if (ev.key === "Escape") setOpen(false);
          else if (ev.key === "Tab") setOpen(false);
        }}
      />
      {showList && (
        <ul id={listId} role="listbox" className="search__list">
          {hits.map((h, i) => (
            <li
              key={h.href}
              id={`${listId}-${i}`}
              role="option"
              aria-selected={i === active}
              className={`search__hit${i === active ? " is-active" : ""}`}
              onMouseDown={(ev) => ev.preventDefault()}
              onClick={() => go(h)}
              onMouseEnter={() => setActive(i)}
            >
              <span className={`search__kind search__kind--${h.kind}`}>{h.kind}</span>
              <span className="search__label">{h.label}</span>
              <span className="search__detail">{h.detail}</span>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
