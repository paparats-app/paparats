import {
  AppActionButton,
  type AppActionView,
  type AppIconSource,
  type ChannelMark,
} from "../AppCard";
import { AppIcon } from "../AppIcon";
import { Chip } from "../Chip";
import { cx } from "../internal/cx";
import styles from "./NotableRow.module.css";

export interface NotableRowProps {
  name: string;
  icon: AppIconSource;
  tagline: string;
  category?: string;
  channel?: ChannelMark;
  action: AppActionView;
  onOpen?: () => void;
  className?: string;
}

/** Browse › "New and notable" wide row (2 columns): 52px tile, text, 34px action (328–334). */
export function NotableRow({
  name,
  icon,
  tagline,
  category,
  channel,
  action,
  onOpen,
  className,
}: NotableRowProps) {
  return (
    <div className={cx(styles.row, className)}>
      <button type="button" className={styles.identity} onClick={onOpen}>
        <AppIcon mono={icon.mono} tint={icon.tint} iconUrl={icon.iconUrl} size={52} />
        <span className={styles.text}>
          <span className={styles.name}>{name}</span>
          <span className={styles.tagline}>{tagline}</span>
          {(category !== undefined || channel !== undefined) && (
            <span className={styles.chips}>
              {category !== undefined && <Chip wrap>{category}</Chip>}
              {channel && (
                <Chip tone="outline" dot={channel.tint}>
                  {channel.name}
                </Chip>
              )}
            </span>
          )}
        </span>
      </button>
      <AppActionButton action={action} size="sm" strong className={styles.action} />
    </div>
  );
}
