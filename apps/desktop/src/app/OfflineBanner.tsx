import { useTranslation } from "react-i18next";
import { Button } from "@/components/Button";
import { Icon } from "@/components/Icon";
import { useConnectivity } from "@/hooks/useConnectivity";
import styles from "./OfflineBanner.module.css";

/**
 * Offline banner under the top bar (prototype lines 126–133). Retry ends a simulated outage
 * (Settings › Advanced › Simulate offline); a real one is re-checked and, when the network is
 * still down, answered with the offline toast (`hooks/useConnectivity`). The "Back online" toast
 * comes from the providers.
 */
export function OfflineBanner() {
  const { t } = useTranslation();
  const { offline, retry } = useConnectivity();
  if (!offline) return null;

  return (
    <div className={styles.banner} role="status">
      <Icon name="wifi-off" size={18} strokeWidth={2} className={styles.icon} />
      <div className={styles.text}>
        <span className={styles.title}>{t("common.offline")}</span>{" "}
        <span className={styles.hint}>{t("shell.offlineHint")}</span>
      </div>
      <Button size="xs" variant="secondary" className={styles.retry} onClick={retry}>
        {t("shell.retry")}
      </Button>
    </div>
  );
}
