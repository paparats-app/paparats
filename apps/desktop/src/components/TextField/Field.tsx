import { useId, type ReactNode } from "react";
import { Icon } from "../Icon";
import { cx } from "../internal/cx";
import styles from "./Field.module.css";

export interface FieldControlProps {
  id: string;
  "aria-invalid": true | undefined;
  "aria-describedby": string | undefined;
}

export interface FieldProps {
  /** Visible label (13px/600) above the control. */
  label?: ReactNode;
  /** Helper text (12.5px `--text3`) below; replaced by `error` when present. */
  hint?: ReactNode;
  /** Inline error (12.5px `--danger` with an alert icon); marks the control invalid. */
  error?: ReactNode;
  /** Use this id for the control instead of a generated one. */
  id?: string;
  className?: string;
  /** Renders the control, wired to the label, hint and error. */
  children: (control: FieldControlProps) => ReactNode;
}

/** Label + control + hint/error wrapper shared by `TextField`, `TextArea` and custom controls. */
export function Field({ label, hint, error, id, className, children }: FieldProps) {
  const autoId = useId();
  const controlId = id ?? `${autoId}-control`;
  const messageId = `${controlId}-message`;
  const hasError = error !== undefined && error !== null && error !== false && error !== "";
  const message = hasError ? error : hint;
  const hasMessage =
    message !== undefined && message !== null && message !== false && message !== "";
  return (
    <div className={cx(styles.field, className)}>
      {label !== undefined && (
        <label className={styles.label} htmlFor={controlId}>
          {label}
        </label>
      )}
      {children({
        id: controlId,
        "aria-invalid": hasError ? true : undefined,
        "aria-describedby": hasMessage ? messageId : undefined,
      })}
      {hasMessage && (
        <div id={messageId} className={hasError ? styles.error : styles.hint}>
          {hasError && (
            <Icon name="triangle-alert" size={14} strokeWidth={2.2} className={styles.errorIcon} />
          )}
          <span>{message}</span>
        </div>
      )}
    </div>
  );
}
