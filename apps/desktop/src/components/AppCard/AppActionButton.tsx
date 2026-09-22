import { Button, type ButtonTone } from "../Button";
import { cx } from "../internal/cx";
import type { AppActionTone, AppActionView } from "./types";
import styles from "./AppActionButton.module.css";

export interface AppActionButtonProps {
  action: AppActionView;
  /**
   * `xs` 30px radius 6 (Home "Recently updated") · `compact` 32px radius 7 (library row / card) ·
   * `sm` 34px radius 8 (Browse notable row, update row).
   */
  size?: "xs" | "compact" | "sm";
  /** 600 instead of 500 (notable row, update row). */
  strong?: boolean;
  /** Tight 8px side padding for fixed-width grid columns (library row). */
  dense?: boolean;
  fullWidth?: boolean;
  /** Accessible name when the label alone is ambiguous (e.g. "Open Obsidian"). */
  ariaLabel?: string;
  className?: string;
}

const TONE: Record<AppActionTone, ButtonTone> = {
  neutral: "default",
  primary: "default",
  progress: "progress",
  quiet: "quiet",
  muted: "muted",
};

/**
 * The single (non-split) app action of list rows: `--card2` + 1px `--line2`, or `--mint`/`--ink`
 * for `primary`; hover brightness 1.15. Busy states keep full strength when disabled — the tone
 * already says "Queued" / "Installing…" / "Updated just now".
 */
export function AppActionButton({
  action,
  size = "compact",
  strong = false,
  dense = false,
  fullWidth = false,
  ariaLabel,
  className,
}: AppActionButtonProps) {
  const tone = action.tone ?? "neutral";
  return (
    <Button
      variant={tone === "primary" ? "primary" : "secondary"}
      tone={TONE[tone]}
      size={size}
      fullWidth={fullWidth}
      disabled={action.disabled}
      aria-label={ariaLabel}
      onClick={action.onClick}
      className={cx(
        styles.action,
        size === "xs" && styles.xs,
        strong && styles.strong,
        dense && styles.dense,
        className,
      )}
      data-tone={tone}
    >
      {action.label}
    </Button>
  );
}
