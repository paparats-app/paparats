import { useTranslation } from "react-i18next";
import { useLocation, useNavigate } from "react-router";
import { parsePath, pathOf } from "@/app/navigation";
import { Icon } from "@/components/Icon";
import { isRowSection, SETTINGS_SECTIONS, type SettingsSectionId } from "@/domain/settings";
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
 * nav beside the panel — Sources and About have their own panels, the other eight a row card.
 * Picking a section only swaps the panel, like the prototype's `setState({section})`: the route
 * changes (so a detail page can return to it) without the navigation skeleton or scroll reset.
 */
export function SettingsScreen() {
  const { t } = useTranslation();
  const navigate = useNavigate();
  const { pathname } = useLocation();
  const section = settingsSectionOf(pathname);

  const pick = (id: SettingsSectionId) => {
    if (id !== section) void navigate(pathOf({ to: "settings", section: id }), { replace: true });
  };

  return (
    <div className={styles.screen}>
      <h1 className={styles.title}>{t("nav.settings")}</h1>
      <div className={styles.subtitle}>{t("settings.settingsSub")}</div>
      <div className={styles.columns}>
        <nav className={styles.nav} aria-label={t("settings.sectionsLabel")}>
          {SETTINGS_SECTIONS.map(({ id, icon }) => {
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
