import { useId } from "react";
import { useTranslation } from "react-i18next";
import {
  AppActionButton,
  type AppActionView,
  type AppIconSource,
  type ChannelMark,
} from "../AppCard";
import { AppIcon } from "../AppIcon";
import { Button, IconButton } from "../Button";
import { Chip } from "../Chip";
import { Icon } from "../Icon";
import { cx } from "../internal/cx";
import { ProgressBar } from "../ProgressBar";
import styles from "./UpdateRow.module.css";

export interface UpdateRowProps {
  name: string;
  icon: AppIconSource;
  channel?: ChannelMark;
  /** "1.92.2 → 1.93.0", the download line while busy, or the new version once done. */
  versionLine: string;
  /** Download size, right-aligned ("87 MB"). */
  sizeLabel: string;
  /** The Update / "NN% · Pause" / "Installing…" action (`useAppAction()`). */
  action: AppActionView;
  /** Settled "Updated just now" state: disabled `--card2`/`--text2`, replaces `action`. */
  done?: boolean;
  /** Download progress 0–100; shows the 3px bar under the row. */
  progress?: number;
  expanded: boolean;
  onToggleExpanded: () => void;
  /** Release notes shown under "What's new". */
  notes: readonly string[];
  /** Opens the app page (icon, name, "View details →"). */
  onOpen?: () => void;
  className?: string;
}

/**
 * Updates row — grid `48px 1fr 80px 130px 36px`, gap 16, with an expandable "What's new" panel
 * (prototype lines 484–502).
 */
export function UpdateRow({
  name,
  icon,
  channel,
  versionLine,
  sizeLabel,
  action,
  done = false,
  progress,
  expanded,
  onToggleExpanded,
  notes,
  onOpen,
  className,
}: UpdateRowProps) {
  const { t } = useTranslation();
  const panelId = useId();
  const shown: AppActionView = done
    ? { label: t("updates.updatedNow"), tone: "quiet", disabled: true }
    : action;
  return (
    <div className={cx(styles.row, className)} data-expanded={expanded || undefined}>
      <div className={styles.main}>
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
            size={48}
            className={styles.icon}
          />
        </button>
        <button type="button" className={styles.identity} onClick={onOpen}>
          <span className={styles.nameLine}>
            <span className={styles.name}>{name}</span>
            {channel && (
              <Chip tone="outline" dot={channel.tint}>
                {channel.name}
              </Chip>
            )}
          </span>
          <span className={styles.version}>{versionLine}</span>
        </button>
        <div className={styles.size}>{sizeLabel}</div>
        <AppActionButton action={shown} size="sm" strong fullWidth className={styles.action} />
        <IconButton
          icon={expanded ? "chevron-up" : "chevron-down"}
          label={expanded ? t("updates.hideDetails") : t("updates.viewDetails")}
          size="sm"
          iconSize={16}
          iconStrokeWidth={2}
          aria-expanded={expanded}
          aria-controls={panelId}
          className={styles.expand}
          onClick={onToggleExpanded}
        />
      </div>
      {progress !== undefined && <ProgressBar value={progress} height={3} label={name} />}
      {expanded && (
        <div id={panelId} className={styles.panel}>
          <div className={styles.overline}>{t("common.whatsNew")}</div>
          <ul className={styles.notes}>
            {notes.map((note, index) => (
              <li key={`${index}:${note}`} className={styles.note}>
                <span className={styles.bullet} aria-hidden="true" />
                {note}
              </li>
            ))}
          </ul>
          {onOpen && (
            <Button
              variant="link"
              size="xs"
              trailingIcon={<Icon name="arrow-right" size={14} strokeWidth={2} />}
              className={styles.link}
              onClick={onOpen}
            >
              {t("updates.viewDetails")}
            </Button>
          )}
        </div>
      )}
    </div>
  );
}
