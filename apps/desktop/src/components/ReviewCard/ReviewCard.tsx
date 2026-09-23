import { useTranslation } from "react-i18next";
import { useNumberFormat } from "@/i18n/format";
import { cx } from "../internal/cx";
import { Stars } from "../RatingSummary";
import styles from "./ReviewCard.module.css";

export interface ReviewCardProps {
  author: string;
  initials: string;
  /** Preformatted date. */
  date: string;
  /** 1–5. */
  stars: number;
  text: string;
  /** "N found this helpful". */
  helpful: number;
  className?: string;
}

/** One review: 32px initials avatar, author + date, 13px stars, text, helpful count (1070–1078). */
export function ReviewCard({
  author,
  initials,
  date,
  stars,
  text,
  helpful,
  className,
}: ReviewCardProps) {
  const { t } = useTranslation();
  const format = useNumberFormat();
  return (
    <article className={cx(styles.card, className)}>
      <div className={styles.head}>
        <span className={styles.avatar} aria-hidden="true">
          {initials}
        </span>
        <div className={styles.who}>
          <div className={styles.author}>{author}</div>
          <div className={styles.date}>{date}</div>
        </div>
        <Stars value={stars} size={13} label={format.number(stars)} />
      </div>
      <p className={styles.text}>{text}</p>
      <div className={styles.helpful}>{t("app.helpful", { count: helpful })}</div>
    </article>
  );
}
