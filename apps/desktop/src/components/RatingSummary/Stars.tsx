import { Icon } from "../Icon";
import { cx } from "../internal/cx";
import styles from "./Stars.module.css";

export interface StarsProps {
  /** 0–5; stars up to `Math.round(value)` are filled `--mint`, the rest `--line2`. */
  value: number;
  /** 16 (rating summary) or 13 (review card). */
  size?: number;
  /** Accessible text, e.g. "4.6"; without it the row is decorative. */
  label?: string;
  className?: string;
}

/**
 * Read-only row of five filled stars (prototype `starFills`): the Icon `star` glyph (the
 * prototype's path) filled, without a stroke.
 */
export function Stars({ value, size = 16, label, className }: StarsProps) {
  const filled = Math.round(value);
  return (
    <span
      className={cx(styles.stars, size < 16 && styles.tight, className)}
      role={label ? "img" : undefined}
      aria-label={label}
      aria-hidden={label ? undefined : true}
    >
      {[1, 2, 3, 4, 5].map((n) => (
        <Icon
          key={n}
          name="star"
          size={size}
          stroke="none"
          className={n <= filled ? styles.on : styles.off}
        />
      ))}
    </span>
  );
}
