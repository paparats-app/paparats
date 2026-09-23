import { useId, useState } from "react";
import { useTranslation } from "react-i18next";
import { Button } from "@/components/Button";
import { Icon, type IconName } from "@/components/Icon";
import { PromoCard } from "@/components/PromoCard";
import { SettingsCard, SettingsRow } from "@/components/SettingsRow";
import { pickLocalized } from "@/domain/text";
import { useLocale } from "@/hooks";
import { LANGUAGES } from "@/i18n/languages";
import { useFormat } from "@/i18n/format";
import { useAccountActions } from "@/queries";
import { useBusyAction } from "@/screens/shared";
import type { Device, Profile } from "@/services/types";
import { useProfileStore } from "@/stores/useProfileStore";
import { useSettingsStore } from "@/stores/useSettingsStore";
import { noteKeyboard } from "./keyboard";
import styles from "./ProfileScreen.module.css";

interface InfoRow {
  key: string;
  icon: IconName;
  label: string;
  value: string;
}

/**
 * Account: "Account information" (five rows; each opens the header's edit mode) and the promo
 * card (prototype lines 902–911).
 */
export function AccountPanel({ profile }: { profile: Profile }) {
  const { t } = useTranslation();
  const locale = useLocale();
  const startEdit = useProfileStore((s) => s.startEdit);
  const rows: InfoRow[] = [
    { key: "name", icon: "user", label: t("profile.name"), value: profile.name },
    { key: "email", icon: "mail", label: t("profile.email"), value: profile.email },
    {
      key: "country",
      icon: "globe",
      label: t("profile.country"),
      value: pickLocalized(profile.country, locale),
    },
    {
      key: "language",
      icon: "globe",
      label: t("common.language"),
      value: LANGUAGES.find((l) => l.code === locale)?.native ?? "",
    },
    {
      key: "timezone",
      icon: "clock",
      label: t("profile.timezone"),
      value: pickLocalized(profile.timezone, locale),
    },
  ];
  return (
    <>
      <h2 className={styles.h2}>{t("profile.accountInfo")}</h2>
      <div className={styles.panelCard}>
        {rows.map((row) => (
          <button
            key={row.key}
            type="button"
            className={styles.infoRow}
            onClick={(event) => {
              noteKeyboard(event);
              startEdit(profile);
            }}
          >
            <Icon name={row.icon} size={18} className={styles.infoIcon} />
            <span className={styles.infoLabel}>{row.label}</span>
            <span className={styles.infoValue}>{row.value}</span>
            <Icon name="chevron-right" size={16} strokeWidth={2} className={styles.infoChevron} />
          </button>
        ))}
      </div>
      <PromoCard
        variant="profile"
        title={t("profile.promoProfTitle")}
        body={t("profile.promoProfBody")}
        className={styles.promo}
      />
    </>
  );
}

/** Preferences: theme and language, applied at once like Settings › General (lines 912–917). */
export function PreferencesPanel() {
  const { t } = useTranslation();
  const theme = useSettingsStore((s) => s.settings.theme);
  const locale = useSettingsStore((s) => s.settings.locale);
  const update = useSettingsStore((s) => s.update);
  return (
    <SettingsCard label={t("profile.tabPreferences")} className={styles.panelCardTop}>
      <SettingsRow
        type="theme"
        title={t("profile.prefTheme")}
        hint={t("common.themeHint")}
        value={theme}
        onChange={(value) => void update({ theme: value })}
      />
      <SettingsRow
        type="language"
        title={t("profile.prefLanguage")}
        hint={t("common.languageHint")}
        value={locale}
        options={LANGUAGES}
        // The profile grid keeps the language code on every option (no check mark).
        selectedMark="code"
        onChange={(value) => void update({ locale: value })}
      />
    </SettingsCard>
  );
}

/**
 * Security: password, two-factor, active sessions (lines 918–924). "Change…" and "Sign out
 * everywhere" do nothing, as in the prototype; the switch writes `twoFactor` through the account
 * service and moves at once. The sessions hint counts the signed-in devices (the prototype's
 * fixed "2 devices signed in." is the same string for its two devices).
 */
export function SecurityPanel({ twoFactor, devices }: { twoFactor: boolean; devices: number }) {
  const { t } = useTranslation();
  const { setTwoFactor } = useAccountActions();
  // The switch shows the requested value until the account carries it (the query cache tells its
  // observers a tick after the write), so the knob never slides back and forth.
  const [pending, setPending] = useState<boolean | null>(null);
  if (pending !== null && pending === twoFactor) setPending(null);
  const toggle = async (enabled: boolean) => {
    setPending(enabled);
    try {
      await setTwoFactor(enabled);
    } catch {
      // No failure copy in the handoff: the switch falls back to the stored value.
      setPending(null);
    }
  };
  return (
    <SettingsCard label={t("profile.tabSecurity")} className={styles.panelCardTop}>
      <SettingsRow
        type="action"
        title={t("profile.password")}
        hint={t("profile.passwordHint")}
        actionLabel={t("profile.changePassword")}
        onAction={() => undefined}
      />
      <SettingsRow
        type="toggle"
        title={t("profile.twoFactor")}
        hint={t("profile.twoFactorHint")}
        checked={pending ?? twoFactor}
        onChange={(enabled) => void toggle(enabled)}
      />
      <SettingsRow
        type="action"
        title={t("profile.sessions")}
        hint={t("profile.sessionsHint", { count: devices })}
        actionLabel={t("profile.signOutAll")}
        onAction={() => undefined}
      />
    </SettingsCard>
  );
}

/** Devices: one row per device; every device but this one has Remove (lines 925–931). */
export function DevicesPanel({ devices }: { devices: readonly Device[] }) {
  const { t } = useTranslation();
  return (
    <ul className={styles.panelCardTop} aria-label={t("profile.tabDevices")}>
      {devices.map((device) => (
        <DeviceRow key={device.id} device={device} />
      ))}
    </ul>
  );
}

function DeviceRow({ device }: { device: Device }) {
  const { t } = useTranslation();
  const format = useFormat();
  const { removeDevice } = useAccountActions();
  const [removing, runRemove] = useBusyAction();
  const ids = { name: useId(), remove: useId() };
  return (
    <li className={styles.device}>
      <div className={styles.deviceTile}>
        <Icon name="monitor" size={20} />
      </div>
      <div className={styles.deviceText}>
        <div className={styles.deviceHead}>
          <span id={ids.name} className={styles.deviceName}>
            {device.name}
          </span>
          {device.current && <span className={styles.thisDevice}>{t("profile.thisDevice")}</span>}
        </div>
        <div className={styles.deviceMeta}>
          {device.os} · {t("profile.lastActive", { when: format.relative(device.lastActive) })}
        </div>
      </div>
      {!device.current && (
        <Button
          id={ids.remove}
          size="compact"
          // "Remove Surface Laptop 7" for assistive tech; the visible label stays "Remove".
          aria-labelledby={`${ids.remove} ${ids.name}`}
          loading={removing}
          onClick={() => {
            // No failure copy in the handoff: on an error the row simply stays.
            void runRemove(() => removeDevice(device.id).catch(() => undefined));
          }}
        >
          {t("profile.removeDevice")}
        </Button>
      )}
    </li>
  );
}

/**
 * Data & Privacy: export and delete (lines 932–937). Both buttons do nothing, as in the
 * prototype — deleting an account is never a single click.
 */
export function DataPanel() {
  const { t } = useTranslation();
  return (
    <SettingsCard label={t("profile.tabData")} className={styles.panelCardTop}>
      <SettingsRow
        type="action"
        title={t("profile.exportData")}
        hint={t("profile.exportHint")}
        actionLabel={t("profile.exportBtn")}
        onAction={() => undefined}
      />
      <SettingsRow
        type="action"
        title={t("profile.deleteAccount")}
        hint={t("profile.deleteHint")}
        prettyHint
        actionLabel={t("profile.deleteBtn")}
        destructive
        onAction={() => undefined}
      />
    </SettingsCard>
  );
}
