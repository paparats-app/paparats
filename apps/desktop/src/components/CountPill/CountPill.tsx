import { cx } from "../internal/cx";
import styles from "./CountPill.module.css";

export interface CountPillProps {
  /** Already formatted by the caller when it needs locale formatting. */
  value: number | string;
  /**
   * `solid` 22px `--mint`/`--ink` 12px/700 (sidebar badge) ·
   * `soft` 20px `--mint-soft`/`--mint2` 11px/700 (tab counts) ·
   * `neutral` 20px `--card2`/`--text2` 11px/600 (quick filters).
   */
  tone?: "solid" | "soft" | "neutral";
  /** Accessible text (e.g. "3 updates available"); otherwise the number is read as is. */
  label?: string;
  className?: string;
}

/** Count badge: fully rounded, min-width = height + 12px padding (34×22 / 32×20), tabular figures. */
export function CountPill({ value, tone = "solid", label, className }: CountPillProps) {
  return (
    <span
      className={cx(styles.pill, styles[tone], className)}
      aria-label={label}
      role={label ? "img" : undefined}
      data-tone={tone}
    >
      {value}
    </span>
  );
}
