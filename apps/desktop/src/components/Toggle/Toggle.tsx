import type { ComponentPropsWithRef } from "react";
import { cx } from "../internal/cx";
import styles from "./Toggle.module.css";

export type ToggleSize = "md" | "sm";

export interface ToggleTrackProps {
  checked: boolean;
  /** `md` 44×24 with an 18px knob (settings); `sm` 34×20 with a 14px knob (channel page). */
  size?: ToggleSize;
  className?: string;
}

/**
 * The switch graphic alone, for use inside another control (the channel page's
 * "Enabled / Paused" button). Not focusable, hidden from assistive tech.
 */
export function ToggleTrack({ checked, size = "md", className }: ToggleTrackProps) {
  return (
    <span
      aria-hidden="true"
      className={cx(styles.track, styles[size], checked && styles.on, className)}
    >
      <span className={styles.knob} />
    </span>
  );
}

export interface ToggleProps extends Omit<
  ComponentPropsWithRef<"button">,
  "onChange" | "role" | "children"
> {
  checked: boolean;
  onChange: (checked: boolean) => void;
  size?: ToggleSize;
  /** Accessible name when there is no visible label wired via `aria-labelledby`. */
  label?: string;
}

/** On/off switch (`role="switch"`): `--mint` on, `--knob-off` off, knob slides in `--dur-fast`. */
export function Toggle({
  checked,
  onChange,
  size = "md",
  label,
  disabled,
  className,
  onClick,
  ...rest
}: ToggleProps) {
  return (
    <button
      {...rest}
      type="button"
      role="switch"
      aria-checked={checked}
      aria-label={label}
      disabled={disabled}
      className={cx(styles.switch, className)}
      onClick={(event) => {
        onClick?.(event);
        if (!event.defaultPrevented) onChange(!checked);
      }}
    >
      <ToggleTrack checked={checked} size={size} />
    </button>
  );
}
