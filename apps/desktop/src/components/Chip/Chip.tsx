import type { MouseEvent, ReactNode } from "react";
import { cx } from "../internal/cx";
import styles from "./Chip.module.css";

export interface ChipProps {
  children: ReactNode;
  /**
   * `neutral` `--card2`/`--text2` (category, license) · `outline` 1px `--line2` (source channel) ·
   * `mint` `--mint-soft`/`--mint2` (Free, This device, Developer badge).
   */
  tone?: "neutral" | "outline" | "mint";
  /** Colour of a 6px leading dot (channel tint; per-item data colour). */
  dot?: string;
  /** Leading element, e.g. a 16px `AppIcon`. */
  leading?: ReactNode;
  /** Makes the chip a button (hover `--text`, border `--text3`). */
  onClick?: (event: MouseEvent<HTMLButtonElement>) => void;
  title?: string;
  /**
   * A label longer than the room wraps onto more lines and a single long word runs past the
   * container, instead of the ellipsis (the prototype's inline-block category chip on store
   * cards, lines 227, 313).
   */
  wrap?: boolean;
  className?: string;
}

/** Tag chip — 11px/500, radius 10, `--card2` by default. */
export function Chip({
  children,
  tone = "neutral",
  dot,
  leading,
  onClick,
  title,
  wrap = false,
  className,
}: ChipProps) {
  const classes = cx(
    styles.chip,
    styles[tone],
    leading !== undefined && styles.withLeading,
    onClick && styles.interactive,
    wrap && styles.wrap,
    className,
  );
  const content = (
    <>
      {dot && <span className={styles.dot} style={{ backgroundColor: dot }} aria-hidden="true" />}
      {leading}
      <span className={styles.text}>{children}</span>
    </>
  );
  return onClick ? (
    <button type="button" className={classes} title={title} onClick={onClick} data-tone={tone}>
      {content}
    </button>
  ) : (
    <span className={classes} title={title} data-tone={tone}>
      {content}
    </span>
  );
}
