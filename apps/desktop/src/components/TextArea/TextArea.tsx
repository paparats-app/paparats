import type { ComponentPropsWithRef, ReactNode } from "react";
import { cx } from "../internal/cx";
import { Field } from "../TextField/Field";
import styles from "./TextArea.module.css";

export interface TextAreaProps extends ComponentPropsWithRef<"textarea"> {
  label?: ReactNode;
  hint?: ReactNode;
  error?: ReactNode;
  /** Class of the field wrapper; `className` styles the `<textarea>`. */
  fieldClassName?: string;
}

/** Multi-line input: padding 10/14, radius 9, 14px/1.5, vertical resize (report, idea, comment). */
export function TextArea({
  label,
  hint,
  error,
  id,
  rows = 4,
  className,
  fieldClassName,
  ...rest
}: TextAreaProps) {
  return (
    <Field label={label} hint={hint} error={error} id={id} className={fieldClassName}>
      {(control) => (
        <textarea {...rest} {...control} rows={rows} className={cx(styles.textarea, className)} />
      )}
    </Field>
  );
}
