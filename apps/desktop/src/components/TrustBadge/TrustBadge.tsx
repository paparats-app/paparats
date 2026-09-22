import type { TrustLevel } from "@/services/types";
import { Icon, type IconName } from "../Icon";
import { cx } from "../internal/cx";
import styles from "./TrustBadge.module.css";

export const TRUST_ICON: Record<TrustLevel, IconName> = {
  official: "shield",
  verified: "badge-check",
  community: "users",
};

export interface TrustBadgeProps {
  level: TrustLevel;
  /** Translated level name (Official / Verified / Community). */
  label: string;
  /** Vertical padding: `sm` 1px (dialogs) · `md` 2px (Sources list) · `lg` 3px (channel page). */
  size?: "sm" | "md" | "lg";
  className?: string;
}

/** Channel trust: official shield `--mint-soft`/`--mint2` · verified badge-check `--card2`/`--text` ·
 *  community users `--warn-soft`/`--warn`. 11px/600, radius 10, 11px icon. */
export function TrustBadge({ level, label, size = "md", className }: TrustBadgeProps) {
  return (
    <span className={cx(styles.badge, styles[level], styles[size], className)} data-level={level}>
      <Icon name={TRUST_ICON[level]} size={11} strokeWidth={2.4} />
      {label}
    </span>
  );
}
