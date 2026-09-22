import type { CSSProperties } from "react";
import promoProfile from "@/assets/images/promo-profile.webp";
import promoUpdates from "@/assets/images/promo-updates.webp";
import { cx } from "../internal/cx";
import styles from "./PromoCard.module.css";

export interface PromoCardProps {
  /**
   * `updates`: 330px-tall aside card, artwork across the top 180px, text at the bottom
   * ("Better tools every day."). `profile`: 172px-tall wide card, robot artwork on the right 54%.
   */
  variant: "updates" | "profile";
  title: string;
  body: string;
  /** Artwork URL; `promo-updates` / `promo-profile` by default. */
  image?: string;
  className?: string;
}

const DEFAULT_IMAGE = { updates: promoUpdates, profile: promoProfile } as const;

/** Brand promo card with artwork (prototype lines 538–541 and 907–910). */
export function PromoCard({ variant, title, body, image, className }: PromoCardProps) {
  return (
    <aside
      className={cx(styles.card, styles[variant], className)}
      style={{ "--art": `url("${image ?? DEFAULT_IMAGE[variant]}")` } as CSSProperties}
    >
      <div className={styles.art} aria-hidden="true" />
      <div className={styles.text}>
        <div className={styles.title}>{title}</div>
        <div className={styles.body}>{body}</div>
      </div>
    </aside>
  );
}
