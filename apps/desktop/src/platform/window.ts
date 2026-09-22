import { getCurrentWindow } from "@tauri-apps/api/window";
import { isTauri } from "./runtime";

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
    const pending = getCurrentWindow().onResized(cb);
    return () => void pending.then((un) => un());
  },
};
