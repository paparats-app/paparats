import { useNav } from "@/app/navigation";
import { Icon } from "@/components/Icon";
import styles from "./BackLink.module.css";

/**
 * The detail pages' "‹ Back" (app, channel) and "‹ Ideas" (idea): returns to the path the page was
 * opened from (`useNav().back()`).
 */
export function BackLink({ label }: { label: string }) {
  const { back } = useNav();
  return (
    <button type="button" className={styles.back} onClick={back}>
      <Icon name="chevron-left" size={16} strokeWidth={2} />
      {label}
    </button>
  );
}
