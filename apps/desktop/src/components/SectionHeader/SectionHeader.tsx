import type { ReactNode } from "react";
import { Icon } from "../Icon";
import { cx } from "../internal/cx";
import styles from "./SectionHeader.module.css";

export interface SectionHeaderProps {
  title: ReactNode;
  /** Heading level (visual size is independent). */
  level?: 2 | 3;
  /** `lg` 20px (Home, Settings) · `md` 18px (Browse, Subscription, Profile) · `sm` 16px (app page). */
  size?: "lg" | "md" | "sm";
  /** "See all" link text; shown with a 14px arrow when `onAction` is set. */
  actionLabel?: string;
  onAction?: () => void;
  /** Right-side text instead of a link (e.g. "12 apps"). */
  meta?: ReactNode;
  id?: string;
  className?: string;
}

/** Section title (600, -.01em) with an optional ghost "See all →" link on the right. */
export function SectionHeader({
  title,
  level = 2,
  size = "lg",
  actionLabel,
  onAction,
  meta,
  id,
  className,
}: SectionHeaderProps) {
  const Heading = level === 2 ? "h2" : "h3";
  return (
    <div className={cx(styles.header, className)}>
      <Heading id={id} className={cx(styles.title, styles[size])}>
        {title}
      </Heading>
      {actionLabel !== undefined && onAction && (
        <button type="button" className={styles.link} onClick={onAction}>
          {actionLabel}
          <Icon name="arrow-right" size={14} strokeWidth={2} />
        </button>
      )}
      {meta !== undefined && <div className={styles.meta}>{meta}</div>}
    </div>
  );
}
