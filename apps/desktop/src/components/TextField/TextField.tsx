import type { ComponentPropsWithRef, ReactNode } from "react";
import { cx } from "../internal/cx";
import { Field } from "./Field";
import styles from "./TextField.module.css";

export interface TextFieldProps extends Omit<ComponentPropsWithRef<"input">, "size"> {
  label?: ReactNode;
  hint?: ReactNode;
  error?: ReactNode;
  /** `md` 38px (profile edit) · `lg` 40px (dialog forms). Radius 9. */
  size?: "md" | "lg";
  /** Monospace value (paths, versions stay tabular anyway). */
  mono?: boolean;
  /** Class of the field wrapper; `className` styles the `<input>`. */
  fieldClassName?: string;
}

/** Text input on `--input`, focus border `--mint`, error border `--danger` + message. */
export function TextField({
  label,
  hint,
  error,
  size = "md",
  mono = false,
  id,
  type = "text",
  className,
  fieldClassName,
  ...rest
}: TextFieldProps) {
  return (
    <Field label={label} hint={hint} error={error} id={id} className={fieldClassName}>
      {(control) => (
        <input
          {...rest}
          {...control}
          type={type}
          className={cx(styles.input, styles[size], mono && styles.mono, className)}
        />
      )}
    </Field>
  );
}
