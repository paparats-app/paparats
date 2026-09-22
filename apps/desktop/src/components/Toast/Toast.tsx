import type { ReactNode } from "react";
import { Icon, type IconName } from "../Icon";
import { cx } from "../internal/cx";
import styles from "./Toast.module.css";

export interface ToastProps {
  message: ReactNode;
  /** Glyph in the 22px mint circle. */
  icon?: IconName;
  /** Pinned bottom-right (`right 24 / bottom 22`); `false` renders in flow (gallery, tests). */
  floating?: boolean;
  className?: string;
}

/**
 * Success toast (visual only — `app/ToastHost` owns timing): `--card`, 1px `--line2`, radius 10,
 * `--shadow-toast`, 22px `--mint-soft` circle with a `--mint2` check, 14px/500 message. Enters
 * with a fade + 10px rise. Key it by toast id to replay the entrance for a new message.
 */
export function Toast({ message, icon = "check", floating = true, className }: ToastProps) {
  return (
    <div
      role="status"
      aria-live="polite"
      className={cx(styles.toast, floating && styles.floating, className)}
    >
      <span className={styles.badge} aria-hidden="true">
        <Icon name={icon} size={13} strokeWidth={2.6} />
      </span>
      <span className={styles.message}>{message}</span>
    </div>
  );
}
