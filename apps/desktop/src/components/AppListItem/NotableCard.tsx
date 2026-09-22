import type { AppIconSource } from "../AppCard";
import { AppIcon } from "../AppIcon";
import { cx } from "../internal/cx";
import styles from "./NotableCard.module.css";

export interface NotableCardProps {
  name: string;
  icon: AppIconSource;
  tagline: string;
  onOpen?: () => void;
  className?: string;
}

/** Home › "New and notable" card (4 columns): 56px tile radius 13 + name + 2-line tagline (257–260). */
export function NotableCard({ name, icon, tagline, onOpen, className }: NotableCardProps) {
  return (
    <button type="button" className={cx(styles.card, className)} onClick={onOpen}>
      <AppIcon mono={icon.mono} tint={icon.tint} iconUrl={icon.iconUrl} size={56} />
      <span className={styles.text}>
        <span className={styles.name}>{name}</span>
        <span className={styles.tagline}>{tagline}</span>
      </span>
    </button>
  );
}
