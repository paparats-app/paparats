import type { ComponentPropsWithRef } from "react";
import { Icon } from "../Icon";
import { cx } from "../internal/cx";
import styles from "./Select.module.css";

export interface SelectOption<V extends string> {
  value: V;
  label: string;
  disabled?: boolean;
}

export interface SelectProps<V extends string> extends Omit<
  ComponentPropsWithRef<"select">,
  "value" | "defaultValue" | "onChange" | "size" | "multiple" | "children"
> {
  value: V;
  onChange: (value: V) => void;
  options: ReadonlyArray<SelectOption<V>>;
  /** `sm` 34px radius 8 (settings rows, toolbars) · `lg` 40px radius 9 (dialog forms). */
  size?: "sm" | "lg";
  /** `bg` settings rows · `card` toolbars · `input` dialog forms. */
  ground?: "bg" | "card" | "input";
  fullWidth?: boolean;
  /** Class of the wrapper (layout); `className` styles the `<select>`. */
  wrapperClassName?: string;
}

/** Native `<select>` with the design's chevron (14px, `--text2`). */
export function Select<V extends string>({
  value,
  onChange,
  options,
  size = "sm",
  ground = "bg",
  fullWidth = false,
  wrapperClassName,
  className,
  ...rest
}: SelectProps<V>) {
  return (
    <span
      className={cx(styles.wrap, styles[size], fullWidth && styles.fullWidth, wrapperClassName)}
    >
      <select
        {...rest}
        className={cx(styles.select, styles[ground], className)}
        value={value}
        onChange={(event) => {
          const next = options.find((o) => o.value === event.target.value);
          if (next) onChange(next.value);
        }}
      >
        {options.map((option) => (
          <option key={option.value} value={option.value} disabled={option.disabled}>
            {option.label}
          </option>
        ))}
      </select>
      <Icon name="chevron-down" size={14} strokeWidth={2} className={styles.chevron} />
    </span>
  );
}
