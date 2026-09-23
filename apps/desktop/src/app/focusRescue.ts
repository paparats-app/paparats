// Keyboard focus that would fall to <body> (docs/decisions.md D61). When the control holding the
// focus disappears with its row or block — Library ⋯ → Uninstall, the stale callout's Keep /
// Unsubscribe, the Ideas note's ×, an idea card's Take, Cancel plan — the browser drops the focus
// to <body>: no ring shows and a screen reader loses its place. The content column watches for
// that and moves the focus to the nearest control where the block was: in the block's container
// (then the containers around it) the first control after that spot — a replacement rendered in
// its place, the next row — else the last one before it — the row above, the rest of the card —
// else the column itself. Hand-overs that screens do themselves (a replacement button, a
// dialog's opener, a navigation) run first and win: the rescue only acts on a focus still lost.
import { useCallback, useEffect, useRef, type RefObject } from "react";

const TABBABLE = [
  "a[href]",
  "button",
  "input",
  "select",
  "textarea",
  "[tabindex]",
  '[contenteditable="true"]',
].join(",");

/** In the Tab order: tabindex ≥ 0, enabled, not inert or hidden, rendered. */
export function isTabbable(el: HTMLElement): boolean {
  if (el.tabIndex < 0) return false;
  if (
    (el instanceof HTMLButtonElement ||
      el instanceof HTMLInputElement ||
      el instanceof HTMLSelectElement ||
      el instanceof HTMLTextAreaElement) &&
    el.disabled
  ) {
    return false;
  }
  if (el instanceof HTMLInputElement && el.type === "hidden") return false;
  if (el.closest("[inert], [hidden]")) return false;
  return typeof el.checkVisibility === "function" ? el.checkVisibility() : true;
}

/** Where a removed block was: its parent and the siblings around it at the time. */
export interface RemovalSpot {
  parent: Node;
  previous: Node | null;
  next: Node | null;
}

/** The spot of the removal that took `el` out of the document (the last one in `records`). */
export function removalSpot(records: readonly MutationRecord[], el: Element): RemovalSpot | null {
  let spot: RemovalSpot | null = null;
  for (const record of records) {
    for (const node of Array.from(record.removedNodes)) {
      if (node === el || node.contains(el)) {
        spot = {
          parent: record.target,
          previous: record.previousSibling,
          next: record.nextSibling,
        };
      }
    }
  }
  return spot;
}

const follows = (anchor: Node, el: Node) =>
  (anchor.compareDocumentPosition(el) & Node.DOCUMENT_POSITION_FOLLOWING) !== 0;

/** Whether `el` comes after the spot in document order (a replacement in its place counts). */
function afterSpot({ parent, previous, next }: RemovalSpot): (el: HTMLElement) => boolean {
  if (previous?.isConnected) return (el) => !previous.contains(el) && follows(previous, el);
  // The removed node was the parent's first child: all of the parent is after it.
  if (previous === null) return (el) => parent.contains(el) || follows(parent, el);
  if (next?.isConnected) return (el) => next.contains(el) || follows(next, el);
  return (el) => !parent.contains(el) && follows(parent, el);
}

/**
 * The control nearest to `spot` inside `scope`: in the removed block's parent, then in each
 * container above it, the first control after the spot (the next row, a replacement), else the
 * last one before it (the row above, the rest of the card). `null` when the spot is gone.
 */
export function neighbourOf(scope: HTMLElement, spot: RemovalSpot): HTMLElement | null {
  if (!spot.parent.isConnected || !scope.contains(spot.parent)) return null;
  const after = afterSpot(spot);
  for (
    let container: Node | null = spot.parent;
    container && (container === scope || scope.contains(container));
    container = container.parentNode
  ) {
    if (!(container instanceof Element)) continue;
    const controls = Array.from(container.querySelectorAll<HTMLElement>(TABBABLE)).filter(
      isTabbable,
    );
    const found = controls.find(after) ?? controls.filter((el) => !after(el)).at(-1);
    if (found) return found;
    if (container === scope) break;
  }
  return null;
}

/**
 * Focuses the content column. It takes `tabindex="-1"` only while it holds the focus, so a press
 * on plain text in the column still leaves the focus where the browser puts it.
 */
export function focusColumn(column: HTMLElement): void {
  column.setAttribute("tabindex", "-1");
  column.addEventListener("blur", () => column.removeAttribute("tabindex"), { once: true });
  column.focus({ preventScroll: true });
}

/**
 * Mounted once by the layout on the content column (`scope`): when the element holding the focus
 * leaves the document and nothing else takes the focus, it goes to the neighbour of the spot where
 * the column's last focused control was — or back to that control when it is still there (a dialog
 * whose opener survived). Focus that leaves on purpose (a press on plain text, another window) is
 * not followed. Returns `restore()`: the same hand-back on demand, for an overlay that took the
 * focus and ends without a navigation (Settings › Account › Sign in).
 */
export function useFocusRescue(scopeRef: RefObject<HTMLElement | null>): () => void {
  const restoreRef = useRef<() => void>(() => undefined);

  useEffect(() => {
    const scope = scopeRef.current;
    if (!scope || typeof MutationObserver === "undefined") return;
    /** The element that has the focus; `null` once the focus was let go on purpose. */
    let holder: Element | null = null;
    /** The last control inside the column that had the focus, and where it was removed. */
    let inScope: Element | null = null;
    let spot: RemovalSpot | null = null;
    let timer: ReturnType<typeof setTimeout> | undefined;

    const onFocusIn = (event: FocusEvent) => {
      if (!(event.target instanceof Element)) return;
      holder = event.target;
      if (event.target !== scope && scope.contains(event.target)) {
        inScope = event.target;
        spot = null;
      }
    };
    const onFocusOut = (event: FocusEvent) => {
      const left = event.target;
      if (event.relatedTarget || !(left instanceof Element)) return;
      // Still in the document but no longer focused: a press on plain text let the focus go.
      // (Another window taking the focus keeps `activeElement`; a removal disconnects it.)
      queueMicrotask(() => {
        if (holder === left && left.isConnected && document.activeElement !== left) holder = null;
      });
    };

    /** Back to the column's last control, else its neighbour, else the column. */
    const handBack = () => {
      let target: HTMLElement | null = null;
      if (inScope instanceof HTMLElement && inScope.isConnected && isTabbable(inScope)) {
        target = inScope;
      } else if (spot) {
        target = neighbourOf(scope, spot);
      }
      if (!target) {
        if (scope.isConnected) focusColumn(scope);
        return;
      }
      target.focus({ preventScroll: true });
      target.scrollIntoView?.({ block: "nearest" });
    };
    restoreRef.current = handBack;

    const rescue = (lost: Element) => {
      const active = document.activeElement;
      if (holder !== lost || (active && active !== document.body)) return;
      holder = null;
      handBack();
    };

    const observer = new MutationObserver((records) => {
      if (inScope && !inScope.isConnected && !spot) spot = removalSpot(records, inScope);
      const lost = holder;
      if (!lost || lost.isConnected) return;
      // Let the screens' own hand-overs and a closing dialog's return (effects) run first.
      clearTimeout(timer);
      timer = setTimeout(() => rescue(lost), 0);
    });
    observer.observe(document.body, { childList: true, subtree: true });
    document.addEventListener("focusin", onFocusIn);
    document.addEventListener("focusout", onFocusOut);
    if (document.activeElement && document.activeElement !== document.body) {
      holder = document.activeElement;
    }
    return () => {
      observer.disconnect();
      clearTimeout(timer);
      document.removeEventListener("focusin", onFocusIn);
      document.removeEventListener("focusout", onFocusOut);
      restoreRef.current = () => undefined;
    };
  }, [scopeRef]);

  return useCallback(() => restoreRef.current(), []);
}
