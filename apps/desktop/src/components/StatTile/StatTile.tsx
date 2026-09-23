import type { ReactNode } from "react";
import { Icon, type IconName } from "../Icon";
import { cx } from "../internal/cx";
import styles from "./StatTile.module.css";

export interface StatTileProps {
  /** Already formatted (`useFormat()`), e.g. "18.4 GB", "10,000+". */
  value: ReactNode;
  label: ReactNode;
  icon?: IconName;
  /**
   * `row`: 20px `--text2` icon + 16px/600 value + 12px label (Library stats, ecosystem list) ·
   * `tile`: `--bg` tile, 18px icon, 20px/600 value, 11.5px label (Profile usage) ·
   * `compact`: `--bg` tile without icon, 20px/700 value (Ideas developer panel).
   */
  variant?: "row" | "tile" | "compact";
  /** No gap between value and label (`row`: Library stats, prototype line 649; the ecosystem list keeps 2px). */
  tight?: boolean;
  className?: string;
}

export function StatTile({
  value,
  label,
  icon,
  variant = "row",
  tight = false,
  className,
}: StatTileProps) {
  return (
    <div className={cx(styles.stat, styles[variant], tight && styles.tight, className)}>
      {icon && variant !== "compact" && (
        <Icon name={icon} size={variant === "tile" ? 18 : 20} className={styles.icon} />
      )}
      <div className={styles.text}>
        <div className={styles.value}>{value}</div>
        <div className={styles.label}>{label}</div>
      </div>
    </div>
  );
}
