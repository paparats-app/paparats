import { useMemo } from "react";
import { useServices } from "@/services/registry";
import type { SelfUpdateCheck } from "@/services/types";

/** SystemService actions for screens (nothing to cache: each call is a one-off). */
export interface SystemActions {
  /** Settings › About › Check for updates (the Paparats client itself). */
  checkForAppUpdate(): Promise<SelfUpdateCheck>;
  /** Opens an `https:` / `mailto:` address in the default browser. */
  openExternal(url: string): Promise<void>;
  copyToClipboard(text: string): Promise<void>;
  /** Start on Windows login. */
  setAutostart(enabled: boolean): Promise<void>;
}

export function useSystemActions(): SystemActions {
  const { system } = useServices();
  return useMemo(
    () => ({
      checkForAppUpdate: () => system.checkForAppUpdate(),
      openExternal: (url) => system.openExternal(url),
      copyToClipboard: (text) => system.copyToClipboard(text),
      setAutostart: (enabled) => system.setAutostart(enabled),
    }),
    [system],
  );
}

/** SettingsService actions beyond the settings themselves (those live in `useSettingsStore`). */
export interface SettingsActions {
  /** Settings › Privacy › Search history › Clear. */
  clearSearchHistory(): Promise<void>;
}

export function useSettingsActions(): SettingsActions {
  const { settings } = useServices();
  return useMemo(() => ({ clearSearchHistory: () => settings.clearSearchHistory() }), [settings]);
}
