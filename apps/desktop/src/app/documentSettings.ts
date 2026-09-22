// Applies the appearance settings to <html>: `data-theme` (System follows the OS through
// `prefers-color-scheme`, which WebView2 mirrors from Windows), `data-motion="off"` when "Subtle
// animations" is off, and the UI language. Stores never touch the DOM; the shell does it here.
import { useEffect, useSyncExternalStore } from "react";
import { changeLocale } from "@/i18n";
import type { Settings, ThemePreference } from "@/services/types";
import { useSettingsStore } from "@/stores/useSettingsStore";

export type ResolvedTheme = "dark" | "light";

const DARK_QUERY = "(prefers-color-scheme: dark)";

export function resolveTheme(preference: ThemePreference, systemDark: boolean): ResolvedTheme {
  if (preference === "system") return systemDark ? "dark" : "light";
  return preference;
}

function darkQuery(): MediaQueryList | null {
  return typeof window !== "undefined" && typeof window.matchMedia === "function"
    ? window.matchMedia(DARK_QUERY)
    : null;
}

/** The OS colour scheme; dark (the app's default) when it cannot be read. */
export function systemPrefersDark(): boolean {
  return darkQuery()?.matches ?? true;
}

function subscribeSystemTheme(onChange: () => void): () => void {
  const query = darkQuery();
  if (!query) return () => undefined;
  query.addEventListener("change", onChange);
  return () => query.removeEventListener("change", onChange);
}

export function applyDocumentSettings(
  settings: Pick<Settings, "theme" | "animations">,
  systemDark: boolean,
  root: HTMLElement = document.documentElement,
): void {
  root.dataset.theme = resolveTheme(settings.theme, systemDark);
  if (settings.animations) delete root.dataset.motion;
  else root.dataset.motion = "off";
}

/** Mounted once by the app providers; follows the settings store and the OS theme. */
export function useDocumentSettings(): void {
  const theme = useSettingsStore((s) => s.settings.theme);
  const animations = useSettingsStore((s) => s.settings.animations);
  const locale = useSettingsStore((s) => s.settings.locale);
  const systemDark = useSyncExternalStore(subscribeSystemTheme, systemPrefersDark, () => true);

  useEffect(() => {
    applyDocumentSettings({ theme, animations }, systemDark);
  }, [theme, animations, systemDark]);

  useEffect(() => {
    void changeLocale(locale);
  }, [locale]);
}
