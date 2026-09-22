import { Skeleton } from "@/components/Skeleton";
import styles from "./NavigationSkeleton.module.css";

const CARDS = [0, 1, 2, 3, 4, 5];
const WIDE = [0, 1, 2];

/**
 * The 420 ms placeholder after a navigation (prototype lines 135–150): hero, a section title,
 * six cards rippling .12s apart, another title, three wide rows .2s apart.
 */
export function NavigationSkeleton() {
  return (
    <div className={styles.skeleton} aria-busy="true" data-testid="navigation-skeleton">
      <Skeleton height={220} radius={12} />
      <Skeleton height={18} width={180} radius={6} animated={false} />
      <div className={styles.cards}>
        {CARDS.map((i) => (
          <Skeleton key={i} height={148} index={i} />
        ))}
      </div>
      <Skeleton height={18} width={140} radius={6} animated={false} />
      <div className={styles.wide}>
        {WIDE.map((i) => (
          <Skeleton key={i} height={96} index={i} stagger={0.2} />
        ))}
      </div>
    </div>
  );
}
