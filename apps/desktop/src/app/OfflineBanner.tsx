import { useTranslation } from "react-i18next";
import { Button } from "@/components/Button";
import { Icon } from "@/components/Icon";
import { useOffline } from "@/hooks/useOffline";
import { useServices } from "@/services";
import { useSettingsStore } from "@/stores/useSettingsStore";
import { useUiStore } from "@/stores/useUiStore";
import styles from "./OfflineBanner.module.css";

/**
 * Offline banner under the top bar (prototype lines 126–133). Retry ends a simulated outage
 * (Settings › Advanced › Simulate offline); a real one is re-checked and, when the network is
 * still down, answered with the offline toast. The "Back online" toast comes from the providers.
 */
export function OfflineBanner() {
  const { t } = useTranslation();
  const { system } = useServices();
  const offline = useOffline();
  if (!offline) return null;

  const retry = () => {
    const { settings, update } = useSettingsStore.getState();
    if (settings.simulateOffline) void update({ simulateOffline: false });
    if (!system.isOnline()) useUiStore.getState().notify(t("common.offline"));
  };

  return (
    <div className={styles.banner} role="status">
      <Icon name="wifi-off" size={18} strokeWidth={2} className={styles.icon} />
      <div className={styles.text}>
        <span className={styles.title}>{t("common.offline")}</span>{" "}
        <span className={styles.hint}>{t("shell.offlineHint")}</span>
      </div>
      <Button size="xs" variant="secondary" onClick={retry}>
        {t("shell.retry")}
      </Button>
    </div>
  );
}
