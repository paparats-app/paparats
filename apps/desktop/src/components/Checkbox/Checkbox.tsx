import type { ComponentPropsWithRef, ReactNode } from "react";
import { Icon } from "../Icon";
import { cx } from "../internal/cx";
import styles from "./Checkbox.module.css";

export interface CheckboxProps extends Omit<
  ComponentPropsWithRef<"input">,
  "type" | "onChange" | "checked" | "defaultChecked" | "size"
> {
  checked: boolean;
  onChange: (checked: boolean) => void;
  /** Visible label (13px `--text2`, hover `--text`). Without it pass `aria-label`. */
  label?: ReactNode;
  /** Trailing content in the row (e.g. a count in `--text3`). */
  trailing?: ReactNode;
  className?: string;
}

/** 16px checkbox, radius 4, `--mint` fill with an 11px `--ink` check (filter panel). */
export function Checkbox({
  checked,
  onChange,
  label,
  trailing,
  className,
  ...rest
}: CheckboxProps) {
  return (
    <label className={cx(styles.row, rest.disabled && styles.disabled, className)}>
      <input
        {...rest}
        type="checkbox"
        className={styles.native}
        checked={checked}
        onChange={(event) => onChange(event.target.checked)}
      />
      <span className={cx(styles.box, checked && styles.checked)} aria-hidden="true">
        {checked && <Icon name="check" size={11} strokeWidth={3} />}
      </span>
      {label !== undefined && <span className={styles.label}>{label}</span>}
      {trailing}
    </label>
  );
}
