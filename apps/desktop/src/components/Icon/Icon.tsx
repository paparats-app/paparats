import type { SVGProps } from "react";
import { cx } from "../internal/cx";
import { FALLBACK_ICON, ICONS, isIconName, type IconName } from "./registry";
import styles from "./Icon.module.css";

export interface IconProps extends Omit<SVGProps<SVGSVGElement>, "name" | "ref" | "size"> {
  /**
   * Lucide kebab-case name from the registry. Plain strings are accepted so data (fixtures,
   * settings schema) can name icons; an unknown name draws `circle-dashed`.
   */
  name: IconName | (string & Record<never, never>);
  /** Square size in px. Default 20 (nav, cards). */
  size?: number;
  /** Default 1.75 per the design; 2–2.2 for small glyphs, 2.4–3 for checks. */
  strokeWidth?: number;
  /** Accessible name. Without it the icon is decorative (`aria-hidden`). */
  label?: string;
}

/**
 * Outline icon (lucide) with the design's stroke and round caps/joins. The glyph is the
 * prototype's drawing of that icon (`registry.ts`). SVG props pass through, e.g.
 * `strokeLinecap="butt"` for the window controls, which the prototype draws with square ends.
 */
export function Icon({
  name,
  size = 20,
  strokeWidth = 1.75,
  label,
  className,
  ...rest
}: IconProps) {
  const known = isIconName(name);
  const Glyph = known ? ICONS[name] : FALLBACK_ICON;
  return (
    <Glyph
      {...rest}
      size={size}
      strokeWidth={strokeWidth}
      className={cx(styles.icon, className)}
      focusable="false"
      role={label ? "img" : undefined}
      aria-label={label}
      aria-hidden={label ? undefined : true}
      data-icon={name}
      data-missing-icon={known ? undefined : true}
    />
  );
}
