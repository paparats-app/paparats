import { useState } from "react";
import { useTranslation } from "react-i18next";
import { Button, IconButton, type ButtonSize, type ButtonVariant } from "@/components/Button";
import { SplitButton } from "@/components/SplitButton";
import { OnImage, Specimen, SpecimenGrid } from "./Gallery";
import styles from "./sections.module.css";

const VARIANTS: ButtonVariant[] = [
  "primary",
  "secondary",
  "ghost",
  "outline",
  "destructive",
  "link",
];
const SIZES: ButtonSize[] = ["xs", "compact", "sm", "md", "field", "lg", "xl"];

export function ButtonsSection() {
  const { t } = useTranslation();
  const [loading, setLoading] = useState(false);
  return (
    <>
      <SpecimenGrid>
        {VARIANTS.map((variant) => (
          <Specimen key={variant} caption={`variant="${variant}"`}>
            <Button variant={variant}>{t("common.open")}</Button>
            <Button variant={variant} disabled>
              {t("common.open")}
            </Button>
          </Specimen>
        ))}
      </SpecimenGrid>

      <Specimen caption={`size=${SIZES.join(" | ")}`} wide>
        <div className={styles.row}>
          {SIZES.map((size) => (
            <Button
              key={size}
              size={size}
              variant={size === "lg" || size === "xl" ? "primary" : "secondary"}
            >
              {t("common.get")}
            </Button>
          ))}
        </div>
      </Specimen>

      <SpecimenGrid>
        <Specimen caption="leadingIcon · trailingIcon">
          <Button variant="primary" size="xl" leadingIcon="download">
            {t("updates.updateAll")}
          </Button>
          <Button variant="ghost" size="sm" trailingIcon="arrow-right">
            {t("common.seeAll")}
          </Button>
          <Button variant="outline" size="field" leadingIcon="copy">
            {t("channel.copyAddr")}
          </Button>
        </Specimen>
        <Specimen caption="loading (click)">
          <Button
            variant="primary"
            size="lg"
            loading={loading}
            onClick={() => setLoading(true)}
            onBlur={() => setLoading(false)}
          >
            {t("channel.syncNow")}
          </Button>
        </Specimen>
        <Specimen caption='tone="progress" | "quiet" | "muted"'>
          <Button size="compact" tone="progress">
            {t("common.downloading")}
          </Button>
          <Button size="compact" tone="quiet">
            {t("common.queued")}
          </Button>
          <Button size="compact" tone="muted">
            {t("common.unavailableOffline")}
          </Button>
        </Specimen>
        <Specimen caption="fullWidth" wide>
          <Button variant="primary" fullWidth>
            {t("subscription.upgrade")}
          </Button>
        </Specimen>
      </SpecimenGrid>

      <Specimen caption='variant="onImage" | "primaryOnImage" (pill) — banners, heroes' wide>
        <OnImage>
          <Button variant="primaryOnImage" size="lg" pill trailingIcon="arrow-right">
            {t("browse.sortFeatured")}
          </Button>
          <Button variant="primaryOnImage" size="xl" leadingIcon="lightbulb">
            {t("ideas.suggestIdea")}
          </Button>
          <Button variant="onImage" size="lg">
            {t("common.learnMore")}
          </Button>
          <Button variant="onImage" size="lg" disabled>
            {t("common.learnMore")}
          </Button>
        </OnImage>
      </Specimen>

      <SpecimenGrid>
        <Specimen caption="IconButton (ghost · secondary · round · 36×34)">
          <IconButton icon="x" label={t("common.close")} />
          <IconButton icon="ellipsis" label={t("common.moreActions")} />
          <IconButton icon="heart" label={t("common.addFavorite")} variant="secondary" />
          <IconButton
            icon="plus"
            label={t("sources.addChannel")}
            variant="primary"
            size="md"
            round
          />
          <IconButton
            icon="chevron-down"
            label={t("common.details")}
            size="sm"
            className={styles.expand}
          />
          <IconButton icon="x" label={t("common.close")} disabled />
        </Specimen>
      </SpecimenGrid>

      <SpecimenGrid>
        <Specimen
          caption='SplitButton tone="neutral" | "primary" | "progress" | "quiet" | "muted"'
          wide
        >
          <div className={styles.splitGrid}>
            <SplitButton label={t("common.get")} secondaryLabel={t("common.details")} />
            <SplitButton
              label={t("common.update")}
              tone="primary"
              secondaryLabel={t("common.details")}
            />
            <SplitButton
              label={t("common.downloading")}
              tone="progress"
              secondaryLabel={t("common.details")}
            />
            <SplitButton
              label={t("common.queued")}
              tone="quiet"
              secondaryLabel={t("common.details")}
            />
            <SplitButton
              label={t("common.unavailableOffline")}
              tone="muted"
              disabled
              secondaryLabel={t("common.details")}
            />
          </div>
        </Specimen>
        <Specimen caption='SplitButton size="lg" secondaryIcon="heart" secondaryPressed' wide>
          <div className={styles.narrow}>
            <SplitButton
              size="lg"
              label={t("common.open")}
              secondaryIcon="heart"
              secondaryLabel={t("common.removeFavorite")}
              secondaryPressed
            />
          </div>
        </Specimen>
      </SpecimenGrid>
    </>
  );
}
