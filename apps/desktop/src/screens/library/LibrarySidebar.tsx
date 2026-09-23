import { useId } from "react";
import { useTranslation } from "react-i18next";
import { CountPill } from "@/components/CountPill";
import { Icon, type IconName } from "@/components/Icon";
import { StatTile } from "@/components/StatTile";
import type { LibraryFilter } from "@/domain/apps";
import { pickText } from "@/domain/text";
import { useLocale } from "@/hooks";
import { useFormat } from "@/i18n/format";
import { useLibraryStore } from "@/stores/useLibraryStore";
import type { LibraryModel } from "./useLibraryModel";
import styles from "./LibrarySidebar.module.css";

/** Quick filters in the prototype's order, with its glyphs (`quickFilters`, line 1970). */
const QUICK_FILTERS: ReadonlyArray<{ id: LibraryFilter; icon: IconName }> = [
  { id: "all", icon: "layout-grid" },
  { id: "updates", icon: "download" },
  { id: "downloads", icon: "download" },
  { id: "favorites", icon: "star" },
];

/**
 * The Library's right column (prototype lines 645–670): stats, the collections list, quick
 * filters (they switch to the Installed tab) and the closing quote.
 */
export function LibrarySidebar({ model }: { model: LibraryModel }) {
  const { t } = useTranslation();
  const format = useFormat();
  const locale = useLocale();
  const ids = { stats: useId(), collections: useId(), filters: useId() };
  const tab = useLibraryStore((s) => s.tab);
  const filter = useLibraryStore((s) => s.filter);
  const openId = useLibraryStore((s) => s.collection);
  const openCollection = useLibraryStore((s) => s.openCollection);
  const setFilter = useLibraryStore((s) => s.setFilter);

  const filterLabels: Record<LibraryFilter, string> = {
    all: t("common.all"),
    updates: t("library.updatesAvailableShort"),
    downloads: t("library.downloads"),
    favorites: t("library.favorites"),
  };

  return (
    <aside className={styles.aside}>
      <section className={`${styles.panel} ${styles.stats}`} aria-labelledby={ids.stats}>
        <h2 id={ids.stats} className={`${styles.title} ${styles.statsTitle}`}>
          {t("library.libraryStats")}
        </h2>
        <div className={styles.statList}>
          <StatTile
            icon="layout-grid"
            value={format.number(model.counts.installed)}
            label={t("library.installedApps")}
            tight
          />
          <StatTile
            icon="heart"
            value={format.number(model.counts.favorites)}
            label={t("library.favorites")}
            tight
          />
          <StatTile
            icon="folder"
            value={format.number(model.counts.collections)}
            label={t("common.collections")}
            tight
          />
          <StatTile
            icon="hard-drive"
            value={format.sizeGb(model.totalMb)}
            label={t("library.totalSize")}
            tight
          />
        </div>
      </section>

      <section className={`${styles.panel} ${styles.list}`} aria-labelledby={ids.collections}>
        <div className={styles.listHeader}>
          <h2 id={ids.collections} className={styles.title}>
            {t("common.collections")}
          </h2>
          {/* Creating collections is not designed yet: + and "New collection" do nothing, as in
              the prototype (they keep its hover states). */}
          <button type="button" className={styles.add} aria-label={t("library.newCollection")}>
            <Icon name="plus" size={16} strokeWidth={2} />
          </button>
        </div>
        {model.collections.map((collection) => {
          const active = tab === "collections" && openId === collection.id;
          return (
            <button
              key={collection.id}
              type="button"
              className={styles.item}
              aria-current={active || undefined}
              onClick={() => openCollection(collection.id)}
            >
              <Icon name={collection.icon} size={16} className={styles.itemIcon} />
              <span className={styles.itemLabel}>{pickText(collection.label, locale)}</span>
              <span className={styles.itemCount}>
                {format.number(model.collectionCount(collection))}
              </span>
            </button>
          );
        })}
        <button type="button" className={`${styles.item} ${styles.newItem}`}>
          <Icon name="plus" size={16} strokeWidth={2} />
          <span className={styles.itemLabel}>{t("library.newCollection")}</span>
        </button>
      </section>

      <section className={`${styles.panel} ${styles.list}`} aria-labelledby={ids.filters}>
        <h2 id={ids.filters} className={`${styles.title} ${styles.listTitle}`}>
          {t("library.quickFilters")}
        </h2>
        {QUICK_FILTERS.map(({ id, icon }) => (
          <button
            key={id}
            type="button"
            className={styles.item}
            aria-pressed={tab === "installed" && filter === id}
            onClick={() => setFilter(id)}
          >
            <Icon name={icon} size={16} className={styles.itemIcon} />
            <span className={styles.itemLabel}>{filterLabels[id]}</span>
            <CountPill value={format.number(model.counts.filters[id])} tone="neutral" />
          </button>
        ))}
      </section>

      <figure className={`${styles.panel} ${styles.quote}`}>
        <blockquote className={styles.quoteText}>
          {t("common.q1")}
          {t("library.quoteLibrary")}
          {t("common.q2")}
        </blockquote>
        <figcaption className={styles.signature}>{t("library.signature")}</figcaption>
      </figure>
    </aside>
  );
}
