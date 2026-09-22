import type { ComponentPropsWithRef, MouseEvent, ReactElement } from "react";
import { Icon, type IconName } from "../Icon";
import { cx } from "../internal/cx";
import styles from "./Button.module.css";

/**
 * - `primary` mint fill / `--ink` text · `secondary` `--card2` + 1px `--line2` (the default)
 * - `ghost` no chrome, `--text2` → `--text` · `outline` 1px `--line2`, transparent
 * - `destructive` `--danger` text on a `--danger-border` outline
 * - `onImage` translucent ghost for banners/heroes · `primaryOnImage` theme-independent mint CTA
 * - `link` inline text action in `--mint2`
 */
export type ButtonVariant =
  | "primary"
  | "secondary"
  | "ghost"
  | "outline"
  | "destructive"
  | "onImage"
  | "primaryOnImage"
  | "link";

/**
 * Heights: `xs` 30 · `compact` 32 (card/row actions) · `sm` 34 · `md` 36 · `field` 38 (next to
 * 38px inputs) · `lg` 40 · `xl` 42 (banner actions). Radii 7/7/8/8/9/10/10.
 */
export type ButtonSize = "xs" | "compact" | "sm" | "md" | "field" | "lg" | "xl";

/** Text colour override on neutral surfaces: `progress` `--mint2`, `quiet` `--text2`, `muted` `--text3`. */
export type ButtonTone = "default" | "progress" | "quiet" | "muted";

/** An icon name from the registry, or any element (e.g. an `AppIcon`). */
export type ButtonIconSlot = IconName | ReactElement;

export interface ButtonProps extends ComponentPropsWithRef<"button"> {
  variant?: ButtonVariant;
  size?: ButtonSize;
  tone?: ButtonTone;
  leadingIcon?: ButtonIconSlot;
  trailingIcon?: ButtonIconSlot;
  /** Shows a spinner in place of the leading icon and ignores clicks. */
  loading?: boolean;
  fullWidth?: boolean;
  /** Fully rounded ends (hero CTAs). */
  pill?: boolean;
}

export const BUTTON_ICON_SIZE: Record<ButtonSize, number> = {
  xs: 14,
  compact: 16,
  sm: 16,
  md: 16,
  field: 16,
  lg: 18,
  xl: 18,
};

const TONE_CLASS: Record<ButtonTone, string | undefined> = {
  default: undefined,
  progress: styles.toneProgress,
  quiet: styles.toneQuiet,
  muted: styles.toneMuted,
};

function slot(icon: ButtonIconSlot | undefined, size: number) {
  if (icon === undefined) return null;
  return typeof icon === "string" ? <Icon name={icon} size={size} /> : icon;
}

export function Button({
  variant = "secondary",
  size = "md",
  tone = "default",
  leadingIcon,
  trailingIcon,
  loading = false,
  fullWidth = false,
  pill = false,
  type = "button",
  className,
  children,
  onClick,
  ...rest
}: ButtonProps) {
  const iconSize = BUTTON_ICON_SIZE[size];
  const hasLabel = children !== undefined && children !== null && children !== false;
  const handleClick = (event: MouseEvent<HTMLButtonElement>) => {
    if (loading) {
      event.preventDefault();
      return;
    }
    onClick?.(event);
  };
  return (
    <button
      {...rest}
      type={type}
      className={cx(
        styles.button,
        styles[variant],
        styles[size],
        TONE_CLASS[tone],
        fullWidth && styles.fullWidth,
        pill && styles.pill,
        loading && styles.loading,
        className,
      )}
      data-variant={variant}
      data-size={size}
      aria-busy={loading || undefined}
      onClick={handleClick}
    >
      {loading ? (
        <Icon name="loader-circle" size={iconSize} className={styles.spinner} />
      ) : (
        slot(leadingIcon, iconSize)
      )}
      {hasLabel && <span className={styles.label}>{children}</span>}
      {slot(trailingIcon, iconSize)}
    </button>
  );
}

export interface IconButtonProps extends Omit<
  ButtonProps,
  "leadingIcon" | "trailingIcon" | "children" | "fullWidth" | "pill"
> {
  icon: IconName;
  /** Accessible name (there is no visible text). */
  label: string;
  /** Glyph size; defaults to the size scale's icon size. */
  iconSize?: number;
  /** Circular instead of the size's radius. */
  round?: boolean;
}

/** Square icon-only button (close ×, overflow ⋯, expand chevron, list/grid, …). Ghost by default. */
export function IconButton({
  icon,
  label,
  iconSize,
  round = false,
  variant = "ghost",
  size = "compact",
  className,
  ...rest
}: IconButtonProps) {
  return (
    <Button
      {...rest}
      variant={variant}
      size={size}
      aria-label={label}
      className={cx(styles.iconOnly, round && styles.round, className)}
      leadingIcon={iconSize === undefined ? icon : <Icon name={icon} size={iconSize} />}
    />
  );
}
