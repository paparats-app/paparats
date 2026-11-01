import type { CSSProperties } from "react";
import { useTranslation } from "react-i18next";
import { Icon } from "@/components/Icon";
import { SearchBox } from "@/components/SearchBox";
import { initials } from "@/domain/text";
import { useDeveloperChannel, useFeatures, useViewAs } from "@/hooks";
import { useAccount } from "@/queries";
import { useUiStore } from "@/stores/useUiStore";
import { useNav } from "./navigation";
import styles from "./TopBar.module.css";

/**
 * Top bar (prototype lines 101–110): the global search (typing switches the content to results
 * on every screen) and the avatar button to Profile — the profile initials, or in the developer
 * view the acting channel's monogram on its tint (prototype `avatarText` / `avatarBg`, D16). The
 * avatar is there only when the catalog turns accounts on (D68). The bar doubles as a window
 * drag region.
 */
export function TopBar() {
  const { t } = useTranslation();
  const { go } = useNav();
  const query = useUiStore((s) => s.query);
  const setQuery = useUiStore((s) => s.setQuery);
  const name = useAccount().data?.profile.name ?? "";
  const developer = useDeveloperChannel().channel;
  const devTile = useViewAs() === "developer" ? developer : undefined;
  const { account } = useFeatures();

  return (
    <header className={styles.bar} data-tauri-drag-region>
      <SearchBox
        value={query}
        onValueChange={(value) => setQuery(value)}
        label={t("shell.search")}
        placeholder={t("shell.search")}
      />
      {account && (
        <button
          type="button"
          className={styles.avatar}
          aria-label={t("nav.profile")}
          onClick={() => go({ to: "profile" })}
        >
          <span
            className={devTile ? `${styles.circle} ${styles.tinted}` : styles.circle}
            style={devTile ? ({ "--tint": devTile.tint } as CSSProperties) : undefined}
            aria-hidden="true"
          >
            {devTile ? devTile.mono : initials(name)}
          </span>
          <Icon name="chevron-down" size={14} strokeWidth={2} />
        </button>
      )}
    </header>
  );
}
