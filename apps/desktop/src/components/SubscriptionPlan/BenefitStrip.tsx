import { Icon, type IconName } from "../Icon";
import { cx } from "../internal/cx";
import styles from "./BenefitStrip.module.css";

export interface Benefit {
  icon: IconName | (string & Record<never, never>);
  title: string;
  subtitle: string;
}

export interface BenefitStripProps {
  items: readonly Benefit[];
  className?: string;
}

/** Subscription benefit strip: equal cells in one bordered card, 1px `--line` separators (693–697). */
export function BenefitStrip({ items, className }: BenefitStripProps) {
  return (
    <ul
      className={cx(styles.strip, className)}
      style={{ gridTemplateColumns: `repeat(${Math.max(1, items.length)}, minmax(0, 1fr))` }}
    >
      {items.map((item) => (
        <li key={item.title} className={styles.cell}>
          <Icon name={item.icon} size={26} className={styles.icon} />
          <div className={styles.title}>{item.title}</div>
          <div className={styles.sub}>{item.subtitle}</div>
        </li>
      ))}
    </ul>
  );
}
