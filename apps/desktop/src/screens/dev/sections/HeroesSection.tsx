import { useState } from "react";
import { useTranslation } from "react-i18next";
import subHero from "@/assets/images/sub-hero.webp";
import { Button } from "@/components/Button";
import { FeaturedHero } from "@/components/FeaturedHero";
import { HomeHero } from "@/components/HomeHero";
import { PageBanner } from "@/components/PageBanner";
import { PromoCard } from "@/components/PromoCard";
import { Toggle } from "@/components/Toggle";
import { Specimen } from "./Gallery";
import { DesignFrame } from "./DesignFrame";
import { app, CATALOG, noop, useSample, WIDTH } from "./sampleData";
import styles from "./composites.module.css";

function useCarouselLabels(count: number) {
  const { t } = useTranslation();
  return {
    carouselLabel: t("common.featured"),
    previousLabel: t("common.previous"),
    nextLabel: t("common.next"),
    dotLabel: (i: number) => t("common.slideOf", { index: i + 1, total: count }),
  };
}

export function HeroesSection() {
  const { text } = useSample();
  const [hero, setHero] = useState(0);
  const [glow, setGlow] = useState(false);
  const [featured, setFeatured] = useState(0);
  const slides = CATALOG.heroSlides;
  const labels = useCarouselLabels(slides.length);
  const featuredLabels = useCarouselLabels(CATALOG.browseHeroes.length);
  const slide = slides[hero] ?? slides[0];
  const bh = CATALOG.browseHeroes[featured] ?? CATALOG.browseHeroes[0];
  const bhApp = bh ? app(bh.appId) : undefined;
  return (
    <>
      {slide && (
        <Specimen caption="HomeHero · prev/next + dots (click) · glow (toggle)" wide>
          <div className={styles.controls}>
            <Toggle checked={glow} onChange={setGlow} label="glow" size="sm" />
          </div>
          <DesignFrame width={WIDTH.content}>
            <HomeHero
              slide={{
                kicker: text(slide.kicker),
                title: [text(slide.title1), text(slide.title2)],
                body: text(slide.body),
                cta: text(slide.cta),
                quote: text(slide.quote),
              }}
              onCta={noop}
              count={slides.length}
              index={hero}
              onIndexChange={setHero}
              glow={glow}
              {...labels}
            />
          </DesignFrame>
        </Specimen>
      )}
      {bh && bhApp && (
        <Specimen
          caption="FeaturedHero (Browse) · radial ground on the app tint · dots (click)"
          wide
        >
          <DesignFrame width={WIDTH.browse}>
            <FeaturedHero
              app={{ name: bhApp.name, mono: bhApp.mono, tint: bhApp.tint, iconUrl: bhApp.iconUrl }}
              title={[text(bh.title1), text(bh.title2)]}
              body={text(bh.body)}
              note={text(bh.note)}
              onCta={noop}
              count={CATALOG.browseHeroes.length}
              index={featured}
              onIndexChange={setFeatured}
              carouselLabel={featuredLabels.carouselLabel}
              dotLabel={featuredLabels.dotLabel}
            />
          </DesignFrame>
        </Specimen>
      )}
      <BannersSpecimens />
      <PromoSpecimens />
    </>
  );
}

function BannersSpecimens() {
  const { t } = useTranslation();
  const { format } = useSample();
  return (
    <Specimen
      caption='PageBanner size="md" narrowMotto | "lg" (column actions) | "xl" (sub-hero photo) · bleed'
      wide
    >
      <DesignFrame width={WIDTH.content + 60}>
        <div className={styles.stack}>
          <div className={styles.screen}>
            <PageBanner
              title={t("nav.library")}
              subtitle={t("library.librarySub")}
              motto={t("common.mottoB")}
              narrowMotto
              actions={
                <Button variant="primaryOnImage" size="xl" leadingIcon="plus">
                  {t("library.installApp")}
                </Button>
              }
            />
          </div>
          <PageBanner
            title={t("nav.updates")}
            subtitle={t("updates.updatesSub")}
            motto={t("common.mottoB")}
            size="lg"
            actionsLayout="column"
            bleed={false}
            actions={
              <Button variant="primaryOnImage" size="xl" leadingIcon="download">
                {t("updates.updateAll")}
              </Button>
            }
          >
            <div className={styles.updatesLine}>
              <span>{t("updates.updatesAvailable", { count: 6 })}</span>
              <span className={styles.updatesSize}>{format.size(155)}</span>
            </div>
          </PageBanner>
          <PageBanner
            title={t("nav.subscription")}
            motto={t("common.mottoA")}
            size="xl"
            photo={subHero}
            bleed={false}
          >
            <div className={styles.lead}>{t("subscription.subLead")}</div>
            <p className={styles.leadBody}>{t("subscription.subBody")}</p>
            <div className={styles.bannerButtons}>
              <Button variant="primaryOnImage" size="lg">
                {t("subscription.getPro")}
              </Button>
              <Button variant="onImage" size="lg">
                {t("common.learnMore")}
              </Button>
            </div>
          </PageBanner>
        </div>
      </DesignFrame>
    </Specimen>
  );
}

function PromoSpecimens() {
  const { t } = useTranslation();
  return (
    <Specimen caption='PromoCard variant="updates" (340px aside) · "profile"' wide>
      <DesignFrame width={WIDTH.content}>
        <div className={styles.split} style={{ gridTemplateColumns: `340px ${WIDTH.profile}px` }}>
          <PromoCard
            variant="updates"
            title={t("updates.promoUpdTitle")}
            body={t("updates.promoUpdBody")}
          />
          <PromoCard
            variant="profile"
            title={t("profile.promoProfTitle")}
            body={t("profile.promoProfBody")}
          />
        </div>
      </DesignFrame>
    </Specimen>
  );
}
