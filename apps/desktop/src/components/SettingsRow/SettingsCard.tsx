import type { ReactNode } from "react";
import { cx } from "../internal/cx";
import styles from "./SettingsCard.module.css";

export interface SettingsCardProps {
  children: ReactNode;
  /** Accessible name of the group (e.g. the section title). */
  label?: string;
  className?: string;
}

/** Bordered settings card (radius 12) whose rows are separated by 1px `--line` rules. */
export function SettingsCard({ children, label, className }: SettingsCardProps) {
  return (
    <div
      role={label ? "group" : undefined}
      aria-label={label}
      className={cx(styles.card, className)}
    >
      {children}
    </div>
  );
}
