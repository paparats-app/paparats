// The UI's side of the native shell (platform/shell.ts): the tray menu speaks the UI language,
// "Minimize to system tray" decides what the close button does, and the window — created hidden
// on the theme's background — appears once the first frame is painted, so nothing flashes.
// Mounted once by the app providers; does nothing outside Tauri.
import { useEffect } from "react";
import { afterFirstPaint, nativeShell } from "@/platform/shell";
import { useSettingsStore } from "@/stores/useSettingsStore";

export function useNativeShell(): void {
  const locale = useSettingsStore((s) => s.settings.locale);
  const tray = useSettingsStore((s) => s.settings.tray);

  useEffect(() => {
    nativeShell.setLocale(locale);
  }, [locale]);

  useEffect(() => {
    nativeShell.setMinimizeToTray(tray);
  }, [tray]);

  useEffect(() => afterFirstPaint(() => nativeShell.windowReady()), []);
}
