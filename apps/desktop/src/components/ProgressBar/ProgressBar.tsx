import { cx } from "../internal/cx";
import styles from "./ProgressBar.module.css";

export type ProgressBarHeight = 2 | 3 | 4 | 6;

export interface ProgressBarProps {
  /** Percent, 0–100 (clamped, rounded). */
  value: number;
  /**
   * 2 library row/card edge · 3 under an update row · 4 under the app page action (radius 2,
   * `--card2` track) · 6 the Updates batch bar (radius 3).
   */
  height?: ProgressBarHeight;
  /** On a photographic banner: translucent light track, theme-independent mint fill. */
  onImage?: boolean;
  /** Accessible name (e.g. the app name). */
  label?: string;
  className?: string;
}

export function clampPercent(value: number): number {
  if (!Number.isFinite(value)) return 0;
  return Math.round(Math.min(100, Math.max(0, value)));
}

/** Determinate progress: `--line` track, `--mint` fill, width eased over .25s. */
export function ProgressBar({
  value,
  height = 3,
  onImage = false,
  label,
  className,
}: ProgressBarProps) {
  const pct = clampPercent(value);
  return (
    <div
      role="progressbar"
      aria-label={label}
      aria-valuemin={0}
      aria-valuemax={100}
      aria-valuenow={pct}
      className={cx(styles.track, styles[`h${height}`], onImage && styles.onImage, className)}
    >
      <div className={styles.fill} style={{ width: `${pct}%` }} />
    </div>
  );
}
