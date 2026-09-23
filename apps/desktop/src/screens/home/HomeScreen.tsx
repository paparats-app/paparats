// Home — the discovery dashboard: hero carousel, Featured apps, Collections, New and notable,
// Recently updated (Paparats Prototype.dc.html lines 200–279, `renderVals` "// home").
import { useId, useMemo } from "react";
import { useTranslation } from "react-i18next";
import { useNav, type NavTarget } from "@/app/navigation";
import { CollectionCard } from "@/components/CollectionCard";
import { HomeHero } from "@/components/HomeHero";
import { NotableCard } from "@/components/AppListItem";
import { SectionHeader } from "@/components/SectionHeader";
import { pickByIds, sortApps } from "@/domain/apps";
import { pickText } from "@/domain/text";
import { useChannelContext, useLocale, useVisibleApps } from "@/hooks";
import { useCatalog, useLibrary } from "@/queries";
import { StoreAppCard } from "@/screens/shared";
import type { HeroTarget, Localized } from "@/services/types";
import { useHomeStore } from "@/stores/useHomeStore";
import { RecentlyUpdatedRow } from "./HomeCards";
import styles from "./HomeScreen.module.css";

/** Number of apps under "Recently updated" (two rows of three). */
const RECENT_COUNT = 6;

/** Where each hero slide's call to action leads; Browse opens unfiltered, like the sidebar. */
const HERO_TARGETS: Readonly<Record<HeroTarget, NavTarget>> = {
  browse: { to: "browse", filters: {} },
  library: { to: "library" },
  categories: { to: "categories" },
  subscription: { to: "subscription" },
};

/** "See all" under Home opens Browse with every filter reset (the prototype's sidebar item). */
const BROWSE_ALL: NavTarget = { to: "browse", filters: {} };

export function HomeScreen() {
  const { t } = useTranslation();
  const locale = useLocale();
  const text = (value: Localized<string>) => pickText(value, locale);
  const { go } = useNav();
  const catalog = useCatalog().data;
  const library = useLibrary().data;
  const { ready: channelsReady } = useChannelContext();
  const visible = useVisibleApps();
  const heroIndex = useHomeStore((s) => s.heroIndex);
  const heroGlow = useHomeStore((s) => s.heroGlow);
  const setHeroIndex = useHomeStore((s) => s.setHeroIndex);
  const ids = {
    featured: useId(),
    collections: useId(),
    notable: useId(),
    recent: useId(),
  };

  // Hidden apps are skipped (the prototype's `byIds`).
  const lists = useMemo(
    () => ({
      featured: pickByIds(visible, catalog?.featured ?? []),
      notable: pickByIds(visible, catalog?.notable ?? []),
      recent: sortApps(visible, "newest").slice(0, RECENT_COUNT),
    }),
    [catalog, visible],
  );

  // Wait for everything the cards depend on, so no card flashes a wrong action or disappears.
  if (!catalog || !library || !channelsReady) return null;

  const slides = catalog.heroSlides;
  const index = slides.length > 0 ? heroIndex % slides.length : 0;
  const slide = slides[index];

  return (
    <div>
      {slide && (
        <HomeHero
          slide={{
            kicker: text(slide.kicker),
            title: [text(slide.title1), text(slide.title2)],
            body: text(slide.body),
            cta: text(slide.cta),
            quote: text(slide.quote),
          }}
          onCta={() => go(HERO_TARGETS[slide.target])}
          count={slides.length}
          index={index}
          onIndexChange={setHeroIndex}
          carouselLabel={t("home.heroLabel")}
          previousLabel={t("home.previousSlide")}
          nextLabel={t("home.nextSlide")}
          dotLabel={(i) => t("common.slideOf", { index: i + 1, total: slides.length })}
          glow={heroGlow}
        />
      )}

      <section aria-labelledby={ids.featured}>
        <SectionHeader
          id={ids.featured}
          title={t("common.featured")}
          actionLabel={t("common.seeAll")}
          onAction={() => go(BROWSE_ALL)}
          className={styles.header}
        />
        <div className={styles.featured}>
          {lists.featured.map((app) => (
            <StoreAppCard key={app.id} app={app} />
          ))}
        </div>
      </section>

      <section aria-labelledby={ids.collections}>
        <SectionHeader
          id={ids.collections}
          title={t("common.collections")}
          actionLabel={t("common.seeAll")}
          onAction={() => go({ to: "categories" })}
          className={styles.header}
        />
        <div className={styles.quarters}>
          {catalog.collections.map((collection) => (
            <CollectionCard
              key={collection.id}
              icon={collection.icon}
              title={text(collection.title)}
              subtitle={text(collection.sub)}
              onClick={() => go({ to: "browse", filters: { collection: collection.id } })}
            />
          ))}
        </div>
      </section>

      <section aria-labelledby={ids.notable}>
        <SectionHeader
          id={ids.notable}
          title={t("common.newNotable")}
          actionLabel={t("common.seeAll")}
          onAction={() => go(BROWSE_ALL)}
          className={styles.header}
        />
        <div className={styles.quarters}>
          {lists.notable.map((app) => (
            <NotableCard
              key={app.id}
              name={app.name}
              icon={{ mono: app.mono, tint: app.tint, iconUrl: app.iconUrl }}
              tagline={text(app.tagline)}
              onOpen={() => go({ to: "app", appId: app.id })}
            />
          ))}
        </div>
      </section>

      <section aria-labelledby={ids.recent}>
        <SectionHeader
          id={ids.recent}
          title={t("home.recentlyUpdated")}
          actionLabel={t("common.seeAll")}
          onAction={() => go(BROWSE_ALL)}
          className={styles.header}
        />
        <div className={styles.thirds}>
          {lists.recent.map((app) => (
            <RecentlyUpdatedRow key={app.id} app={app} />
          ))}
        </div>
      </section>
    </div>
  );
}
