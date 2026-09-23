import { AppActionButton, type AppActionView, type AppIconSource } from "../AppCard";
import { AppIcon } from "../AppIcon";
import { cx } from "../internal/cx";
import styles from "./CompactUpdatedRow.module.css";

export interface CompactUpdatedRowProps {
  name: string;
  icon: AppIconSource;
  version: string;
  /** Relative date, preformatted ("Updated 3 days ago"). */
  updated: string;
  action: AppActionView;
  onOpen?: () => void;
  className?: string;
}

/** Home › "Recently updated" row: 44px tile + name + "version · date" + 30px action (270–276). */
export function CompactUpdatedRow({
  name,
  icon,
  version,
  updated,
  action,
  onOpen,
  className,
}: CompactUpdatedRowProps) {
  return (
    <div className={cx(styles.row, className)}>
      <button type="button" className={styles.identity} onClick={onOpen}>
        <AppIcon
          mono={icon.mono}
          tint={icon.tint}
          iconUrl={icon.iconUrl}
          size={44}
          className={styles.icon}
        />
        <span className={styles.text}>
          <span className={styles.name}>{name}</span>
          <span className={styles.meta}>{`${version} · ${updated}`}</span>
        </span>
      </button>
      <AppActionButton action={action} size="xs" />
    </div>
  );
}
