// The native shell around the UI — tray, "Minimize to system tray", the window appearing after the
// first frame, `paparats://` links and tray actions — as the app shell sees it. Inside Tauri it
// talks to the core (`services/tauri/system.ts › tauriShell`), also with `PAPARATS_MOCK=1`: the
// tray and the window are real even when the data is not. In a plain browser and in tests without
// an IPC mock every call does nothing.
import type { Unsubscribe } from "@/services/contracts";
import { tauriShell, type DeepLinkTarget, type TrayAction } from "@/services/tauri/system";
import type { Locale } from "@/services/types";
import { isTauri } from "./runtime";

export type { DeepLinkTarget, TrayAction };

function quietly(call: () => Promise<void>): void {
  // The shell's answers carry nothing the UI needs; a failure only means an older core.
  call().catch((e: unknown) => console.warn("Paparats: native shell call failed", e));
}

export const nativeShell = {
  /** Relabels the tray menu (startup and every language change). */
  setLocale(locale: Locale): void {
    if (isTauri()) quietly(() => tauriShell.setLocale(locale));
  },
  /** Closing the window hides it in the tray instead of quitting (startup and every change). */
  setMinimizeToTray(enabled: boolean): void {
    if (isTauri()) quietly(() => tauriShell.setMinimizeToTray(enabled));
  },
  /** The first frame is painted: the window may appear (it starts hidden, so nothing flashes). */
  windowReady(): void {
    if (isTauri()) quietly(() => tauriShell.windowReady());
  },
  /** `paparats://app/<id>` / `paparats://channel/<id>`, including the one that started the app. */
  onDeepLink(listener: (target: DeepLinkTarget) => void): Unsubscribe {
    return isTauri() ? tauriShell.subscribeDeepLinks(listener) : () => undefined;
  },
  /** Tray menu entries the UI carries out. */
  onTrayAction(listener: (action: TrayAction) => void): Unsubscribe {
    return isTauri() ? tauriShell.subscribeTrayActions(listener) : () => undefined;
  },
};

/**
 * Calls `callback` once the frame after the current one is painted — or after `fallbackMs` when
 * frames are not being produced (WebView2 may skip animation frames while the window is still
 * hidden, which it is until this fires). Returns a cancel function.
 */
export function afterFirstPaint(callback: () => void, fallbackMs = 120): () => void {
  let done = false;
  let frame = 0;
  const fire = () => {
    if (done) return;
    done = true;
    cancelAnimationFrame(frame);
    clearTimeout(timer);
    callback();
  };
  const timer = setTimeout(fire, fallbackMs);
  frame = requestAnimationFrame(() => {
    frame = requestAnimationFrame(fire);
  });
  return () => {
    done = true;
    cancelAnimationFrame(frame);
    clearTimeout(timer);
  };
}
