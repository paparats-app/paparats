import { useRef, type KeyboardEvent } from "react";
import { Icon, type IconName } from "../Icon";
import { cx } from "../internal/cx";
import { rovingIndex } from "../internal/roving";
import styles from "./SegmentedControl.module.css";

export interface SegmentedOption<V extends string> {
  value: V;
  label?: string;
  icon?: IconName;
  /** Required for icon-only options. */
  ariaLabel?: string;
  disabled?: boolean;
}

export interface SegmentedControlProps<V extends string> {
  options: ReadonlyArray<SegmentedOption<V>>;
  value: V;
  onChange: (value: V) => void;
  /** Accessible name of the group. */
  label: string;
  /**
   * `sm`: 30px options, track radius 8, 2px padding (theme switcher, list/grid toggle).
   * `md`: 36px options, track radius 10, 3px padding (dialog kind toggle).
   */
  size?: "sm" | "md";
  /** Track ground: `bg` (settings rows, dialogs) or `card` (toolbars). */
  ground?: "bg" | "card";
  /** Stretch the options to fill the width. */
  fullWidth?: boolean;
  disabled?: boolean;
  /** Stroke of the 16px option icons (default 1.75; the Library list/grid toggle draws 2). */
  iconStrokeWidth?: number;
  className?: string;
}

/** One-of-N switch (`role="radiogroup"`): arrow keys move and select, active option `--card2`. */
export function SegmentedControl<V extends string>({
  options,
  value,
  onChange,
  label,
  size = "sm",
  ground = "bg",
  fullWidth = false,
  disabled = false,
  iconStrokeWidth,
  className,
}: SegmentedControlProps<V>) {
  const optionRefs = useRef<Array<HTMLButtonElement | null>>([]);
  const isEnabled = (i: number) => !disabled && !options[i]?.disabled;
  const selected = options.findIndex((o) => o.value === value);
  const tabStop =
    selected >= 0 && isEnabled(selected) ? selected : options.findIndex((_, i) => isEnabled(i));

  const onKeyDown = (event: KeyboardEvent<HTMLButtonElement>, index: number) => {
    const next = rovingIndex(index, event.key, options.length, isEnabled);
    const option = next === null ? undefined : options[next];
    if (next === null || !option) return;
    event.preventDefault();
    optionRefs.current[next]?.focus();
    if (option.value !== value) onChange(option.value);
  };

  return (
    <div
      role="radiogroup"
      aria-label={label}
      aria-disabled={disabled || undefined}
      className={cx(
        styles.track,
        styles[size],
        styles[ground],
        fullWidth && styles.fullWidth,
        className,
      )}
    >
      {options.map((option, index) => {
        const active = index === selected;
        const iconOnly = !option.label && option.icon !== undefined;
        return (
          <button
            key={option.value}
            ref={(el) => {
              optionRefs.current[index] = el;
            }}
            type="button"
            role="radio"
            aria-checked={active}
            aria-label={option.ariaLabel}
            disabled={!isEnabled(index)}
            tabIndex={index === tabStop ? 0 : -1}
            className={cx(styles.option, active && styles.active, iconOnly && styles.iconOnly)}
            onClick={() => {
              if (!active) onChange(option.value);
            }}
            onKeyDown={(event) => onKeyDown(event, index)}
          >
            {option.icon && <Icon name={option.icon} size={16} strokeWidth={iconStrokeWidth} />}
            {option.label}
          </button>
        );
      })}
    </div>
  );
}
