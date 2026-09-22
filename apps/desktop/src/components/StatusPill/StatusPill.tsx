import type { IdeaStatus } from "@/services/types";
import { cx } from "../internal/cx";
import styles from "./StatusPill.module.css";

export interface StatusPillProps {
  status: IdeaStatus;
  /** Translated status name (Open / In work / Released). */
  label: string;
  className?: string;
}

/** Idea status: open `--card2`/`--text2` · work `--warn-soft`/`--warn` · released `--mint-soft`/`--mint2`. */
export function StatusPill({ status, label, className }: StatusPillProps) {
  return (
    <span className={cx(styles.pill, styles[status], className)} data-status={status}>
      {label}
    </span>
  );
}
