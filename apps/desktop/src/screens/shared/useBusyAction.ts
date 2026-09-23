import { useCallback, useRef, useState } from "react";

/** Runs `task` unless one is already running; resolves when it settles. */
export type RunBusy = (task: () => Promise<unknown>) => Promise<void>;

/**
 * One async action at a time, for a button that sends something (Subscribe, Sync now, Take,
 * Activate…): `busy` while it runs — pass it to the button's `loading` — and a second press
 * meanwhile does nothing, so nothing is sent twice. The guard is a ref, so even two presses in
 * the same frame run the task once. `task` handles its own errors (the handoff has no failure
 * copy); a rejection still clears `busy` and reaches the caller.
 */
export function useBusyAction(): [busy: boolean, run: RunBusy] {
  const running = useRef(false);
  const [busy, setBusy] = useState(false);
  const run = useCallback<RunBusy>(async (task) => {
    if (running.current) return;
    running.current = true;
    setBusy(true);
    try {
      await task();
    } finally {
      running.current = false;
      setBusy(false);
    }
  }, []);
  return [busy, run];
}
