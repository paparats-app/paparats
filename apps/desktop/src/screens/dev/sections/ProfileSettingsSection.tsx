import accountJson from "@fixtures/account.json";
import { useState } from "react";
import { useTranslation } from "react-i18next";
import { ProfileHeader, type ProfileDraft } from "@/components/ProfileHeader";
import { SettingsCard, SettingsRow } from "@/components/SettingsRow";
import { initials } from "@/domain/text";
import { LANGUAGES, toLocale } from "@/i18n/languages";
import type { Locale, ThemePreference } from "@/services/types";
import { Specimen } from "./Gallery";
import { DesignFrame } from "./DesignFrame";
import { noop, useSample, WIDTH } from "./sampleData";

const PROFILE = accountJson.profile;
const INSTALL_PATH = String.raw`C:\Program Files\Paparats\Apps`;

/** ProfileHeader view ⇄ edit (Edit profile / Save / Cancel). */
export function ProfileHeaderSection() {
  const { format } = useSample();
  const [profile, setProfile] = useState<ProfileDraft>({
    name: PROFILE.name,
    email: PROFILE.email,
  });
  const [draft, setDraft] = useState<ProfileDraft>(profile);
  const [editing, setEditing] = useState(false);
  return (
    <Specimen caption="ProfileHeader editing=false ⇄ true (click Edit profile)" wide>
      <DesignFrame width={WIDTH.profile}>
        <ProfileHeader
          name={profile.name}
          email={profile.email}
          initials={initials(profile.name)}
          memberSince={format.month(PROFILE.since)}
          editing={editing}
          draft={draft}
          onDraftChange={setDraft}
          onEdit={() => {
            setDraft(profile);
            setEditing(true);
          }}
          onSave={() => {
            setProfile(draft);
            setEditing(false);
          }}
          onCancel={() => setEditing(false)}
          onChangePhoto={noop}
          photoLabel={PROFILE.name}
        />
      </DesignFrame>
    </Specimen>
  );
}

/** Every SettingsRow type in one SettingsCard; the controls hold local demo state. */
export function SettingsRowsSection() {
  const { t, i18n } = useTranslation();
  const [theme, setTheme] = useState<ThemePreference>("dark");
  const [language, setLanguage] = useState<Locale>(toLocale(i18n.language));
  const [auto, setAuto] = useState(true);
  const [schedule, setSchedule] = useState("daily");
  return (
    <Specimen
      caption='SettingsCard › SettingsRow type="theme" | "language" | "toggle" | "select" | "path" | "action" | "link" | "note"'
      wide
    >
      <DesignFrame width={WIDTH.settings}>
        <SettingsCard label={t("settings.sections.general")}>
          <SettingsRow
            type="theme"
            title={t("settings.rows.theme.title")}
            hint={t("settings.rows.theme.hint")}
            value={theme}
            onChange={setTheme}
          />
          <SettingsRow
            type="language"
            title={t("settings.rows.language.title")}
            hint={t("settings.rows.language.hint")}
            value={language}
            options={LANGUAGES}
            onChange={setLanguage}
          />
          <SettingsRow
            type="toggle"
            title={t("settings.rows.auto.title")}
            hint={t("settings.rows.auto.hint")}
            checked={auto}
            onChange={setAuto}
          />
          <SettingsRow
            type="select"
            title={t("settings.rows.schedule.title")}
            hint={t("settings.rows.schedule.hint")}
            value={schedule}
            options={[
              { value: "hourly", label: t("settings.options.schedule.hourly") },
              { value: "daily", label: t("settings.options.schedule.daily") },
              { value: "weekly", label: t("settings.options.schedule.weekly") },
            ]}
            onChange={setSchedule}
          />
          <SettingsRow
            type="path"
            title={t("settings.rows.location.title")}
            value={INSTALL_PATH}
            onChange={noop}
          />
          <SettingsRow
            type="action"
            title={t("settings.rows.history.title")}
            hint={t("settings.rows.history.hint")}
            actionLabel={t("settings.rows.history.action")}
            onAction={noop}
          />
          <SettingsRow
            type="link"
            title={t("settings.rows.profileLink.title")}
            hint={t("settings.rows.profileLink.hint")}
            actionLabel={t("settings.rows.profileLink.action")}
            onClick={noop}
          />
          <SettingsRow
            type="note"
            title={t("settings.rows.telemetryNote.title")}
            hint={t("settings.rows.telemetryNote.hint")}
          />
        </SettingsCard>
      </DesignFrame>
    </Specimen>
  );
}
