import { useMemo } from "react";
import { useTranslation } from "react-i18next";
import { useNav } from "@/app/navigation";
import { CATEGORY_PHOTOS, CategoryCard } from "@/components/CategoryCard";
import { PageBanner } from "@/components/PageBanner";
import { SectionHeader } from "@/components/SectionHeader";
import { useVisibleApps } from "@/hooks";
import { useCatalog } from "@/queries";
import { StoreAppCard } from "@/screens/shared";
import type { Category, CategoryId } from "@/services/types";
import styles from "./CategoriesScreen.module.css";

/** The category featured under the tiles (prototype: "Featured in Productivity"). */
const FEATURED_CATEGORY: CategoryId = "productivity";
const NO_CATEGORIES: Category[] = [];

/**
 * Categories (prototype lines 413–450; logic `// categories`): banner, nine photographic tiles
 * that open Browse filtered to the category, the apps featured in Productivity and the closing
 * brand line.
 */
export function CategoriesScreen() {
  const { t } = useTranslation();
  const { go } = useNav();
  const categories = useCatalog().data?.categories ?? NO_CATEGORIES;
  const apps = useVisibleApps();
  const featured = useMemo(() => apps.filter((app) => app.category === FEATURED_CATEGORY), [apps]);
  const browse = (id: CategoryId) => go({ to: "browse", filters: { categories: [id] } });

  return (
    <div className={styles.screen}>
      <PageBanner
        title={t("nav.categories")}
        subtitle={t("categories.categoriesSub")}
        motto={t("common.mottoB")}
      />
      <div className={styles.tiles}>
        {categories.map((category) => (
          <CategoryCard
            key={category.id}
            label={t(`categories.items.${category.id}.label`)}
            description={t(`categories.items.${category.id}.desc`)}
            countLabel={t("common.appsCount", { count: category.catalogCount })}
            icon={category.icon}
            photo={CATEGORY_PHOTOS[category.id]}
            onClick={() => browse(category.id)}
          />
        ))}
      </div>
      <SectionHeader
        className={styles.featuredHeader}
        title={t("categories.featuredIn", {
          category: t(`categories.items.${FEATURED_CATEGORY}.label`),
        })}
        actionLabel={t("common.seeAll")}
        onAction={() => browse(FEATURED_CATEGORY)}
      />
      <div className={styles.apps}>
        {featured.map((app) => (
          <StoreAppCard key={app.id} app={app} chips={false} />
        ))}
      </div>
      <footer className={styles.brand}>
        <p className={styles.quote}>
          {t("common.q1")}
          {t("common.mottoA")}
          {t("common.q2")}
        </p>
        <p className={styles.signature}>{t("categories.signature")}</p>
      </footer>
    </div>
  );
}
