import { cx } from "../internal/cx";
import styles from "./ProPill.module.css";

export interface ProPillProps {
  /** "Pro" (callers pass the translated word). */
  label: string;
  /** `solid` `--mint`/`--ink` 11px/700 (app cards) · `soft` `--mint-soft`/`--mint2` 11px/600 (sidebar). */
  variant?: "solid" | "soft";
  className?: string;
}

export function ProPill({ label, variant = "solid", className }: ProPillProps) {
  return <span className={cx(styles.pill, styles[variant], className)}>{label}</span>;
}
