// The onboarding steps on the night scene (prototype lines 1562–1622): Language, Appearance,
// Account, and the step indicator with Back. Each step renders in the current UI language and
// applies its choice at once through the settings store.
import type { Ref } from "react";
import { useTranslation } from "react-i18next";
import { Icon } from "@/components/Icon";
import { useLocale } from "@/hooks/useLocale";
import { LANGUAGES } from "@/i18n/languages";
import { useAccount, useSystemActions } from "@/queries";
import type { Locale, ThemePreference } from "@/services/types";
import { phaseIndex, type FirstLaunchPhase } from "@/stores/useFirstLaunchStore";
import { useSettingsStore } from "@/stores/useSettingsStore";
import { cx } from "./cx";
import styles from "./FirstLaunch.module.css";

/** "No account? Create one" opens the sign-up page in the default browser. */
export const SIGNUP_URL = "https://paparats.app/signup";

interface StepProps {
  /** The step container; it takes focus when the step appears. */
  stepRef?: Ref<HTMLDivElement>;
}

function ContinueButton({ onClick }: { onClick: () => void }) {
  const { t } = useTranslation();
  return (
    <button type="button" className={cx(styles.primary, styles.continue)} onClick={onClick}>
      {t("firstLaunch.continueBtn")}
      <Icon name="arrow-right" size={16} strokeWidth={2.2} />
    </button>
  );
}

function Check() {
  return (
    <span className={styles.check}>
      <Icon name="check" size={13} strokeWidth={2.6} />
    </span>
  );
}

/**
 * Language: English / Беларуская / Русский, each with the tagline in its own language; the
 * subtitle asks the same question in the other two. Picking one switches the app at once.
 */
export function LanguageStep({ stepRef, onContinue }: StepProps & { onContinue: () => void }) {
  const { t, i18n } = useTranslation();
  const locale = useLocale();
  const pick = (code: Locale) => void useSettingsStore.getState().update({ locale: code });
  const others = LANGUAGES.filter((l) => l.code !== locale)
    .map((l) => i18n.getFixedT(l.code)("firstLaunch.chooseLanguage"))
    .join(" · ");

  return (
    <div ref={stepRef} className={styles.step} tabIndex={-1} data-step="lang">
      <h1 className={styles.title}>{t("firstLaunch.chooseLanguage")}</h1>
      <div className={styles.subtitle}>{others}</div>
      <div className={styles.cards}>
        {LANGUAGES.map(({ code, native }) => {
          const on = code === locale;
          return (
            <button
              key={code}
              type="button"
              lang={code}
              className={cx(styles.card, styles.langCard, on && styles.cardOn)}
              aria-pressed={on}
              onClick={() => pick(code)}
            >
              <div className={styles.cardHead}>
                <span className={styles.native}>{native}</span>
                {on ? (
                  <Check />
                ) : (
                  <span className={styles.code} aria-hidden="true">
                    {code.toUpperCase()}
                  </span>
                )}
              </div>
              <div className={styles.tagline}>{i18n.getFixedT(code)("common.tagline")}</div>
            </button>
          );
        })}
      </div>
      <ContinueButton onClick={onContinue} />
      <div className={styles.hint}>{t("firstLaunch.changeLater")}</div>
    </div>
  );
}

const THEMES: readonly {
  id: ThemePreference;
  label: "common.themeLight" | "common.themeDark" | "common.themeSystem";
  preview: string | undefined;
}[] = [
  { id: "light", label: "common.themeLight", preview: styles.pvLight },
  { id: "dark", label: "common.themeDark", preview: styles.pvDark },
  { id: "system", label: "common.themeSystem", preview: styles.pvSystem },
];

/** Appearance: Light / Dark / System with a miniature shell each; applies instantly. */
export function AppearanceStep({ stepRef, onContinue }: StepProps & { onContinue: () => void }) {
  const { t } = useTranslation();
  const theme = useSettingsStore((s) => s.settings.theme);
  const pick = (id: ThemePreference) => void useSettingsStore.getState().update({ theme: id });

  return (
    <div ref={stepRef} className={styles.step} tabIndex={-1} data-step="theme">
      <h1 className={styles.title}>{t("firstLaunch.chooseTheme")}</h1>
      <div className={styles.subtitle}>{t("firstLaunch.themeIntroHint")}</div>
      <div className={styles.cards}>
        {THEMES.map(({ id, label, preview }) => {
          const on = id === theme;
          return (
            <button
              key={id}
              type="button"
              className={cx(styles.card, styles.themeCard, on && styles.cardOn)}
              aria-pressed={on}
              onClick={() => pick(id)}
            >
              <div className={cx(styles.preview, preview)} aria-hidden="true">
                <div className={styles.pvSide} />
                <div className={styles.pvPip} />
                <div className={styles.pvLine} />
                <div className={styles.pvLineLong} />
                <div className={styles.pvWide} />
                <div className={styles.pvLeft} />
                <div className={styles.pvRight} />
              </div>
              <div className={styles.cardHead}>
                <span className={styles.themeLabel}>{t(label)}</span>
                {on && <Check />}
              </div>
            </button>
          );
        })}
      </div>
      <ContinueButton onClick={onContinue} />
    </div>
  );
}

export interface AccountStepProps extends StepProps {
  email: string;
  password: string;
  onEmailChange: (email: string) => void;
  onPasswordChange: (password: string) => void;
  /** Sign in; `fallbackEmail` is the signed-in account's email, shown when none was typed. */
  onSignIn: (fallbackEmail: string | null) => void;
  onLater: () => void;
}

/** Account: email + password, Sign in, Later and "No account? Create one". */
export function AccountStep({
  stepRef,
  email,
  password,
  onEmailChange,
  onPasswordChange,
  onSignIn,
  onLater,
}: AccountStepProps) {
  const { t } = useTranslation();
  const account = useAccount().data;
  const { openExternal } = useSystemActions();
  const fallback = account?.signedIn ? account.profile.email : null;

  return (
    <div ref={stepRef} className={styles.step} tabIndex={-1} data-step="signin">
      <h1 className={styles.title}>{t("firstLaunch.signInTitle")}</h1>
      <div className={cx(styles.subtitle, styles.subtitleBright)}>{t("firstLaunch.signInSub")}</div>
      {/* No browser validation: like the prototype, any text signs in (the service checks it). */}
      <form
        className={styles.form}
        noValidate
        onSubmit={(event) => {
          event.preventDefault();
          onSignIn(fallback);
        }}
      >
        <input
          type="email"
          className={styles.field}
          value={email}
          onChange={(event) => onEmailChange(event.target.value)}
          placeholder={t("firstLaunch.emailPlaceholder")}
          aria-label={t("firstLaunch.emailLabel")}
          autoComplete="email"
          spellCheck={false}
        />
        <input
          type="password"
          className={styles.field}
          value={password}
          onChange={(event) => onPasswordChange(event.target.value)}
          placeholder={t("firstLaunch.passwordPlaceholder")}
          aria-label={t("firstLaunch.passwordPlaceholder")}
          autoComplete="current-password"
        />
        <button type="submit" className={cx(styles.primary, styles.signIn)}>
          {t("firstLaunch.signIn")}
        </button>
        <button type="button" className={styles.later} onClick={onLater}>
          {t("firstLaunch.later")}
        </button>
      </form>
      <button
        type="button"
        className={styles.create}
        onClick={() => void openExternal(SIGNUP_URL).catch(() => undefined)}
      >
        {t("firstLaunch.createAccount")}
      </button>
    </div>
  );
}

const INDICATOR: readonly {
  index: number;
  label: "common.language" | "firstLaunch.stepAppearance" | "common.tabAccount";
}[] = [
  { index: 5, label: "common.language" },
  { index: 6, label: "firstLaunch.stepAppearance" },
  { index: 7, label: "common.tabAccount" },
];

/** Back (steps 2–3) and the three steps: a filled mint dot for the current and past steps. */
export function StepIndicator({
  phase,
  onBack,
  hidden = false,
}: {
  phase: FirstLaunchPhase;
  onBack: () => void;
  /** Faded out (before the first step and during the exit): hidden from assistive tech. */
  hidden?: boolean;
}) {
  const { t } = useTranslation();
  const k = phaseIndex(phase);
  const canBack = phase === "theme" || phase === "signin";
  return (
    <div className={styles.indicator} aria-hidden={hidden || undefined}>
      {canBack && (
        <button type="button" className={styles.back} onClick={onBack}>
          <Icon name="chevron-left" size={14} strokeWidth={2} />
          {t("common.back")}
        </button>
      )}
      <ol className={styles.steps} aria-label={t("firstLaunch.stepsLabel")}>
        {INDICATOR.map(({ index, label }) => (
          <li
            key={index}
            className={styles.stepItem}
            aria-current={k === index ? "step" : undefined}
          >
            <span className={cx(styles.dot, k >= index && styles.dotOn)} />
            <span className={cx(styles.stepLabel, k === index && styles.stepLabelOn)}>
              {t(label)}
            </span>
          </li>
        ))}
      </ol>
    </div>
  );
}
