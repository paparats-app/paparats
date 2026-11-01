import { useEffect } from "react";
import { useTranslation } from "react-i18next";
import { useLocation, useNavigate } from "react-router";
import { parsePath, pathOf } from "@/app/navigation";
import { Icon } from "@/components/Icon";
import { isRowSection, visibleSettingsSections, type SettingsSectionId } from "@/domain/settings";
import { useFeatures } from "@/hooks/useFeatures";
import { useSettingsStore } from "@/stores/useSettingsStore";
import { useUiStore } from "@/stores/useUiStore";
import { AboutPanel } from "./about";
import { SettingsRowsPanel } from "./SettingsRowsPanel";
import { SourcesPanel } from "./sources";
import styles from "./SettingsScreen.module.css";

/** The section a path shows: `/settings/<id>`, General for `/settings` or an unknown id. */
export function settingsSectionOf(pathname: string): SettingsSectionId {
  const target = parsePath(pathname);
  return target?.to === "settings" && target.section ? target.section : "general";
}

/**
 * Settings (prototype lines 747–796; logic `// settings`): H1 + subtitle, then the 250px section
 * nav beside the panel — Sources and About have their own panels, the others a row card. Sections
 * the catalog's features turn off, and row sections with nothing working yet, are not listed
 * outside Developer mode (D68).
 * Picking a section only swaps the panel, like the prototype's `setState({section})`: the route
 * changes (so a detail page can return to it) without the navigation skeleton or scroll reset.
 * The section shown is remembered, so Settings from the sidebar reopens it (`resolveTarget`).
 */
export function SettingsScreen() {
  const { t } = useTranslation();
  const navigate = useNavigate();
  const { pathname } = useLocation();
  const settings = useSettingsStore((s) => s.settings);
  const features = useFeatures();
  const sections = visibleSettingsSections(settings, features);
  const asked = settingsSectionOf(pathname);
  // A section the catalog or Developer mode hides falls back to General.
  const section = sections.some((s) => s.id === asked) ? asked : "general";
  const setSettingsSection = useUiStore((s) => s.setSettingsSection);

  useEffect(() => setSettingsSection(section), [section, setSettingsSection]);

  const pick = (id: SettingsSectionId) => {
    if (id !== section) void navigate(pathOf({ to: "settings", section: id }), { replace: true });
  };

  return (
    <div className={styles.screen}>
      <h1 className={styles.title}>{t("nav.settings")}</h1>
      <div className={styles.subtitle}>{t("settings.settingsSub")}</div>
      <div className={styles.columns}>
        <nav className={styles.nav} aria-label={t("settings.sectionsLabel")}>
          {sections.map(({ id, icon }) => {
            const active = id === section;
            return (
              <button
                key={id}
                type="button"
                className={active ? `${styles.navItem} ${styles.navItemActive}` : styles.navItem}
                aria-current={active ? "page" : undefined}
                onClick={() => pick(id)}
              >
                <Icon name={icon} size={18} />
                {t(`settings.sections.${id}`)}
              </button>
            );
          })}
        </nav>
        <div className={styles.panel}>
          {section === "about" ? (
            <AboutPanel />
          ) : section === "sources" ? (
            <SourcesPanel />
          ) : isRowSection(section) ? (
            <SettingsRowsPanel key={section} section={section} />
          ) : null}
        </div>
      </div>
    </div>
  );
}
