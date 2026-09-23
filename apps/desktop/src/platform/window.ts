import { getCurrentWindow } from "@tauri-apps/api/window";
import { isTauri } from "./runtime";

/**
 * Resize subscribers. The native `tauri://resize` listener is registered once, on the first
 * subscription, and kept for the life of the window: unlistening removes the JS callback before
 * the core hears about it, so a resize emitted in between — the window is shown and sized as the
 * first frame paints, exactly when React's development StrictMode unmounts and remounts effects —
 * was delivered to a missing callback ("[TAURI] Couldn't find callback id …").
 */
const resizeSubscribers = new Set<() => void>();
let resizeListener: Promise<unknown> | null = null;

function listenForResizes(): void {
  if (resizeListener) return;
  resizeListener = getCurrentWindow()
    .onResized(() => {
      for (const cb of [...resizeSubscribers]) cb();
    })
    .catch(() => {
      // Not listening after all: the next subscription tries again.
      resizeListener = null;
    });
}

/** Thin wrapper over the native window so the chrome also works in a plain browser. */
export const nativeWindow = {
  minimize(): void {
    if (isTauri()) void getCurrentWindow().minimize();
  },
  toggleMaximize(): void {
    if (isTauri()) void getCurrentWindow().toggleMaximize();
  },
  close(): void {
    if (isTauri()) void getCurrentWindow().close();
  },
  async isMaximized(): Promise<boolean> {
    return isTauri() ? getCurrentWindow().isMaximized() : false;
  },
  /** Subscribes to resize events; returns an unsubscribe function. */
  onResized(cb: () => void): () => void {
    if (!isTauri()) return () => undefined;
    // A wrapper per subscription, so the same callback can subscribe twice and leave once.
    const subscriber = () => cb();
    resizeSubscribers.add(subscriber);
    listenForResizes();
    return () => {
      resizeSubscribers.delete(subscriber);
    };
  },
};
