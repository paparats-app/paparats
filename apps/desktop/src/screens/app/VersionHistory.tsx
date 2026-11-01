import { useId, useState } from "react";
import { useTranslation } from "react-i18next";
import { versionHistory } from "@/domain/appDetail";
import { manifestOf } from "@/domain/apps";
import { pickLocalized } from "@/domain/text";
import { useInstallState, useLocale } from "@/hooks";
import { useFormat } from "@/i18n/format";
import type { App, Catalog } from "@/services/types";
import page from "./AppScreen.module.css";
import styles from "./VersionHistory.module.css";

/** Versions shown before "Show all versions". */
const COLLAPSED = 2;

/**
 * Four generated versions, newest first, two shown until expanded; the catalog version is
 * "Current", an older installed one "Installed" (prototype lines 1085–1096). An app from the real
 * catalog shows only its current release with the notes from GitHub, in the author's words:
 * the bot keeps no history, and made-up versions would be fiction (D68).
 */
export function VersionHistory({ app, catalog }: { app: App; catalog: Catalog }) {
  const { t } = useTranslation();
  const format = useFormat();
  const locale = useLocale();
  const listId = useId();
  const { installedVersion } = useInstallState(app.id);
  const [expanded, setExpanded] = useState(false);
  const generated = versionHistory(
    app,
    manifestOf(catalog.updates, app.id),
    catalog.genericNotes,
    installedVersion,
  );
  const real = app.source !== undefined && app.source !== null;
  const versions = real ? generated.slice(0, 1) : generated;
  const shown = expanded ? versions : versions.slice(0, COLLAPSED);

  return (
    <>
      <h2 className={`${page.heading} ${styles.heading}`}>{t("app.versionHistory")}</h2>
      <div className={styles.card}>
        <div id={listId}>
          {shown.map((entry) => (
            <div key={entry.version} className={styles.row}>
              <div className={styles.version}>
                <span className={styles.number}>{entry.version}</span>
                {entry.isCurrent && (
                  <span className={`${styles.pill} ${styles.current}`}>{t("app.current")}</span>
                )}
                {entry.isInstalled && (
                  <span className={`${styles.pill} ${styles.installed}`}>
                    {t("common.installed")}
                  </span>
                )}
              </div>
              <div className={styles.meta}>
                {format.date(entry.date)}
                <br />
                {format.size(entry.sizeMb)}
              </div>
              <ul className={styles.notes}>
                {pickLocalized(entry.notes, locale).map((note, i) => (
                  <li key={i} className={styles.note}>
                    <span className={styles.bullet} aria-hidden="true" />
                    {note}
                  </li>
                ))}
              </ul>
            </div>
          ))}
        </div>
        {real ? (
          <div className={styles.source}>{t("app.notesFromGitHub")}</div>
        ) : (
          <button
            type="button"
            className={styles.toggle}
            aria-expanded={expanded}
            aria-controls={listId}
            onClick={() => setExpanded((open) => !open)}
          >
            {expanded ? t("app.showLess") : t("app.showAll")}
          </button>
        )}
      </div>
    </>
  );
}
