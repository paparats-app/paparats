import { useId, useRef, type KeyboardEvent } from "react";
import { CountPill } from "../CountPill";
import { Icon, type IconName } from "../Icon";
import { cx } from "../internal/cx";
import { rovingIndex } from "../internal/roving";
import styles from "./Tabs.module.css";

export interface TabItem<V extends string> {
  value: V;
  label: string;
  /** Count pill after the label (boxed tabs: `--mint-soft`/`--mint2`). */
  count?: number | string;
  /** 16px leading icon (underline tabs). */
  icon?: IconName;
  disabled?: boolean;
}

export interface TabsProps<V extends string> {
  items: ReadonlyArray<TabItem<V>>;
  value: V;
  onChange: (value: V) => void;
  /** Accessible name of the tab list. */
  label: string;
  /**
   * `boxed`: `--card` strip, 1px `--line`, radius 10, padding 3; 34px tabs, active `--card2`
   * (Library, Ideas). `underline`: 42px tabs over a 1px `--line` rule, active `--text` with a 2px
   * mint bar inset 10px (Profile).
   */
  variant?: "boxed" | "underline";
  /** Called when the already selected tab is clicked (Library: back to the tab's start). */
  onReselect?: (value: V) => void;
  /** Maps a tab to the id of the panel it controls (sets `aria-controls`). */
  panelId?: (value: V) => string;
  className?: string;
}

/** Tab list (`role="tablist"`). Arrow keys / Home / End move and activate; one tab stop. */
export function Tabs<V extends string>({
  items,
  value,
  onChange,
  label,
  variant = "boxed",
  onReselect,
  panelId,
  className,
}: TabsProps<V>) {
  const baseId = useId();
  const tabRefs = useRef<Array<HTMLButtonElement | null>>([]);
  const isEnabled = (i: number) => !items[i]?.disabled;
  const selected = items.findIndex((item) => item.value === value);
  const tabStop =
    selected >= 0 && isEnabled(selected) ? selected : items.findIndex((_, i) => isEnabled(i));

  const onKeyDown = (event: KeyboardEvent<HTMLButtonElement>, index: number) => {
    const next = rovingIndex(index, event.key, items.length, isEnabled, "horizontal");
    const item = next === null ? undefined : items[next];
    if (next === null || !item) return;
    event.preventDefault();
    tabRefs.current[next]?.focus();
    if (item.value !== value) onChange(item.value);
  };

  return (
    <div
      role="tablist"
      aria-label={label}
      aria-orientation="horizontal"
      className={cx(styles.list, styles[variant], className)}
    >
      {items.map((item, index) => {
        const active = index === selected;
        return (
          <button
            key={item.value}
            ref={(el) => {
              tabRefs.current[index] = el;
            }}
            id={`${baseId}-tab-${item.value}`}
            type="button"
            role="tab"
            aria-selected={active}
            aria-controls={panelId?.(item.value)}
            disabled={item.disabled}
            tabIndex={index === tabStop ? 0 : -1}
            className={cx(styles.tab, active && styles.active)}
            onClick={() => {
              if (!active) onChange(item.value);
              else onReselect?.(item.value);
            }}
            onKeyDown={(event) => onKeyDown(event, index)}
          >
            {item.icon && <Icon name={item.icon} size={16} />}
            {item.label}
            {item.count !== undefined && <CountPill value={item.count} tone="soft" />}
          </button>
        );
      })}
    </div>
  );
}
