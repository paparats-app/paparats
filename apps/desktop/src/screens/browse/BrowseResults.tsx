import { useId, useMemo } from "react";
import { useTranslation } from "react-i18next";
import { Icon } from "@/components/Icon";
import { browseFilter, sortApps, type BrowseFilters } from "@/domain/apps";
import { useChannelContext, useLocale, useVisibleApps } from "@/hooks";
import { useCatalog } from "@/queries";
import { StoreAppCard } from "@/screens/shared";
import { useBrowseStore } from "@/stores/useBrowseStore";
import styles from "./BrowseScreen.module.css";

/** Result mode: "N apps" + "Clear all", then one 5-column grid (prototype lines 349–367). */
export function BrowseResults({ filters }: { filters: BrowseFilters }) {
  const { t } = useTranslation();
  const locale = useLocale();
  const apps = useVisibleApps();
  const ctx = useChannelContext();
  const collections = useCatalog().data?.collections;
  const clearAll = useBrowseStore((s) => s.clearAll);
  const countId = useId();

  const list = useMemo(
    () => sortApps(browseFilter(apps, filters, ctx, collections), filters.sort, locale),
    [apps, filters, ctx, collections, locale],
  );

  return (
    <>
      <div className={styles.resultsHeader}>
        <div id={countId} className={styles.count} role="status">
          {t("common.appsCount", { count: list.length })}
        </div>
        <button type="button" className={styles.clear} onClick={clearAll}>
          <Icon name="x" size={14} strokeWidth={2.2} />
          {t("browse.clearAll")}
        </button>
      </div>
      <ul className={styles.cards} aria-labelledby={countId}>
        {list.map((app) => (
          <li key={app.id} className={styles.item} data-app-id={app.id}>
            <StoreAppCard app={app} />
          </li>
        ))}
      </ul>
    </>
  );
}
