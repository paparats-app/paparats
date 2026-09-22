import { Icon, type IconName } from "../Icon";
import { cx } from "../internal/cx";
import styles from "./CollectionCard.module.css";

export interface CollectionCardProps {
  /**
   * `store`: Home › Collections (4 columns) — 56px tile, 15px title, 12.5px subtitle.
   * `library`: Library › Collections tab (2 columns) — 48px tile, 16px label, 13px count.
   */
  variant?: "store" | "library";
  /** Lucide name from the collection data. */
  icon: IconName | (string & Record<never, never>);
  title: string;
  /** Store subtitle, or the preformatted count ("5 apps"). */
  subtitle: string;
  onClick?: () => void;
  className?: string;
}

/** Collection card: icon tile on `--card2`, text, trailing chevron (lines 243–247 and 583–587). */
export function CollectionCard({
  variant = "store",
  icon,
  title,
  subtitle,
  onClick,
  className,
}: CollectionCardProps) {
  const store = variant === "store";
  return (
    <button
      type="button"
      className={cx(styles.card, styles[variant], className)}
      onClick={onClick}
      data-variant={variant}
    >
      <span className={styles.tile}>
        <Icon name={icon} size={store ? 24 : 22} />
      </span>
      <span className={styles.text}>
        <span className={styles.title}>{title}</span>
        <span className={styles.sub}>{subtitle}</span>
      </span>
      <Icon name="chevron-right" size={16} strokeWidth={2} className={styles.chevron} />
    </button>
  );
}
