import type { ComponentPropsWithRef, ReactNode } from "react";
import { cx } from "../internal/cx";
import styles from "./Radio.module.css";

export interface RadioProps extends Omit<
  ComponentPropsWithRef<"input">,
  "type" | "onChange" | "checked" | "defaultChecked" | "size"
> {
  checked: boolean;
  /** Called when this option becomes selected. */
  onSelect: () => void;
  label?: ReactNode;
  className?: string;
}

/** 16px circle with an 8px `--mint` dot. Group radios with a shared `name` (or use `RadioGroup`). */
export function Radio({ checked, onSelect, label, className, ...rest }: RadioProps) {
  return (
    <label className={cx(styles.row, rest.disabled && styles.disabled, className)}>
      <input
        {...rest}
        type="radio"
        className={styles.native}
        checked={checked}
        onChange={(event) => {
          if (event.target.checked) onSelect();
        }}
      />
      <span className={cx(styles.circle, checked && styles.checked)} aria-hidden="true">
        <span className={styles.dot} />
      </span>
      {label !== undefined && <span className={styles.label}>{label}</span>}
    </label>
  );
}

export interface RadioOption<V extends string> {
  value: V;
  label: ReactNode;
  disabled?: boolean;
}

export interface RadioGroupProps<V extends string> {
  /** Shared `name` of the native radios (arrow keys move within the group). */
  name: string;
  /** Accessible name of the group; or reference a visible heading with `labelledBy`. */
  label?: string;
  labelledBy?: string;
  value: V;
  onChange: (value: V) => void;
  options: ReadonlyArray<RadioOption<V>>;
  className?: string;
}

/** Vertical radio list (Browse › Sort by). */
export function RadioGroup<V extends string>({
  name,
  label,
  labelledBy,
  value,
  onChange,
  options,
  className,
}: RadioGroupProps<V>) {
  return (
    <div
      role="radiogroup"
      aria-label={label}
      aria-labelledby={labelledBy}
      className={cx(styles.group, className)}
    >
      {options.map((option) => (
        <Radio
          key={option.value}
          name={name}
          value={option.value}
          label={option.label}
          disabled={option.disabled}
          checked={option.value === value}
          onSelect={() => onChange(option.value)}
        />
      ))}
    </div>
  );
}
