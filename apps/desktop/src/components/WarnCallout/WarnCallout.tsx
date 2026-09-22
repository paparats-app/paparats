import type { ReactNode } from "react";
import { Icon, type IconName } from "../Icon";
import { cx } from "../internal/cx";
import styles from "./WarnCallout.module.css";

export interface WarnCalloutAction {
  label: string;
  onClick: () => void;
  /** Quieter `--text2` button that turns `--danger` on hover (Unsubscribe). */
  destructive?: boolean;
}

export interface WarnCalloutProps {
  /** Bold lead-in in `--text` (include its punctuation, e.g. "FOSS Friends hasn't answered…."). */
  title?: ReactNode;
  /** Body in `--text2`. */
  children: ReactNode;
  /** Up to two actions on the right (Keep / Unsubscribe). */
  actions?: ReadonlyArray<WarnCalloutAction>;
  /**
   * `sm`: padding 10/12, radius 9, 12.5px, 30px buttons (Sources row) ·
   * `md`: padding 12/14, radius 10, 13px, 32px buttons (channel page).
   */
  size?: "sm" | "md";
  icon?: IconName;
  className?: string;
}

/** `--warn-soft` note with a `--warn` triangle-alert (stale channel, community warning). */
export function WarnCallout({
  title,
  children,
  actions,
  size = "sm",
  icon = "triangle-alert",
  className,
}: WarnCalloutProps) {
  return (
    <div className={cx(styles.callout, styles[size], className)}>
      <Icon name={icon} size={16} strokeWidth={2} className={styles.icon} />
      <div className={styles.text}>
        {title !== undefined && <span className={styles.title}>{title}</span>}
        {title !== undefined && " "}
        {children}
      </div>
      {actions && actions.length > 0 && (
        <div className={styles.actions}>
          {actions.map((action) => (
            <button
              key={action.label}
              type="button"
              className={cx(styles.action, action.destructive && styles.destructive)}
              onClick={action.onClick}
            >
              {action.label}
            </button>
          ))}
        </div>
      )}
    </div>
  );
}
