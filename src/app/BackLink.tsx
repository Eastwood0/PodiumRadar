import { canGoBack } from "./nav";

/**
 * "← Terug" to the exact spot in the list you came from (App restores the scroll position). Opened straight from a
 * shared link there is nothing to go back to in the site: then it leads to the agenda.
 */
export function BackLink() {
  if (!canGoBack())
    return (
      <a className="back" href="#agenda">
        <span aria-hidden="true">←</span> Naar de agenda
      </a>
    );
  return (
    <button type="button" className="back" onClick={() => history.back()}>
      <span aria-hidden="true">←</span> Terug
    </button>
  );
}
