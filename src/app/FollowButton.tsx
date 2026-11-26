import { isFollowed, MAX_FOLLOWS, setFollowState, toggled, useFollows } from "./follow";

/**
 * ☆ Volgen / ★ Volgend for one artist (bouwplan §9). `big` is the button on the artist page; the small one sits
 * next to a name on an event card. Works without the server: the list is kept in this browser.
 */
export function FollowButton({ name, big = false }: { name: string; big?: boolean }) {
  const s = useFollows();
  const on = isFollowed(s, name);
  const full = !on && s.artists.length >= MAX_FOLLOWS;
  return (
    <button
      type="button"
      className={`follow${big ? " follow--big" : ""}${on ? " is-on" : ""}`}
      aria-pressed={on}
      disabled={full}
      title={full ? `Je volgt al ${MAX_FOLLOWS} artiesten` : undefined}
      onClick={() => setFollowState(toggled(s, name))}
    >
      <span aria-hidden="true">{on ? "★" : "☆"}</span>
      {big ? <span>{on ? "Volgend" : "Volgen"}</span> : <span className="sr-only">{name} volgen</span>}
    </button>
  );
}
