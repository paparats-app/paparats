import { AppIcon } from "../AppIcon";
import { Chip } from "../Chip";
import type { IconName } from "../Icon";
import { cx } from "../internal/cx";
import { ProgressBar } from "../ProgressBar";
import { ProPill } from "../ProPill";
import { SplitButton } from "../SplitButton";
import { AppActionButton } from "./AppActionButton";
import type { AppActionView, AppIconSource, ChannelMark } from "./types";
import styles from "./AppCard.module.css";

/** The chevron (or heart) part of the split action. */
export interface AppCardSecondary {
  /** Accessible name, e.g. "Details". */
  label: string;
  onClick: () => void;
  /** `chevron-right` by default. */
  icon?: IconName;
}

export interface AppCardProps {
  name: string;
  icon: AppIconSource;
  /** 12px `--text2`, clamped to two lines (tagline, or the Pro note on the Pro card). */
  tagline?: string;
  /** Optional single line above the tagline. */
  publisher?: string;
  /** Category chip (`--card2`); a long label wraps inside the chip, as in the prototype. */
  category?: string;
  /** Source channel chip (outline + 6px tint dot); screens pass it for non-official sources. */
  channel?: ChannelMark;
  /**
   * The primary action (`useAppAction()`). Without it the whole card is one button that calls
   * `onOpen` (Subscription › "Popular apps with Pro features").
   */
  action?: AppActionView;
  /** Split variant: the action plus a 32px secondary part (opens the app page by default). */
  secondary?: AppCardSecondary;
  /** Opens the app page (icon + text area, or the whole card without an action). */
  onOpen?: () => void;
  /** Download progress 0–100; shows the 2px bar along the bottom edge while busy. */
  progress?: number;
  /** "Pro" pill: pinned bottom-right on the link card, next to the chips on action cards. */
  proLabel?: string;
  /** 48 (store grids, default) or 44 (Pro card). */
  iconSize?: 44 | 48;
  className?: string;
}

/**
 * Store grid card (Home 6-col, Browse / channel 5-col): icon + name + tagline + chips, then the
 * action row. Prototype lines 224–233 (action card) and 716–720 (Pro link card).
 */
export function AppCard({
  name,
  icon,
  tagline,
  publisher,
  category,
  channel,
  action,
  secondary,
  onOpen,
  progress,
  proLabel,
  iconSize,
  className,
}: AppCardProps) {
  const linkCard = action === undefined;
  const size = iconSize ?? (linkCard ? 44 : 48);
  const chips =
    category !== undefined || channel !== undefined || (!linkCard && proLabel !== undefined);

  const identity = (
    <>
      <AppIcon
        mono={icon.mono}
        tint={icon.tint}
        iconUrl={icon.iconUrl}
        size={size}
        className={linkCard ? styles.linkIcon : undefined}
      />
      <span className={cx(styles.text, linkCard && proLabel !== undefined && styles.pillRoom)}>
        <span className={styles.name}>{name}</span>
        {publisher !== undefined && <span className={styles.publisher}>{publisher}</span>}
        {tagline !== undefined && <span className={styles.tagline}>{tagline}</span>}
        {chips && (
          <span className={styles.chips}>
            {category !== undefined && <Chip wrap>{category}</Chip>}
            {channel !== undefined && (
              <Chip tone="outline" dot={channel.tint}>
                {channel.name}
              </Chip>
            )}
            {!linkCard && proLabel !== undefined && <ProPill label={proLabel} />}
          </span>
        )}
      </span>
    </>
  );

  if (linkCard) {
    return (
      <button
        type="button"
        className={cx(styles.card, styles.linkCard, className)}
        onClick={onOpen}
        data-app-card="link"
      >
        {identity}
        {proLabel !== undefined && <ProPill label={proLabel} className={styles.proPinned} />}
      </button>
    );
  }

  return (
    <div className={cx(styles.card, className)} data-app-card="action">
      {onOpen ? (
        <button type="button" className={styles.identity} onClick={onOpen}>
          {identity}
        </button>
      ) : (
        <div className={styles.identity}>{identity}</div>
      )}
      <div className={styles.actions}>
        {secondary ? (
          <SplitButton
            label={action.label}
            tone={action.tone}
            disabled={action.disabled}
            onClick={action.onClick}
            secondaryIcon={secondary.icon}
            secondaryLabel={secondary.label}
            onSecondaryClick={secondary.onClick}
            className={styles.split}
          />
        ) : (
          <AppActionButton action={action} dense fullWidth />
        )}
      </div>
      {progress !== undefined && (
        <ProgressBar value={progress} height={2} label={name} className={styles.progress} />
      )}
    </div>
  );
}
