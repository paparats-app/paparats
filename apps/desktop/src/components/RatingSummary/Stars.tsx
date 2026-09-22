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

/** The prototype's filled star glyph (lucide `star` outline is used elsewhere). */
export const STAR_PATH = "m12 2 3.1 6.3 6.9 1-5 4.9 1.2 6.8L12 17.8 5.8 21l1.2-6.8-5-4.9 6.9-1z";

/** Read-only row of five filled stars (prototype `starFills`). */
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
        <svg
          key={n}
          width={size}
          height={size}
          viewBox="0 0 24 24"
          className={n <= filled ? styles.on : styles.off}
          aria-hidden="true"
          focusable="false"
        >
          <path d={STAR_PATH} />
        </svg>
      ))}
    </span>
  );
}
