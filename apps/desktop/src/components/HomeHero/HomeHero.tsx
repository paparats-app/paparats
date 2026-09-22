import type { CSSProperties } from "react";
import heroFern from "@/assets/images/hero-fern.webp";
import { Button } from "../Button";
import { CarouselDots } from "../CarouselDots";
import { Icon } from "../Icon";
import { cx } from "../internal/cx";
import styles from "./HomeHero.module.css";

export interface HomeHeroSlide {
  kicker: string;
  /** The H1 in two lines, each kept on one line. */
  title: readonly [string, string];
  body: string;
  cta: string;
  /** Right-aligned pull quote. */
  quote?: string;
}

export interface HomeHeroProps {
  slide: HomeHeroSlide;
  onCta: () => void;
  /** Number of slides and the active one (`useHomeStore.heroIndex`). */
  count: number;
  index: number;
  onIndexChange: (index: number) => void;
  /** Accessible names of the carousel controls (translated by the caller). */
  carouselLabel: string;
  previousLabel: string;
  nextLabel: string;
  dotLabel: (index: number) => string;
  /**
   * First-launch exit: a coral radial glow (`mix-blend-mode: screen`) fades in (.9s after .35s)
   * while true and back out over 2s when it turns false.
   */
  glow?: boolean;
  /** Right-hand photograph; the fern by default. */
  photo?: string;
  className?: string;
}

/**
 * Home carousel slide: height 326, `--hero-gradient`, photo on the right 66%, kicker + two-line
 * H1 + body + CTA pill, pull quote, prev/next + dots (prototype lines 201–216).
 */
export function HomeHero({
  slide,
  onCta,
  count,
  index,
  onIndexChange,
  carouselLabel,
  previousLabel,
  nextLabel,
  dotLabel,
  glow = false,
  photo = heroFern,
  className,
}: HomeHeroProps) {
  const step = (delta: number) => onIndexChange((index + delta + count) % count);
  return (
    <section
      className={cx(styles.hero, className)}
      aria-roledescription="carousel"
      aria-label={carouselLabel}
      style={{ "--photo": `url("${photo}")` } as CSSProperties}
    >
      <div className={cx(styles.glow, glow && styles.glowOn)} aria-hidden="true" />
      <div className={styles.photo} aria-hidden="true" />
      <div className={styles.content}>
        <div className={styles.kicker}>{slide.kicker}</div>
        <h1 className={styles.title}>
          <span className={styles.line}>{slide.title[0]}</span>
          <span className={styles.line}>{slide.title[1]}</span>
        </h1>
        <p className={styles.body}>{slide.body}</p>
        <Button
          variant="primaryOnImage"
          size="lg"
          pill
          trailingIcon={<Icon name="arrow-right" size={16} strokeWidth={2.2} />}
          className={styles.cta}
          onClick={onCta}
        >
          {slide.cta}
        </Button>
      </div>
      {slide.quote !== undefined && <div className={styles.quote}>{slide.quote}</div>}
      {count > 1 && (
        <div className={styles.controls}>
          <button
            type="button"
            className={styles.arrow}
            aria-label={previousLabel}
            onClick={() => step(-1)}
          >
            <Icon name="chevron-left" size={16} strokeWidth={2} />
          </button>
          <CarouselDots
            count={count}
            index={index}
            onSelect={onIndexChange}
            label={carouselLabel}
            dotLabel={dotLabel}
            onImage
          />
          <button
            type="button"
            className={styles.arrow}
            aria-label={nextLabel}
            onClick={() => step(1)}
          >
            <Icon name="chevron-right" size={16} strokeWidth={2} />
          </button>
        </div>
      )}
    </section>
  );
}
