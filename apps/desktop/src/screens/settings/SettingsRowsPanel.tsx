import { useId, useRef, useState } from "react";
import { useTranslation } from "react-i18next";
import { useNav, type NavTarget } from "@/app/navigation";
import { SettingsCard, SettingsRow } from "@/components/SettingsRow";
import {
  visibleSettingsRows,
  type SettingsLink,
  type SettingsRow as SettingsRowSchema,
  type SettingsRowSectionId,
} from "@/domain/settings";
import { LANGUAGES } from "@/i18n/languages";
import { useAccount, useAccountActions, useSettingsActions, useSystemActions } from "@/queries";
import type { Settings, UpdateSchedule } from "@/services/types";
import { useFirstLaunchStore } from "@/stores/useFirstLaunchStore";
import { useSettingsStore } from "@/stores/useSettingsStore";
import { useUiStore } from "@/stores/useUiStore";
import { hasAction, hasHint, isRowCopyId, type RowCopyId } from "./rowCopy";
import styles from "./SettingsScreen.module.css";

type BooleanSettingKey = {
  [K in keyof Settings]: Settings[K] extends boolean ? K : never;
}[keyof Settings];

const SCHEDULES: readonly UpdateSchedule[] = ["hourly", "daily", "weekly"];
const PARALLEL = ["1", "2", "4"] as const;

const LINK_TARGETS: Record<SettingsLink, NavTarget> = {
  profile: { to: "profile" },
  subscription: { to: "subscription" },
  dev: { to: "dev" },
};

function isBooleanSetting(settings: Settings, key: keyof Settings): key is BooleanSettingKey {
  return typeof settings[key] === "boolean";
}

/**
 * A row-card section (prototype lines 757–795; logic `// settings` › `rows`): the H2 title and one
 * card with the section's rows from `SETTINGS_ROWS` — the developer tools only while Developer
 * mode is on.
 */
export function SettingsRowsPanel({ section }: { section: SettingsRowSectionId }) {
  const { t } = useTranslation();
  const settings = useSettingsStore((s) => s.settings);
  const titleId = useId();
  const rows = visibleSettingsRows(section, settings);
  return (
    <section aria-labelledby={titleId}>
      <h2 id={titleId} className={styles.sectionTitle}>
        {t(`settings.sections.${section}`)}
      </h2>
      <SettingsCard className={styles.rows}>
        {rows.map((row) => (
          <ConnectedRow key={row.id} row={row} settings={settings} />
        ))}
      </SettingsCard>
    </section>
  );
}

interface ConnectedRowProps {
  row: SettingsRowSchema;
  settings: Settings;
}

/** One schema row wired to the settings store, the services and navigation. */
function ConnectedRow({ row, settings }: ConnectedRowProps) {
  const { t, i18n } = useTranslation();
  const { go } = useNav();
  const update = useSettingsStore((s) => s.update);
  const notify = useUiStore((s) => s.notify);
  const system = useSystemActions();
  const { clearSearchHistory } = useSettingsActions();
  const { signOut } = useAccountActions();
  const account = useAccount().data;
  const [signingOut, setSigningOut] = useState(false);
  const clearing = useRef(false);

  if (!isRowCopyId(i18n, row.id)) return null;
  const id: RowCopyId = row.id;
  const hint = hasHint(i18n, id) ? t(`settings.rows.${id}.hint`) : undefined;
  const actionLabel = hasAction(i18n, id) ? t(`settings.rows.${id}.action`) : "";
  let title: string = t(`settings.rows.${id}.title`, { email: "" });
  if (id === "signOut") {
    title =
      account && !account.signedIn
        ? t("settings.notSignedIn")
        : t("settings.rows.signOut.title", { email: account?.profile.email ?? "" });
  }

  switch (row.type) {
    case "theme":
      return (
        <SettingsRow
          type="theme"
          title={title}
          hint={hint}
          value={settings.theme}
          onChange={(theme) => void update({ theme })}
        />
      );
    case "language":
      return (
        <SettingsRow
          type="language"
          title={title}
          hint={hint}
          value={settings.locale}
          options={LANGUAGES}
          onChange={(locale) => void update({ locale })}
        />
      );
    case "toggle": {
      const key = row.setting;
      if (!key || !isBooleanSetting(settings, key)) return null;
      const onChange = (value: boolean) => {
        const patch: Partial<Settings> = {};
        patch[key] = value;
        void update(patch);
        // Start on Windows login is also registered with the system; undo the switch if that fails.
        if (key === "startup") {
          system.setAutostart(value).catch(() => void update({ startup: !value }));
        }
      };
      return (
        <SettingsRow
          type="toggle"
          title={title}
          hint={hint}
          checked={settings[key]}
          onChange={onChange}
        />
      );
    }
    case "select":
      if (row.setting === "schedule") {
        return (
          <SettingsRow
            type="select"
            title={title}
            hint={hint}
            value={settings.schedule}
            options={SCHEDULES.map((value) => ({
              value,
              label: t(`settings.options.schedule.${value}`),
            }))}
            onChange={(value) => {
              const schedule = SCHEDULES.find((s) => s === value);
              if (schedule) void update({ schedule });
            }}
          />
        );
      }
      if (row.setting === "parallel") {
        return (
          <SettingsRow
            type="select"
            title={title}
            hint={hint}
            value={String(settings.parallel)}
            options={PARALLEL.map((value) => ({
              value,
              label: t(`settings.options.parallel.${value}`),
            }))}
            // The downloads bridge hands the new limit to DownloadService at once.
            onChange={(value) => {
              const parallel = Number(value);
              if (Number.isInteger(parallel) && parallel >= 1) void update({ parallel });
            }}
          />
        );
      }
      return null;
    case "path":
      // "Change…" has no handler in the prototype (line 781): there is no folder picker yet.
      return (
        <SettingsRow type="path" title={title} value={settings.location} onChange={() => {}} />
      );
    case "action": {
      let onAction = () => {};
      let disabled = false;
      switch (row.action) {
        case "clearHistory":
          onAction = () => {
            if (clearing.current) return;
            clearing.current = true;
            clearSearchHistory()
              .then(() => notify(t("settings.historyCleared")))
              .catch(() => undefined)
              .finally(() => {
                clearing.current = false;
              });
          };
          break;
        case "signOut":
          disabled = account?.signedIn === false;
          onAction = () => {
            if (signingOut) return;
            setSigningOut(true);
            signOut()
              .then(() => notify(t("settings.signedOut")))
              .catch(() => undefined)
              .finally(() => setSigningOut(false));
          };
          break;
        case "replayFirstLaunch":
          onAction = () => useFirstLaunchStore.getState().replay();
          break;
        // configureProxy: the prototype's handler does nothing (`run = () => {}`).
        default:
          break;
      }
      return (
        <SettingsRow
          type="action"
          title={title}
          hint={hint}
          actionLabel={actionLabel}
          onAction={onAction}
          disabled={disabled}
          busy={row.action === "signOut" && signingOut}
        />
      );
    }
    case "link":
      return (
        <SettingsRow
          type="link"
          title={title}
          hint={hint}
          actionLabel={actionLabel}
          className={styles.linkRow}
          onClick={() => {
            if (row.link) go(LINK_TARGETS[row.link]);
          }}
        />
      );
    case "note":
      return <SettingsRow type="note" title={title} hint={hint} />;
  }
}
