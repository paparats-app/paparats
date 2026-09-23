import { useId, useRef, type KeyboardEvent, type ReactNode } from "react";
import { useTranslation } from "react-i18next";
import type { Locale, ThemePreference } from "@/services/types";
import { Button } from "../Button";
import { Icon, type IconName } from "../Icon";
import { cx } from "../internal/cx";
import { rovingIndex } from "../internal/roving";
import { SegmentedControl } from "../SegmentedControl";
import { Select, type SelectOption } from "../Select";
import { Toggle } from "../Toggle";
import styles from "./SettingsRow.module.css";

export interface LanguageOption {
  code: Locale;
  /** Native name ("Беларуская"). */
  native: string;
}

interface RowBase {
  title: string;
  hint?: string;
  className?: string;
}

export type SettingsRowProps = RowBase &
  (
    | { type: "theme"; value: ThemePreference; onChange: (value: ThemePreference) => void }
    | {
        type: "language";
        value: Locale;
        options: readonly LanguageOption[];
        onChange: (value: Locale) => void;
        /**
         * What the selected option shows on the right: a mint check (Settings, the default) or
         * its ISO code like the others (Profile › Preferences, prototype line 915).
         */
        selectedMark?: "check" | "code";
      }
    | { type: "toggle"; checked: boolean; onChange: (checked: boolean) => void; disabled?: boolean }
    | {
        type: "select";
        value: string;
        options: ReadonlyArray<SelectOption<string>>;
        onChange: (value: string) => void;
      }
    /** Monospace value in place of the hint + "Change…". */
    | { type: "path"; value: string; onChange: () => void }
    | {
        type: "action";
        actionLabel: string;
        onAction: () => void;
        destructive?: boolean;
        /** Disables the button (e.g. Sign out while signed out or while it runs). */
        disabled?: boolean;
      }
    /** The whole row is a button with a `--mint2` label + chevron on the right. */
    | { type: "link"; actionLabel: string; onClick: () => void }
    /** 20px mint icon (shield by default) + title + body. */
    | { type: "note"; icon?: IconName }
  );

/**
 * One settings row (padding 16 20): label + hint on the left and the control on the right, per
 * row type (prototype lines 761–792). Put rows in a `SettingsCard`.
 */
export function SettingsRow(props: SettingsRowProps) {
  const { t } = useTranslation();
  const titleId = useId();
  const { title, hint, className } = props;
  const label = (hintNode: ReactNode = hint) => (
    <div className={styles.label}>
      <div id={titleId} className={styles.title}>
        {title}
      </div>
      {hintNode !== undefined && <div className={styles.hint}>{hintNode}</div>}
    </div>
  );

  switch (props.type) {
    case "theme":
      return (
        <div className={cx(styles.row, className)}>
          {label()}
          <SegmentedControl
            label={title}
            value={props.value}
            onChange={props.onChange}
            options={[
              { value: "light", label: t("common.themeLight") },
              { value: "dark", label: t("common.themeDark") },
              { value: "system", label: t("common.themeSystem") },
            ]}
          />
        </div>
      );
    case "language":
      return (
        <div className={cx(styles.row, styles.stacked, className)}>
          {label()}
          <LanguageGrid
            labelledBy={titleId}
            value={props.value}
            options={props.options}
            onChange={props.onChange}
            selectedMark={props.selectedMark ?? "check"}
          />
        </div>
      );
    case "toggle":
      return (
        <div className={cx(styles.row, className)}>
          {label()}
          <Toggle
            checked={props.checked}
            onChange={props.onChange}
            disabled={props.disabled}
            aria-labelledby={titleId}
          />
        </div>
      );
    case "select":
      return (
        <div className={cx(styles.row, className)}>
          {label()}
          <Select
            value={props.value}
            options={props.options}
            onChange={props.onChange}
            aria-labelledby={titleId}
            className={styles.select}
          />
        </div>
      );
    case "path":
      return (
        <div className={cx(styles.row, className)}>
          {label(<span className={styles.mono}>{props.value}</span>)}
          <Button size="compact" onClick={props.onChange}>
            {t("settings.change")}
          </Button>
        </div>
      );
    case "action":
      return (
        <div className={cx(styles.row, className)}>
          {label()}
          <Button
            size="compact"
            variant={props.destructive ? "destructive" : "secondary"}
            disabled={props.disabled}
            onClick={props.onAction}
          >
            {props.actionLabel}
          </Button>
        </div>
      );
    case "link":
      return (
        <button
          type="button"
          className={cx(styles.row, styles.linkRow, className)}
          onClick={props.onClick}
        >
          {label()}
          <span className={styles.linkLabel}>
            {props.actionLabel}
            <Icon name="chevron-right" size={14} strokeWidth={2} />
          </span>
        </button>
      );
    case "note":
      return (
        <div className={cx(styles.row, styles.note, className)}>
          <Icon name={props.icon ?? "shield"} size={20} className={styles.noteIcon} />
          {label()}
        </div>
      );
  }
}

interface LanguageGridProps {
  labelledBy: string;
  value: Locale;
  options: readonly LanguageOption[];
  onChange: (value: Locale) => void;
  selectedMark: "check" | "code";
}

/** 3-column grid of 40px language buttons: native name + mint check or the ISO code. */
function LanguageGrid({ labelledBy, value, options, onChange, selectedMark }: LanguageGridProps) {
  const refs = useRef<Array<HTMLButtonElement | null>>([]);
  const selected = options.findIndex((o) => o.code === value);
  const onKeyDown = (event: KeyboardEvent<HTMLButtonElement>, index: number) => {
    const next = rovingIndex(index, event.key, options.length, () => true);
    const option = next === null ? undefined : options[next];
    if (next === null || !option) return;
    event.preventDefault();
    refs.current[next]?.focus();
    if (option.code !== value) onChange(option.code);
  };
  return (
    <div role="radiogroup" aria-labelledby={labelledBy} className={styles.languages}>
      {options.map((option, index) => {
        const on = option.code === value;
        return (
          <button
            key={option.code}
            ref={(el) => {
              refs.current[index] = el;
            }}
            type="button"
            role="radio"
            aria-checked={on}
            lang={option.code}
            tabIndex={index === (selected >= 0 ? selected : 0) ? 0 : -1}
            className={cx(styles.language, on && styles.languageOn)}
            onClick={() => {
              if (!on) onChange(option.code);
            }}
            onKeyDown={(event) => onKeyDown(event, index)}
          >
            <span>{option.native}</span>
            {on && selectedMark === "check" ? (
              <Icon name="check" size={16} strokeWidth={2.4} className={styles.check} />
            ) : (
              <span className={styles.code} aria-hidden="true">
                {option.code.toUpperCase()}
              </span>
            )}
          </button>
        );
      })}
    </div>
  );
}
