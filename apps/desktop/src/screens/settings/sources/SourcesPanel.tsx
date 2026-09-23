import { useId } from "react";
import { useTranslation } from "react-i18next";
import styles from "./SourcesPanel.module.css";

/**
 * Settings › Sources — placeholder until M5 (prototype lines 823–865): the panel's title and
 * subtitle only. The followed channels, Add channel and the stale callouts land with M5.
 */
export function SourcesPanel() {
  const { t } = useTranslation();
  const titleId = useId();
  return (
    <section aria-labelledby={titleId} data-testid="sources-panel">
      <h2 id={titleId} className={styles.title}>
        {t("sources.sources")}
      </h2>
      <div className={styles.subtitle}>{t("sources.sourcesSub")}</div>
    </section>
  );
}
