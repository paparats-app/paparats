import { useCallback } from "react";
import { useTranslation } from "react-i18next";
import { useServices } from "@/services";
import { useSettingsStore } from "@/stores/useSettingsStore";
import { useUiStore } from "@/stores/useUiStore";
import { useOffline } from "./useOffline";

export interface Connectivity {
  /** Real connectivity is down, or the "Simulate offline" developer tool is on (`useOffline`). */
  offline: boolean;
  /**
   * The offline banner's Retry (prototype lines 126–133): ends a simulated outage (Settings ›
   * Advanced › Simulate offline); a real one is re-checked and, when the network is still down,
   * answered with the offline toast. "Back online" is the providers' toast, not this action's.
   */
  retry: () => void;
}

/** Offline state plus the Retry action, for the shell's offline banner. */
export function useConnectivity(): Connectivity {
  const { t } = useTranslation();
  const { system } = useServices();
  const offline = useOffline();
  const retry = useCallback(() => {
    const { settings, update } = useSettingsStore.getState();
    if (settings.simulateOffline) void update({ simulateOffline: false });
    if (!system.isOnline()) useUiStore.getState().notify(t("common.offline"));
  }, [system, t]);
  return { offline, retry };
}
