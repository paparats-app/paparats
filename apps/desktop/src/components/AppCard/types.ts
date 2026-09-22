import type { SplitButtonTone } from "../SplitButton";

/** What an app/channel tile needs: the publisher icon, else the monogram on its tint. */
export interface AppIconSource {
  mono: string;
  /** Per-item data colour (`#rrggbb`). */
  tint: string;
  iconUrl?: string | null;
}

/**
 * Colour of the primary card/row action — `useAppAction().tone` plus `quiet` (`--text2`, e.g.
 * "Updated just now"): neutral `--card2`/`--text` · primary `--mint`/`--ink` · progress `--mint2`
 * text · quiet `--text2` · muted `--text3`.
 */
export type AppActionTone = SplitButtonTone;

/** The primary action as the screen resolved it (label, colour, state, handler). */
export interface AppActionView {
  /** Get / Open / Update / Subscribe / Offline / Queued / Installing… / 43% · Pause / Resume. */
  label: string;
  tone?: AppActionTone;
  disabled?: boolean;
  onClick?: () => void;
}

/** A source channel shown as an outline chip with a 6px tint dot. */
export interface ChannelMark {
  name: string;
  /** Per-item data colour. */
  tint: string;
}
