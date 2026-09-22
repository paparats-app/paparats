import type { MouseEvent, ReactNode } from "react";
import { Icon, type IconName } from "../Icon";
import { cx } from "../internal/cx";
import styles from "./SplitButton.module.css";

/** Same tones as `useAppAction().tone`, plus `quiet` for "Queued". */
export type SplitButtonTone = "neutral" | "primary" | "progress" | "quiet" | "muted";

export interface SplitButtonProps {
  /** Main action text (Get / Open / Update / Installing… / 43% · Pause). */
  label: ReactNode;
  onClick?: (event: MouseEvent<HTMLButtonElement>) => void;
  tone?: SplitButtonTone;
  /** `compact` = 32px parts (cards), `lg` = 40px parts (app page). */
  size?: "compact" | "lg";
  disabled?: boolean;
  /** Icon of the secondary part: `chevron-right` (open) by default, `heart` for favourites. */
  secondaryIcon?: IconName;
  /** Accessible name of the secondary part. */
  secondaryLabel: string;
  onSecondaryClick?: (event: MouseEvent<HTMLButtonElement>) => void;
  /** Toggle state of the secondary part (e.g. favourite) → `aria-pressed`. */
  secondaryPressed?: boolean;
  secondaryDisabled?: boolean;
  className?: string;
}

const TONE_CLASS: Record<SplitButtonTone, string | undefined> = {
  neutral: undefined,
  primary: styles.primary,
  progress: styles.progress,
  quiet: styles.quiet,
  muted: styles.muted,
};

/** Action + secondary icon part in one bordered group (AppCard, app page header). */
export function SplitButton({
  label,
  onClick,
  tone = "neutral",
  size = "compact",
  disabled = false,
  secondaryIcon = "chevron-right",
  secondaryLabel,
  onSecondaryClick,
  secondaryPressed,
  secondaryDisabled = false,
  className,
}: SplitButtonProps) {
  return (
    <div
      role="group"
      className={cx(styles.group, styles[size], className)}
      data-tone={tone}
      data-size={size}
    >
      <button
        type="button"
        className={cx(styles.action, TONE_CLASS[tone])}
        disabled={disabled}
        onClick={onClick}
      >
        {label}
      </button>
      <button
        type="button"
        className={styles.secondary}
        aria-label={secondaryLabel}
        aria-pressed={secondaryPressed}
        disabled={secondaryDisabled}
        onClick={onSecondaryClick}
      >
        <Icon name={secondaryIcon} size={size === "lg" ? 18 : 16} />
      </button>
    </div>
  );
}
