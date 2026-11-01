import { useId, useMemo } from "react";
import { useTranslation } from "react-i18next";
import { useNav } from "@/app/navigation";
import { AppIcon } from "@/components/AppIcon";
import { Icon } from "@/components/Icon";
import { PromoCard } from "@/components/PromoCard";
import { Toggle } from "@/components/Toggle";
import { useVisibleApps } from "@/hooks";
import { useFormat } from "@/i18n/format";
import { useAccount } from "@/queries";
import type { App } from "@/services/types";
import { useSettingsStore } from "@/stores/useSettingsStore";
import { useUpdatesStore } from "@/stores/useUpdatesStore";
import styles from "./UpdatesScreen.module.css";

interface HistoryEntry {
  key: string;
  app: App;
  version: string;
  when: string;
}

/**
 * The Updates side column (prototype lines 505–542): Automatic updates, Update settings
 * (→ Settings › Updates), Update history (expands into the past updates) and the promo card.
 */
export function UpdatesAside() {
  const { t } = useTranslation();
  const { go } = useNav();
  const ids = { auto: useId(), autoHint: useId(), history: useId() };
  const auto = useSettingsStore((s) => s.settings.auto);
  // Automatic updates are stored but not acted on yet: Developer mode only, as in Settings (D68).
  const dev = useSettingsStore((s) => s.settings.dev);
  const update = useSettingsStore((s) => s.update);
  const historyOpen = useUpdatesStore((s) => s.historyOpen);
  const toggleHistory = useUpdatesStore((s) => s.toggleHistory);

  return (
    <aside className={styles.aside}>
      {dev && (
        <div className={styles.sideCard}>
          <Icon name="refresh-cw" size={22} className={styles.sideIcon} />
          <div className={styles.sideText}>
            <div id={ids.auto} className={styles.sideTitle}>
              {t("updates.autoUpdates")}
            </div>
            <div id={ids.autoHint} className={styles.sideHint}>
              {t("updates.autoUpdatesHint")}
            </div>
          </div>
          <Toggle
            checked={auto}
            onChange={(checked) => void update({ auto: checked })}
            aria-labelledby={ids.auto}
            aria-describedby={ids.autoHint}
          />
        </div>
      )}

      <button
        type="button"
        className={`${styles.sideCard} ${styles.sideLink}`}
        onClick={() => go({ to: "settings", section: "updates" })}
      >
        <Icon name="settings" size={22} className={styles.sideIcon} />
        <span className={styles.sideText}>
          <span className={styles.sideTitle}>{t("updates.updateSettings")}</span>
          <span className={styles.sideHint}>{t("updates.updateSettingsHint")}</span>
        </span>
        <Icon name="chevron-right" size={16} strokeWidth={2} className={styles.sideChevron} />
      </button>

      <div className={styles.historyCard}>
        <button
          type="button"
          className={styles.historyHead}
          aria-expanded={historyOpen}
          aria-controls={historyOpen ? ids.history : undefined}
          onClick={toggleHistory}
        >
          <Icon name="history" size={22} className={styles.sideIcon} />
          <span className={styles.sideText}>
            <span className={styles.sideTitle}>{t("updates.updateHistory")}</span>
            <span className={styles.sideHint}>{t("updates.updateHistoryHint")}</span>
          </span>
          <Icon name="chevron-right" size={16} strokeWidth={2} className={styles.sideChevron} />
        </button>
        {historyOpen && <UpdateHistory id={ids.history} />}
      </div>

      <PromoCard
        variant="updates"
        title={t("updates.promoUpdTitle")}
        body={t("updates.promoUpdBody")}
      />
    </aside>
  );
}

/** Past updates from the account activity, newest first (the prototype's `history`). */
function UpdateHistory({ id }: { id: string }) {
  const { t } = useTranslation();
  const format = useFormat();
  const activity = useAccount().data?.activity;
  const apps = useVisibleApps();

  const entries = useMemo(() => {
    const byId = new Map(apps.map((app) => [app.id, app]));
    const list: HistoryEntry[] = [];
    (activity ?? []).forEach((entry, index) => {
      const app = entry.kind === "updated" ? byId.get(entry.appId) : undefined;
      if (!app) return;
      list.push({
        key: `${index}:${entry.appId}:${entry.version}`,
        app,
        version: entry.version,
        when: format.relative(entry.date),
      });
    });
    return list;
  }, [activity, apps, format]);

  return (
    <ul id={id} className={styles.historyList} aria-label={t("updates.updateHistory")}>
      {entries.map(({ key, app, version, when }) => (
        <li key={key} className={styles.historyItem}>
          <AppIcon mono={app.mono} tint={app.tint} iconUrl={app.iconUrl} size={28} />
          <div className={styles.historyName}>
            <span className={styles.historyApp}>{app.name}</span>{" "}
            <span className={styles.historyVersion}>{version}</span>
          </div>
          <div className={styles.historyWhen}>{when}</div>
        </li>
      ))}
    </ul>
  );
}
