import type { ReactNode } from "react";
import markUrl from "@/assets/images/paparats-mark-light.webp";
import { Icon, type IconName } from "../Icon";
import { cx } from "../internal/cx";
import styles from "./EmptyState.module.css";

export interface EmptyStateProps {
  title: ReactNode;
  hint?: ReactNode;
  /** 56px tinted circle with a 26px icon (Updates: `check`, offline search: `wifi-off`). */
  icon?: IconName;
  iconTone?: "mint" | "danger";
  /** The Paparats mark at .25 opacity instead of an icon (search / library). */
  logo?: boolean;
  /** Any other media (overrides `icon` / `logo`). */
  media?: ReactNode;
  /** Optional CTA, e.g. a `Button`. */
  action?: ReactNode;
  /** On a `--card` surface with a 1px `--line` border (inside lists). */
  framed?: boolean;
  /** `lg`: 60px padding, 18px title (search, Updates) · `md`: 16px title, 13px hint (library, lists). */
  size?: "md" | "lg";
  /** The hint runs the full width instead of wrapping at 360px (search, prototype lines 177/184). */
  wideHint?: boolean;
  className?: string;
}

/** Centered empty / nothing-found state: media, title 18/600, `--text2` hint, optional CTA. */
export function EmptyState({
  title,
  hint,
  icon,
  iconTone = "mint",
  logo = false,
  media,
  action,
  framed = false,
  size = "lg",
  wideHint = false,
  className,
}: EmptyStateProps) {
  let visual: ReactNode = null;
  if (media !== undefined) visual = media;
  else if (logo) visual = <img className={styles.logo} src={markUrl} alt="" draggable={false} />;
  else if (icon)
    visual = (
      <span
        className={cx(styles.circle, iconTone === "danger" && styles.danger)}
        aria-hidden="true"
      >
        <Icon name={icon} size={26} strokeWidth={iconTone === "danger" ? 2 : 2.2} />
      </span>
    );
  return (
    <div className={cx(styles.empty, styles[size], framed && styles.framed, className)}>
      {visual && <div className={styles.media}>{visual}</div>}
      <div className={styles.title}>{title}</div>
      {hint !== undefined && (
        <div className={cx(styles.hint, wideHint && styles.wideHint)}>{hint}</div>
      )}
      {action !== undefined && <div className={styles.action}>{action}</div>}
    </div>
  );
}
