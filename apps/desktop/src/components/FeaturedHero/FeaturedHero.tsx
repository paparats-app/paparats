import type { CSSProperties } from "react";
import { useTranslation } from "react-i18next";
import type { AppIconSource } from "../AppCard";
import { AppIcon } from "../AppIcon";
import { Button } from "../Button";
import { CarouselDots } from "../CarouselDots";
import { Icon } from "../Icon";
import { cx } from "../internal/cx";
import styles from "./FeaturedHero.module.css";

export interface FeaturedHeroProps {
  /** The featured app: name (for "Get <App>"), tile and the tint of the radial ground. */
  app: AppIconSource & { name: string };
  /** The H2 in two lines, each kept on one line. */
  title: readonly [string, string];
  body: string;
  /** Italic note column on the right. */
  note?: string;
  onCta: () => void;
  /** "Featured" by default. */
  kicker?: string;
  /** "Get <App>" by default. */
  cta?: string;
  count: number;
  index: number;
  onIndexChange: (index: number) => void;
  /** Accessible names of the dots (translated by the caller). */
  carouselLabel: string;
  dotLabel: (index: number) => string;
  className?: string;
}

/**
 * Browse featured-app hero: height 250, radial ground around the app tint, floating 140px tile,
 * italic note, dots (prototype lines 291–301).
 */
export function FeaturedHero({
  app,
  title,
  body,
  note,
  onCta,
  kicker,
  cta,
  count,
  index,
  onIndexChange,
  carouselLabel,
  dotLabel,
  className,
}: FeaturedHeroProps) {
  const { t } = useTranslation();
  return (
    <section
      className={cx(styles.hero, className)}
      aria-roledescription={t("common.carousel")}
      aria-label={carouselLabel}
      style={{ "--tint": app.tint } as CSSProperties}
    >
      <div className={styles.content}>
        <div className={styles.kicker}>{kicker ?? t("browse.featuredKicker")}</div>
        <h2 className={styles.title}>
          <span className={styles.line}>{title[0]}</span>
          <span className={styles.line}>{title[1]}</span>
        </h2>
        <p className={styles.body}>{body}</p>
        <Button
          variant="primaryOnImage"
          size="field"
          pill
          trailingIcon={<Icon name="arrow-right" size={16} strokeWidth={2.2} />}
          className={styles.cta}
          onClick={onCta}
        >
          {cta ?? t("browse.getApp", { app: app.name })}
        </Button>
      </div>
      <AppIcon
        mono={app.mono}
        tint={app.tint}
        iconUrl={app.iconUrl}
        size={140}
        floating
        className={styles.tile}
      />
      {note !== undefined && <div className={styles.note}>{note}</div>}
      {count > 1 && (
        <CarouselDots
          count={count}
          index={index}
          onSelect={onIndexChange}
          label={carouselLabel}
          dotLabel={dotLabel}
          onImage
          className={styles.dots}
        />
      )}
    </section>
  );
}
