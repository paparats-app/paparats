import { createContext, useContext, useId, type ReactNode } from "react";
import { useTranslation } from "react-i18next";
import { Checkbox } from "../Checkbox";
import { cx } from "../internal/cx";
import { RadioGroup, type RadioOption } from "../Radio";
import { SearchBox } from "../SearchBox";
import styles from "./FilterPanel.module.css";

export interface FilterPanelSearch {
  value: string;
  onChange: (value: string) => void;
  /** "Search filters…" by default (also the accessible name). */
  placeholder?: string;
}

export interface FilterPanelProps {
  /** Filter groups (`FilterGroup`), separated by 1px `--line` rules. */
  children: ReactNode;
  onClearAll: () => void;
  /** "Filters" by default. */
  title?: string;
  /** "Clear all" by default. */
  clearLabel?: string;
  /** The 32px live filter field under the header. */
  search?: FilterPanelSearch;
  /** Sticky at the top of the scroll area (default true). */
  sticky?: boolean;
  className?: string;
}

/**
 * Browse filter panel: `--card`, 1px `--line`, radius 12, padding 16 18 18, sticky; header with
 * "Clear all", compact search, then the groups (prototype lines 371–409).
 */
export function FilterPanel({
  children,
  onClearAll,
  title,
  clearLabel,
  search,
  sticky = true,
  className,
}: FilterPanelProps) {
  const { t } = useTranslation();
  const heading = title ?? t("common.filters");
  const headingId = useId();
  const placeholder = search?.placeholder ?? t("browse.searchFilters");
  return (
    <aside
      className={cx(styles.panel, sticky && styles.sticky, className)}
      aria-labelledby={headingId}
    >
      <div className={styles.header}>
        <h2 id={headingId} className={styles.title}>
          {heading}
        </h2>
        <button type="button" className={styles.clear} onClick={onClearAll}>
          {clearLabel ?? t("browse.clearAll")}
        </button>
      </div>
      {search && (
        <SearchBox
          variant="compact"
          value={search.value}
          onValueChange={search.onChange}
          label={placeholder}
          placeholder={placeholder}
          wrapperClassName={styles.search}
        />
      )}
      <div className={styles.groups}>{children}</div>
    </aside>
  );
}

const GroupLabelContext = createContext<string | undefined>(undefined);

export interface FilterGroupProps {
  /** 13px/600 group label ("Category", "Price", "Sort by"). */
  label: string;
  children: ReactNode;
  className?: string;
}

/** One labelled group of options; a 1px `--line` rule separates it from the previous group. */
export function FilterGroup({ label, children, className }: FilterGroupProps) {
  const labelId = useId();
  return (
    <div role="group" aria-labelledby={labelId} className={cx(styles.group, className)}>
      <div id={labelId} className={styles.groupLabel}>
        {label}
      </div>
      <GroupLabelContext value={labelId}>
        <div className={styles.options}>{children}</div>
      </GroupLabelContext>
    </div>
  );
}

export interface FilterCheckOptionProps {
  label: string;
  checked: boolean;
  onChange: (checked: boolean) => void;
  /** "Always on" rows (Free, Windows): checked, inert, box at .6 opacity. */
  disabled?: boolean;
  /** 6px tint dot before the label (Source group; per-item data colour). */
  dot?: string;
  /** Right-aligned count in `--text3` (Source group). */
  count?: string;
}

/** Checkbox option row: 16px box, 13px `--text2` label (hover `--text`), 6px vertical padding. */
export function FilterCheckOption({
  label,
  checked,
  onChange,
  disabled,
  dot,
  count,
}: FilterCheckOptionProps) {
  return (
    <Checkbox
      checked={checked}
      onChange={onChange}
      disabled={disabled}
      label={
        dot === undefined ? (
          label
        ) : (
          <span className={styles.dotLabel}>
            <span className={styles.dot} style={{ backgroundColor: dot }} aria-hidden="true" />
            <span className={styles.dotText}>{label}</span>
          </span>
        )
      }
      trailing={count !== undefined ? <span className={styles.count}>{count}</span> : undefined}
    />
  );
}

export interface FilterRadioOptionsProps<V extends string> {
  /** Shared `name` of the native radios. */
  name: string;
  value: V;
  onChange: (value: V) => void;
  options: ReadonlyArray<RadioOption<V>>;
}

/** Radio list for a `FilterGroup` (Sort by), labelled by the group label. */
export function FilterRadioOptions<V extends string>({
  name,
  value,
  onChange,
  options,
}: FilterRadioOptionsProps<V>) {
  const labelledBy = useContext(GroupLabelContext);
  return (
    <RadioGroup
      name={name}
      labelledBy={labelledBy}
      value={value}
      onChange={onChange}
      options={options}
    />
  );
}
