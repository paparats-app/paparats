import { cx } from "../internal/cx";
import styles from "./ActivePill.module.css";

export interface ActivePillProps {
  /** "Active" (translated by the caller). */
  label: string;
  /** `sm` padding 2/9 (subscription card) · `md` padding 3/10 (profile Pro card). */
  size?: "sm" | "md";
  className?: string;
}

/** Mint status pill for an active plan: `--mint`/`--ink`, 11px/700, radius 9. */
export function ActivePill({ label, size = "sm", className }: ActivePillProps) {
  return <span className={cx(styles.pill, styles[size], className)}>{label}</span>;
}
