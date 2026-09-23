import { useRef, type KeyboardEvent } from "react";
import { useTranslation } from "react-i18next";
import { useNumberFormat } from "@/i18n/format";
import { Icon } from "../Icon";
import { cx } from "../internal/cx";
import { Stars } from "./Stars";
import styles from "./RatingSummary.module.css";

export interface RatingBar {
  /** 5 … 1. */
  stars: number;
  /** Share of ratings, 0–100. */
  pct: number;
}

export interface RatingSummaryProps {
  /** Average rating, e.g. 4.6 (shown with one decimal in the current language). */
  average: number;
  ratingsCount: number;
  /** 5–1 histogram (`domain/appDetail.ratingHistogram`). */
  histogram: readonly RatingBar[];
  /** The viewer's own rating, 0 = none. */
  myRating: number;
  onRate: (stars: number) => void;
  className?: string;
}

const RATE = [1, 2, 3, 4, 5] as const;

/**
 * App page ratings card: 44px average + count, five stars, 5–1 histogram bars and tap-to-rate
 * (prototype lines 1051–1067).
 */
export function RatingSummary({
  average,
  ratingsCount,
  histogram,
  myRating,
  onRate,
  className,
}: RatingSummaryProps) {
  const { t } = useTranslation();
  const format = useNumberFormat();
  const averageText = format.fixed(average, 1);
  const rateRefs = useRef<Array<HTMLButtonElement | null>>([]);
  const tabStop = myRating >= 1 && myRating <= 5 ? myRating - 1 : 0;

  const onRateKey = (event: KeyboardEvent<HTMLButtonElement>, index: number) => {
    const forward = event.key === "ArrowRight" || event.key === "ArrowUp";
    const backward = event.key === "ArrowLeft" || event.key === "ArrowDown";
    if (!forward && !backward) return;
    event.preventDefault();
    const next = Math.min(4, Math.max(0, index + (forward ? 1 : -1)));
    rateRefs.current[next]?.focus();
    onRate(next + 1);
  };

  return (
    <section className={cx(styles.card, className)} aria-label={t("app.reviews")}>
      <div className={styles.head}>
        <span className={styles.average}>{averageText}</span>
        <span className={styles.count}>{t("app.ratingsCount", { count: ratingsCount })}</span>
      </div>
      <Stars value={average} label={averageText} className={styles.stars} />
      <div className={styles.histogram}>
        {histogram.map((bar) => (
          <div key={bar.stars} className={styles.bar}>
            <span>{format.number(bar.stars)}</span>
            <span className={styles.track} aria-hidden="true">
              <span className={styles.fill} style={{ width: `${bar.pct}%` }} />
            </span>
            <span className={styles.pct}>{format.percent(bar.pct)}</span>
          </div>
        ))}
      </div>
      <div className={styles.rate}>
        <div className={styles.rateTitle} aria-hidden="true">
          {t("app.rateApp")}
        </div>
        <div role="radiogroup" aria-label={t("app.rateApp")} className={styles.rateStars}>
          {RATE.map((n, index) => (
            <button
              key={n}
              ref={(el) => {
                rateRefs.current[index] = el;
              }}
              type="button"
              role="radio"
              aria-checked={n === myRating}
              aria-label={format.number(n)}
              tabIndex={index === tabStop ? 0 : -1}
              className={cx(styles.rateStar, n <= myRating && styles.rateOn)}
              onClick={() => onRate(n)}
              onKeyDown={(event) => onRateKey(event, index)}
            >
              <Icon name="star" size={20} fill="currentColor" stroke="none" />
            </button>
          ))}
        </div>
      </div>
    </section>
  );
}
