import type { ComponentPropsWithRef } from "react";
import { Icon } from "../Icon";
import { cx } from "../internal/cx";
import styles from "./SearchBox.module.css";

export interface SearchBoxProps extends Omit<
  ComponentPropsWithRef<"input">,
  "type" | "value" | "defaultValue" | "onChange" | "size"
> {
  value: string;
  onValueChange: (value: string) => void;
  /** Accessible name (the placeholder is not a label). */
  label: string;
  /**
   * `topbar`: 466×40 pill, 18px icon at 15/11, `--input` ground.
   * `compact`: 32px filter-panel field, 15px icon at 10/9, `--bg` ground.
   */
  variant?: "topbar" | "compact";
  /** Class of the wrapper (layout); `className` styles the `<input>`. */
  wrapperClassName?: string;
}

/** Search field. Escape clears a non-empty value (and stops there). */
export function SearchBox({
  value,
  onValueChange,
  label,
  variant = "topbar",
  wrapperClassName,
  className,
  onKeyDown,
  ...rest
}: SearchBoxProps) {
  const topbar = variant === "topbar";
  return (
    <div className={cx(styles.wrap, styles[variant], wrapperClassName)}>
      <Icon name="search" size={topbar ? 18 : 15} className={styles.icon} />
      <input
        {...rest}
        type="search"
        aria-label={label}
        className={cx(styles.input, className)}
        value={value}
        spellCheck={false}
        autoComplete="off"
        onChange={(event) => onValueChange(event.target.value)}
        onKeyDown={(event) => {
          onKeyDown?.(event);
          if (event.defaultPrevented) return;
          if (event.key === "Escape" && value !== "") {
            event.preventDefault();
            event.stopPropagation();
            onValueChange("");
          }
        }}
      />
    </div>
  );
}
