import { useTranslation } from "react-i18next";
import { useShallow } from "zustand/react/shallow";
import { PageBanner } from "@/components/PageBanner";
import { browseFiltersActive } from "@/domain/apps";
import { pickLocalized } from "@/domain/text";
import { useLocale } from "@/hooks";
import { useCatalog } from "@/queries";
import { selectBrowseFilters, useBrowseStore } from "@/stores/useBrowseStore";
import { BrowseCurated } from "./BrowseCurated";
import { BrowseFilterPanel } from "./BrowseFilterPanel";
import { BrowseResults } from "./BrowseResults";
import styles from "./BrowseScreen.module.css";

/**
 * Browse (prototype lines 280–412): the page banner (or the open collection's title), then the
 * content column — the curated view, or the results of any active filter or collection — beside
 * the sticky filter panel.
 */
export function BrowseScreen() {
  const { t } = useTranslation();
  const locale = useLocale();
  const catalog = useCatalog().data;
  const filters = useBrowseStore(useShallow(selectBrowseFilters));
  const collection = filters.collection
    ? catalog?.collections.find((c) => c.id === filters.collection)
    : undefined;
  // An unknown collection id falls back to the curated view once the catalog has loaded.
  const collectionOpen = filters.collection !== null && (!catalog || collection !== undefined);
  const results = browseFiltersActive(filters) || collectionOpen;

  return (
    <>
      <PageBanner
        title={collection ? pickLocalized(collection.title, locale) : t("nav.browse")}
        subtitle={collection ? pickLocalized(collection.sub, locale) : t("browse.browseSub")}
        motto={t("common.mottoA")}
      />
      <div className={styles.layout}>
        <div className={styles.main}>
          {results ? <BrowseResults filters={filters} /> : <BrowseCurated />}
        </div>
        <BrowseFilterPanel />
      </div>
    </>
  );
}
