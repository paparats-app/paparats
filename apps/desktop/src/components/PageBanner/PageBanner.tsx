import type { CSSProperties, ReactNode } from "react";
import heroFern from "@/assets/images/hero-fern.webp";
import { cx } from "../internal/cx";
import styles from "./PageBanner.module.css";

export interface PageBannerProps {
  title: string;
  /** 15px `--on-image-2` line under the H1. */
  subtitle?: string;
  /** Extra left-column content under the subtitle (Updates count line, Subscription lead/CTAs). */
  children?: ReactNode;
  /** Uppercase motto on the right, max-width 220px. */
  motto?: string;
  /** Wrap the motto at 200px instead (Library, prototype line 552). */
  narrowMotto?: boolean;
  /** Primary action(s) on the right, next to (or under) the motto. */
  actions?: ReactNode;
  /** `row` motto + actions side by side (Library, Ideas) · `column` actions under the motto (Updates). */
  actionsLayout?: "row" | "column";
  /** Min-height: `md` 124 · `lg` 150 (Updates) · `xl` 200 (Subscription). */
  size?: "md" | "lg" | "xl";
  /** Photograph covering the right 58%; the fern by default (`sub-hero` on Subscription). */
  photo?: string;
  /** Full-bleed: cancel the content column padding (`margin: -8px -30px 22px`). Off in galleries. */
  bleed?: boolean;
  className?: string;
}

/**
 * Photographic page banner (Browse, Categories, Updates, Library, Subscription, Profile, Ideas):
 * `--banner-ground`, photo masked in from 45%, H1 34 + subtitle, motto and actions on the right.
 * Prototype lines 281–287, 452–479, 547–556, 675–690.
 */
export function PageBanner({
  title,
  subtitle,
  children,
  motto,
  narrowMotto = false,
  actions,
  actionsLayout = "row",
  size = "md",
  photo = heroFern,
  bleed = true,
  className,
}: PageBannerProps) {
  const hasSide = motto !== undefined || actions !== undefined;
  return (
    <header
      className={cx(styles.banner, styles[size], bleed && styles.bleed, className)}
      style={{ "--photo": `url("${photo}")` } as CSSProperties}
    >
      <div className={styles.photo} aria-hidden="true" />
      <div className={styles.inner}>
        <div className={cx(styles.main, size === "xl" && styles.mainWide)}>
          <h1 className={styles.title}>{title}</h1>
          {subtitle !== undefined && <div className={styles.subtitle}>{subtitle}</div>}
          {children}
        </div>
        {hasSide && (
          <div className={cx(styles.side, styles[actionsLayout])}>
            {motto !== undefined && (
              <div className={cx(styles.motto, narrowMotto && styles.mottoNarrow)}>{motto}</div>
            )}
            {actions}
          </div>
        )}
      </div>
    </header>
  );
}
