// Tray menu entries the UI carries out: "Check for updates" opens Settings › About and runs the
// same check as its button (≈1.2 s at least, then a toast). Mounted once by the shell layout.
import { useEffect, useRef } from "react";
import { useTranslation } from "react-i18next";
import { nativeShell } from "@/platform/shell";
import { useSystemActions } from "@/queries";
import { useUiStore } from "@/stores/useUiStore";
import { useNav } from "./navigation";

export function useTrayActions(): void {
  const { go } = useNav();
  const { i18n } = useTranslation();
  const { checkForAppUpdate } = useSystemActions();
  const latest = useRef({ go, i18n, checkForAppUpdate });
  const checking = useRef(false);
  useEffect(() => {
    latest.current = { go, i18n, checkForAppUpdate };
  }, [go, i18n, checkForAppUpdate]);

  useEffect(
    () =>
      nativeShell.onTrayAction((action) => {
        if (action !== "checkForUpdates") return;
        const { go, i18n, checkForAppUpdate } = latest.current;
        go({ to: "settings", section: "about" });
        if (checking.current) return;
        checking.current = true;
        const { notify } = useUiStore.getState();
        checkForAppUpdate()
          .then((result) =>
            // `i18n.t` reads the language at answer time, like the About panel.
            notify(
              result.kind === "available"
                ? i18n.t("about.updateAvailable", { version: result.version })
                : i18n.t("about.youUpToDate"),
            ),
          )
          .catch(() => undefined)
          .finally(() => {
            checking.current = false;
          });
      }),
    [],
  );
}
