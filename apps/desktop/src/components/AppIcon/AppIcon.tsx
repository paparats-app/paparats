import { useState } from "react";
import { cx } from "../internal/cx";
import styles from "./AppIcon.module.css";

/** Tile sizes used by the design (px). Radius and monogram size follow the prototype per size. */
export const APP_ICON_SIZES = [16, 22, 24, 28, 34, 36, 40, 44, 48, 52, 56, 72, 96, 140] as const;
export type AppIconSize = (typeof APP_ICON_SIZES)[number];

export interface AppIconProps {
  /** Two-letter monogram shown when there is no `iconUrl` (or it fails to load). */
  mono: string;
  /** Monogram tile colour (`#rrggbb`, per-item data colour). */
  tint: string;
  /** Publisher icon from the catalog; absent = monogram tile. */
  iconUrl?: string | null;
  size?: AppIconSize;
  /** Floating tile with `--shadow-tile` (Browse featured hero, 140px). */
  floating?: boolean;
  /** Accessible name (app name). Without it the tile is decorative. */
  label?: string;
  className?: string;
}

/** App or channel icon: the publisher's image when present, else the monogram on its tint. */
export function AppIcon({
  mono,
  tint,
  iconUrl,
  size = 48,
  floating = false,
  label,
  className,
}: AppIconProps) {
  // Remember which URL failed so a new `iconUrl` gets its own chance to load.
  const [failedUrl, setFailedUrl] = useState<string | null>(null);
  const showImage = Boolean(iconUrl) && iconUrl !== failedUrl;
  return (
    <span
      className={cx(styles.tile, styles[`s${size}`], floating && styles.floating, className)}
      style={showImage ? undefined : { backgroundColor: tint }}
      role={label ? "img" : undefined}
      aria-label={label}
      aria-hidden={label ? undefined : true}
      data-size={size}
    >
      {showImage && iconUrl ? (
        <img
          className={styles.image}
          src={iconUrl}
          alt=""
          draggable={false}
          onError={() => setFailedUrl(iconUrl)}
        />
      ) : (
        mono
      )}
    </span>
  );
}
