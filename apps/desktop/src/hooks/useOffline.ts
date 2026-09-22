import { useCallback, useSyncExternalStore } from "react";
import { useServices } from "@/services";
import { useSettingsStore } from "@/stores/useSettingsStore";

/** Real connectivity is down, or the "Simulate offline" developer tool is on. */
export function useOffline(): boolean {
  const { system } = useServices();
  const subscribe = useCallback(
    (onChange: () => void) => system.onConnectivityChange(() => onChange()),
    [system],
  );
  const online = useSyncExternalStore(
    subscribe,
    () => system.isOnline(),
    () => true,
  );
  const simulated = useSettingsStore((s) => s.settings.simulateOffline);
  return !online || simulated;
}
