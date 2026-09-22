import { useTranslation } from "react-i18next";
import { Icon } from "@/components/Icon";
import { SearchBox } from "@/components/SearchBox";
import { initials } from "@/domain/text";
import { useAccount } from "@/queries";
import { useUiStore } from "@/stores/useUiStore";
import { useNav } from "./navigation";
import styles from "./TopBar.module.css";

/**
 * Top bar (prototype lines 101–110): the global search (typing switches the content to results
 * on every screen) and the avatar button to Profile. The bar doubles as a window drag region.
 */
export function TopBar() {
  const { t } = useTranslation();
  const { go } = useNav();
  const query = useUiStore((s) => s.query);
  const setQuery = useUiStore((s) => s.setQuery);
  const name = useAccount().data?.profile.name ?? "";

  return (
    <header className={styles.bar} data-tauri-drag-region>
      <SearchBox
        value={query}
        onValueChange={(value) => setQuery(value)}
        label={t("shell.search")}
        placeholder={t("shell.search")}
      />
      <button
        type="button"
        className={styles.avatar}
        aria-label={t("nav.profile")}
        onClick={() => go({ to: "profile" })}
      >
        <span className={styles.circle} aria-hidden="true">
          {initials(name)}
        </span>
        <Icon name="chevron-down" size={14} strokeWidth={2} />
      </button>
    </header>
  );
}
