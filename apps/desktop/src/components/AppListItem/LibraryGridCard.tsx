import { useTranslation } from "react-i18next";
import { AppActionButton, type AppActionView, type AppIconSource } from "../AppCard";
import { AppIcon } from "../AppIcon";
import { Icon } from "../Icon";
import { cx } from "../internal/cx";
import { ProgressBar } from "../ProgressBar";
import styles from "./LibraryGridCard.module.css";

export interface LibraryGridCardProps {
  name: string;
  icon: AppIconSource;
  /** "1.8.10 · Updated today", or the download line while busy. */
  subtitle: string;
  action: AppActionView;
  favorite?: boolean;
  onToggleFavorite: () => void;
  onOpen?: () => void;
  /** Download progress 0–100; shows the 2px bar along the bottom edge. */
  progress?: number;
  className?: string;
}

/** Library grid view card (4 columns): the action + a 32px favourite toggle (lines 622–629). */
export function LibraryGridCard({
  name,
  icon,
  subtitle,
  action,
  favorite = false,
  onToggleFavorite,
  onOpen,
  progress,
  className,
}: LibraryGridCardProps) {
  const { t } = useTranslation();
  const favoriteLabel = favorite ? t("common.removeFavorite") : t("common.addFavorite");
  return (
    <div className={cx(styles.card, className)}>
      <button type="button" className={styles.identity} onClick={onOpen}>
        <AppIcon
          mono={icon.mono}
          tint={icon.tint}
          iconUrl={icon.iconUrl}
          size={48}
          className={styles.icon}
        />
        <span className={styles.text}>
          <span className={styles.name}>{name}</span>
          <span className={styles.sub}>{subtitle}</span>
        </span>
      </button>
      <div className={styles.actions}>
        <AppActionButton action={action} dense fullWidth className={styles.action} />
        <button
          type="button"
          className={styles.favorite}
          aria-label={favoriteLabel}
          title={favoriteLabel}
          aria-pressed={favorite}
          onClick={onToggleFavorite}
        >
          <Icon name="star" size={15} />
        </button>
      </div>
      {progress !== undefined && (
        <ProgressBar value={progress} height={2} label={name} className={styles.progress} />
      )}
    </div>
  );
}
