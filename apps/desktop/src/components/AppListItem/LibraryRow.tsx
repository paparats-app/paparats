import { useTranslation } from "react-i18next";
import {
  AppActionButton,
  type AppActionView,
  type AppIconSource,
  type ChannelMark,
} from "../AppCard";
import { AppIcon } from "../AppIcon";
import { Button } from "../Button";
import { Chip } from "../Chip";
import { Icon } from "../Icon";
import { cx } from "../internal/cx";
import { Menu, type MenuEntry } from "../Menu";
import { ProgressBar } from "../ProgressBar";
import styles from "./LibraryRow.module.css";

export interface LibraryRowProps {
  name: string;
  icon: AppIconSource;
  tagline: string;
  /** 12px `--mint2` star after the name. */
  favorite?: boolean;
  /** Two tag chips: category + Pro / Portable / license. */
  tags: readonly string[];
  /** Source channel chip after the tags (non-official sources). */
  channel?: ChannelMark;
  /** First status line: installed version, or the download line while busy. */
  status: string;
  /** Second line: "Updated 3 days ago", "Update → 1.93.0" or "12 MB of 87 MB". */
  statusSub?: string;
  /** `mint` for "Update → x" (`--mint2`), else `--text3`. */
  statusTone?: "default" | "mint";
  /** The Open / Update / progress action (`useAppAction()`). */
  action: AppActionView;
  /** Download progress 0–100; shows the 2px bar along the bottom edge. */
  progress?: number;
  onOpen?: () => void;
  onToggleFavorite: () => void;
  onOpenFolder: () => void;
  onUninstall: () => void;
  /** Accessible name of the ⋯ button (e.g. "More actions for Obsidian"). */
  moreLabel: string;
  /** Controlled overflow menu (`useLibraryStore.menuFor`); uncontrolled when omitted. */
  menuOpen?: boolean;
  onMenuOpenChange?: (open: boolean) => void;
  className?: string;
}

/**
 * Library list row — grid `44px 1fr 240px 118px 92px 32px`, gap 14 (prototype lines 599–615).
 * The ⋯ menu: Add/Remove favorite, Open install folder, divider, Uninstall in `--danger`.
 */
export function LibraryRow({
  name,
  icon,
  tagline,
  favorite = false,
  tags,
  channel,
  status,
  statusSub,
  statusTone = "default",
  action,
  progress,
  onOpen,
  onToggleFavorite,
  onOpenFolder,
  onUninstall,
  moreLabel,
  menuOpen,
  onMenuOpenChange,
  className,
}: LibraryRowProps) {
  const { t } = useTranslation();
  const items: MenuEntry[] = [
    {
      id: "favorite",
      label: favorite ? t("common.removeFavorite") : t("common.addFavorite"),
      icon: "star",
      onSelect: onToggleFavorite,
    },
    { id: "folder", label: t("library.openFolder"), icon: "folder", onSelect: onOpenFolder },
    { type: "divider", id: "divider" },
    {
      id: "uninstall",
      label: t("library.uninstall"),
      icon: "trash-2",
      destructive: true,
      onSelect: onUninstall,
    },
  ];

  return (
    <div className={cx(styles.row, className)} data-library-row="">
      <button
        type="button"
        className={styles.tile}
        onClick={onOpen}
        tabIndex={-1}
        aria-hidden="true"
      >
        <AppIcon
          mono={icon.mono}
          tint={icon.tint}
          iconUrl={icon.iconUrl}
          size={44}
          className={styles.icon}
        />
      </button>
      <button type="button" className={styles.identity} onClick={onOpen}>
        <span className={styles.nameLine}>
          <span className={styles.name}>{name}</span>
          {favorite && (
            <Icon
              name="star"
              size={12}
              strokeWidth={1.5}
              className={styles.star}
              label={t("library.favorites")}
            />
          )}
        </span>
        <span className={styles.tagline}>{tagline}</span>
      </button>
      <div className={styles.tags}>
        {tags.map((tag) => (
          <Chip key={tag} className={styles.tag}>
            {tag}
          </Chip>
        ))}
        {channel && (
          <Chip tone="outline" dot={channel.tint} className={styles.tag}>
            {channel.name}
          </Chip>
        )}
      </div>
      <div className={styles.status}>
        <div className={styles.line}>{status}</div>
        {statusSub !== undefined && (
          <div className={cx(styles.line, statusTone === "mint" ? styles.subMint : styles.sub)}>
            {statusSub}
          </div>
        )}
      </div>
      <AppActionButton action={action} dense fullWidth />
      <Menu
        items={items}
        label={moreLabel}
        align="end"
        className={styles.menu}
        open={menuOpen}
        onOpenChange={onMenuOpenChange}
        renderTrigger={(trigger) => (
          <Button
            {...trigger}
            variant="ghost"
            size="compact"
            aria-label={moreLabel}
            className={styles.more}
            leadingIcon={<Icon name="ellipsis" size={16} strokeWidth={3} />}
          />
        )}
      />
      {progress !== undefined && (
        <ProgressBar value={progress} height={2} label={name} className={styles.progress} />
      )}
    </div>
  );
}
