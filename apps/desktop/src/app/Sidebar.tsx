import { useMemo } from "react";
import { useTranslation } from "react-i18next";
import fernWatermark from "@/assets/images/paparats-fern-watermark.webp";
import logoMark from "@/assets/images/paparats-mark-light.webp";
import { CountPill } from "@/components/CountPill";
import { Icon, type IconName } from "@/components/Icon";
import { ProPill } from "@/components/ProPill";
import { releaseNotes } from "@/domain/ideas";
import { usePro } from "@/hooks/usePro";
import { useUpdates } from "@/hooks/useUpdates";
import { useViewAs } from "@/hooks/useViewAs";
import { useFormat } from "@/i18n/format";
import { useIdeas } from "@/queries";
import { useNav, type NavTarget, type Section } from "./navigation";
import styles from "./Sidebar.module.css";

type SidebarSection = Extract<
  Section,
  "home" | "browse" | "categories" | "updates" | "library" | "ideas" | "subscription" | "settings"
>;

interface Item {
  id: SidebarSection;
  icon: IconName;
}

const PRIMARY: readonly Item[] = [
  { id: "home", icon: "house" },
  { id: "browse", icon: "layout-grid" },
  { id: "categories", icon: "layers" },
  { id: "updates", icon: "download" },
  { id: "library", icon: "book-open" },
  { id: "ideas", icon: "lightbulb" },
];

const SECONDARY: readonly Item[] = [
  { id: "subscription", icon: "crown" },
  { id: "settings", icon: "settings" },
];

/** The sidebar's Browse item resets every filter (the curated view); other items just go. */
function targetOf(id: SidebarSection): NavTarget {
  return id === "browse" ? { to: "browse", filters: {} } : { to: id };
}

/**
 * Left sidebar (prototype lines 60–124): brand, primary nav with the Updates and Ideas badges,
 * divider, Subscription (Pro pill) and Settings, fern watermark, footer. The active item follows
 * the section, so a detail page keeps the section it was opened from highlighted.
 */
export function Sidebar() {
  const { t } = useTranslation();
  const format = useFormat();
  const { go, section } = useNav();
  const updates = useUpdates().count;
  const { isPro } = usePro();
  const viewAs = useViewAs();
  const ideas = useIdeas().data;
  const notes = useMemo(() => releaseNotes(ideas ?? [], viewAs).length, [ideas, viewAs]);

  const badge = (id: SidebarSection) => {
    if (id === "updates" && updates > 0) {
      return (
        <CountPill
          value={format.number(updates)}
          label={t("updates.updatesAvailable", { count: updates })}
        />
      );
    }
    if (id === "ideas" && notes > 0) return <CountPill value={format.number(notes)} />;
    if (id === "subscription" && isPro) return <ProPill label={t("common.pro")} variant="soft" />;
    return null;
  };

  const renderItem = ({ id, icon }: Item) => {
    const active = section === id;
    return (
      <li key={id}>
        <button
          type="button"
          className={active ? `${styles.item} ${styles.active}` : styles.item}
          aria-current={active ? "page" : undefined}
          onClick={() => go(targetOf(id))}
        >
          <Icon name={icon} size={20} />
          <span className={styles.label}>{t(`nav.${id}`)}</span>
          {badge(id)}
        </button>
      </li>
    );
  };

  return (
    <nav className={styles.sidebar} aria-label={t("shell.mainNav")}>
      <button type="button" className={styles.brand} onClick={() => go({ to: "home" })}>
        <img className={styles.mark} src={logoMark} alt="" width={50} height={50} />
        <span className={styles.brandText}>
          <span className={styles.brandName}>{t("shell.brand")}</span>
          <span className={styles.brandNative} lang="be">
            {t("shell.brandNative")}
          </span>
        </span>
      </button>

      <ul className={styles.list}>{PRIMARY.map(renderItem)}</ul>
      <div className={styles.divider} role="presentation" />
      <ul className={styles.list}>{SECONDARY.map(renderItem)}</ul>

      <div className={styles.spacer} />
      <img className={styles.watermark} src={fernWatermark} alt="" aria-hidden="true" />
      <div className={styles.footer}>
        <div className={styles.footerName}>{t("shell.brand")}</div>
        <div className={styles.tagline}>{t("common.tagline")}</div>
      </div>
    </nav>
  );
}
