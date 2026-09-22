import type { CSSProperties } from "react";
import { cx } from "../internal/cx";
import styles from "./Skeleton.module.css";

export interface SkeletonProps {
  /** CSS length or px number; default fills the width. */
  width?: number | string;
  /** CSS length or px number. */
  height: number | string;
  /** Corner radius: 6 (text line) · 10 (card, default) · 12 (hero). */
  radius?: 6 | 10 | 12;
  /**
   * Position in a row of placeholders. The shimmer phase is offset by `-(index × stagger)`
   * seconds so a row ripples like the prototype (cards .12s, wide rows .2s).
   */
  index?: number;
  stagger?: number;
  /** `false` = static `--card2` block (the section-title bars). */
  animated?: boolean;
  className?: string;
}

const RADIUS_CLASS = { 6: styles.r6, 10: styles.r10, 12: styles.r12 } as const;

/** Shimmering placeholder block (`pp-shimmer`, 1.4s linear). Static when motion is off. */
export function Skeleton({
  width,
  height,
  radius = 10,
  index = 0,
  stagger = 0.12,
  animated = true,
  className,
}: SkeletonProps) {
  const style: CSSProperties = { width, height };
  if (animated && index > 0)
    style.animationDelay = `${-Math.round(index * stagger * 1000) / 1000}s`;
  return (
    <div
      aria-hidden="true"
      className={cx(
        styles.block,
        RADIUS_CLASS[radius],
        animated ? styles.shimmer : styles.still,
        className,
      )}
      style={style}
    />
  );
}
