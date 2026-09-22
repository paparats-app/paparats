import type { CSSProperties } from "react";
import catDesign from "@/assets/images/cat-design.webp";
import catDevelopment from "@/assets/images/cat-development.webp";
import catEducation from "@/assets/images/cat-education.webp";
import catGames from "@/assets/images/cat-games.webp";
import catLifestyle from "@/assets/images/cat-lifestyle.webp";
import catMedia from "@/assets/images/cat-media.webp";
import catProductivity from "@/assets/images/cat-productivity.webp";
import catSystem from "@/assets/images/cat-system.webp";
import catUtilities from "@/assets/images/cat-utilities.webp";
import type { CategoryId } from "@/services/types";
import { Icon, type IconName } from "../Icon";
import { cx } from "../internal/cx";
import styles from "./CategoryCard.module.css";

/** The category photographs (`assets/images/cat-<id>.webp`). */
export const CATEGORY_PHOTOS: Readonly<Record<CategoryId, string>> = {
  productivity: catProductivity,
  development: catDevelopment,
  design: catDesign,
  media: catMedia,
  utilities: catUtilities,
  system: catSystem,
  lifestyle: catLifestyle,
  games: catGames,
  education: catEducation,
};

export interface CategoryCardProps {
  label: string;
  description: string;
  /** Catalog count, preformatted ("142 apps"). */
  countLabel: string;
  /** Lucide name from the category data (26px outline icon). */
  icon: IconName | (string & Record<never, never>);
  /** Photograph URL, usually `CATEGORY_PHOTOS[id]`. */
  photo: string;
  onClick?: () => void;
  className?: string;
}

/**
 * Categories screen photo tile: min-height 172, `--category-ground`, photograph on the right
 * 66% faded in from the left (prototype lines 423–428).
 */
export function CategoryCard({
  label,
  description,
  countLabel,
  icon,
  photo,
  onClick,
  className,
}: CategoryCardProps) {
  return (
    <button
      type="button"
      className={cx(styles.card, className)}
      onClick={onClick}
      style={{ "--photo": `url("${photo}")` } as CSSProperties}
    >
      <span className={styles.photo} aria-hidden="true" />
      <Icon name={icon} size={26} className={styles.icon} />
      <span className={styles.body}>
        <span className={styles.label}>{label}</span>
        <span className={styles.desc}>{description}</span>
      </span>
      <span className={styles.footer}>
        <span className={styles.count}>{countLabel}</span>
        <Icon name="arrow-right" size={16} strokeWidth={2} className={styles.arrow} />
      </span>
    </button>
  );
}

export interface CategoryChipProps {
  label: string;
  /** Preformatted count ("142 apps"). */
  countLabel: string;
  icon: IconName | (string & Record<never, never>);
  onClick?: () => void;
  className?: string;
}

/** Browse › "Top categories" compact tile: 22px icon + label + count (prototype lines 341–344). */
export function CategoryChip({ label, countLabel, icon, onClick, className }: CategoryChipProps) {
  return (
    <button type="button" className={cx(styles.chip, className)} onClick={onClick}>
      <Icon name={icon} size={22} className={styles.chipIcon} />
      <span className={styles.chipText}>
        <span className={styles.chipLabel}>{label}</span>
        <span className={styles.chipCount}>{countLabel}</span>
      </span>
    </button>
  );
}
