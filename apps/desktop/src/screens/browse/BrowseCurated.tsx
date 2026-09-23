import { useMemo } from "react";
import { useTranslation } from "react-i18next";
import { CategoryChip } from "@/components/CategoryCard";
import { FeaturedHero } from "@/components/FeaturedHero";
import { SectionHeader } from "@/components/SectionHeader";
import { useNav } from "@/app/navigation";
import { pickByIds } from "@/domain/apps";
import { pickLocalized } from "@/domain/text";
import { useAppAction, useLocale, useVisibleApps } from "@/hooks";
import { useCatalog } from "@/queries";
import { StoreAppCard } from "@/screens/shared";
import type { App, BrowseHero, Catalog } from "@/services/types";
import { useBrowseStore } from "@/stores/useBrowseStore";
import { BrowseNotableRow } from "./BrowseNotableRow";
import styles from "./BrowseScreen.module.css";

/** Browse's curated view: featured-app hero, Featured apps, New and notable, Top categories. */
export function BrowseCurated() {
  const { t } = useTranslation();
  const nav = useNav();
  const catalog = useCatalog().data;
  const apps = useVisibleApps();

  const featured = useMemo(
    () => pickByIds(apps, catalog?.featured ?? []).slice(0, 5),
    [apps, catalog],
  );
  const notable = useMemo(() => pickByIds(apps, catalog?.notable ?? []), [apps, catalog]);

  return (
    <>
      {catalog && <HeroCarousel catalog={catalog} apps={apps} />}

      <SectionHeader
        size="md"
        title={t("common.featured")}
        actionLabel={t("common.seeAll")}
        onAction={() => nav.go({ to: "browse", filters: { sort: "name" } })}
        className={styles.sectionHeader}
      />
      <ul className={styles.cards} aria-label={t("common.featured")}>
        {featured.map((app) => (
          <li key={app.id} className={styles.item}>
            <StoreAppCard app={app} />
          </li>
        ))}
      </ul>

      <SectionHeader
        size="md"
        title={t("common.newNotable")}
        actionLabel={t("common.seeAll")}
        onAction={() => nav.go({ to: "browse", filters: { sort: "newest" } })}
        className={styles.sectionHeader}
      />
      <ul className={styles.notable} aria-label={t("common.newNotable")}>
        {notable.map((app) => (
          <li key={app.id} className={styles.item}>
            <BrowseNotableRow app={app} />
          </li>
        ))}
      </ul>

      <SectionHeader size="md" title={t("browse.topCategories")} className={styles.sectionHeader} />
      {catalog && <TopCategories catalog={catalog} apps={apps} />}
    </>
  );
}

interface Slide {
  hero: BrowseHero;
  app: App;
}

/** The featured-app carousel over `catalog.browseHeroes` whose apps are visible. */
function HeroCarousel({ catalog, apps }: { catalog: Catalog; apps: readonly App[] }) {
  const { t } = useTranslation();
  const heroIndex = useBrowseStore((s) => s.heroIndex);
  const setHeroIndex = useBrowseStore((s) => s.setHeroIndex);
  const slides = useMemo(
    () =>
      catalog.browseHeroes.flatMap((hero): Slide[] => {
        const app = apps.find((a) => a.id === hero.appId);
        return app ? [{ hero, app }] : [];
      }),
    [catalog, apps],
  );
  const index = Math.min(heroIndex, slides.length - 1);
  const slide = slides[index];
  if (!slide) return null;
  return (
    <HeroSlide
      slide={slide}
      count={slides.length}
      index={index}
      onIndexChange={setHeroIndex}
      dotLabel={(i) => t("common.slideOf", { index: i + 1, total: slides.length })}
    />
  );
}

interface HeroSlideProps {
  slide: Slide;
  count: number;
  index: number;
  onIndexChange: (index: number) => void;
  dotLabel: (index: number) => string;
}

/**
 * One slide. "Get <App>" runs the app's action (download, subscribe, or the offline notice);
 * while the app is installed or in the download queue it opens the app page instead, as the
 * prototype's CTA always did.
 */
function HeroSlide({ slide, count, index, onIndexChange, dotLabel }: HeroSlideProps) {
  const { t } = useTranslation();
  const nav = useNav();
  const locale = useLocale();
  const { hero, app } = slide;
  const action = useAppAction(app);
  const gettable = action.state === "none";
  return (
    <FeaturedHero
      app={{ name: app.name, mono: app.mono, tint: app.tint, iconUrl: app.iconUrl }}
      title={[pickLocalized(hero.title1, locale), pickLocalized(hero.title2, locale)]}
      body={pickLocalized(hero.body, locale)}
      note={pickLocalized(hero.note, locale)}
      onCta={() => (gettable ? action.run() : nav.go({ to: "app", appId: app.id }))}
      count={count}
      index={index}
      onIndexChange={onIndexChange}
      carouselLabel={t("browse.featuredKicker")}
      dotLabel={dotLabel}
    />
  );
}

/** The first six categories as compact chips; a chip applies its category filter. */
function TopCategories({ catalog, apps }: { catalog: Catalog; apps: readonly App[] }) {
  const { t } = useTranslation();
  const apply = useBrowseStore((s) => s.apply);
  return (
    <ul className={styles.categories} aria-label={t("browse.topCategories")}>
      {catalog.categories.slice(0, 6).map((category) => {
        const count =
          category.catalogCount || apps.filter((app) => app.category === category.id).length;
        return (
          <li key={category.id} className={styles.item}>
            <CategoryChip
              label={t(`categories.items.${category.id}.label`)}
              countLabel={t("common.appsCount", { count })}
              icon={category.icon}
              onClick={() => apply({ categories: [category.id] })}
            />
          </li>
        );
      })}
    </ul>
  );
}
