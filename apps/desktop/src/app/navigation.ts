// Navigation: route paths, the typed `go()` targets and the section a detail screen returns to
// (docs/architecture.md §7). The prototype's `go()` is the reference (Paparats Prototype.dc.html,
// `go(screen, extra)` in the logic block).
import { useCallback, useMemo } from "react";
import { useLocation, useNavigate } from "react-router";
import type { BrowseFilters } from "@/domain/apps";
import { SETTINGS_SECTIONS, type SettingsSectionId } from "@/domain/settings";
import type { AppId, ChannelId } from "@/services/types";
import { selectBrowseFilters, useBrowseStore } from "@/stores/useBrowseStore";
import { useDownloadsStore } from "@/stores/useDownloadsStore";
import { useIdeasStore } from "@/stores/useIdeasStore";
import { useLibraryStore } from "@/stores/useLibraryStore";
import { useSettingsStore } from "@/stores/useSettingsStore";
import { useUiStore } from "@/stores/useUiStore";

/** Screens with a route of their own; the sidebar highlights one of them. */
export type Section =
  | "home"
  | "browse"
  | "categories"
  | "updates"
  | "library"
  | "ideas"
  | "subscription"
  | "settings"
  | "profile"
  | "dev";

export const SECTIONS: readonly Section[] = [
  "home",
  "browse",
  "categories",
  "updates",
  "library",
  "ideas",
  "subscription",
  "settings",
  "profile",
  "dev",
];

export type NavTarget =
  | { to: Exclude<Section, "browse" | "ideas" | "settings"> }
  /** `filters` given: every Browse filter reset, then the preset (sidebar, categories). Absent:
   *  the filters stay and only the source filter clears (the prototype's plain `go('browse')`). */
  | { to: "browse"; filters?: Partial<BrowseFilters> }
  /** `appFilter` given (an app id or `null`): the board shows that app's ideas (or all). */
  | { to: "ideas"; appFilter?: AppId | null }
  | { to: "settings"; section?: SettingsSectionId }
  | { to: "app"; appId: AppId }
  | { to: "channel"; channelId: ChannelId }
  | { to: "idea"; ideaId: string };

export type DetailTarget = Extract<NavTarget, { to: "app" | "channel" | "idea" }>;

/** Router location state of a detail screen: the path it returns to. */
export interface NavState {
  from: string;
}

export function isSection(value: string): value is Section {
  return (SECTIONS as readonly string[]).includes(value);
}

function isSettingsSection(value: string): value is SettingsSectionId {
  return SETTINGS_SECTIONS.some((s) => s.id === value);
}

export function isDetail(target: NavTarget): target is DetailTarget {
  return target.to === "app" || target.to === "channel" || target.to === "idea";
}

export function pathOf(target: NavTarget): string {
  switch (target.to) {
    case "app":
      return `/app/${encodeURIComponent(target.appId)}`;
    case "channel":
      return `/channel/${encodeURIComponent(target.channelId)}`;
    case "idea":
      return `/ideas/${encodeURIComponent(target.ideaId)}`;
    case "settings":
      return target.section ? `/settings/${target.section}` : "/settings";
    default:
      return `/${target.to}`;
  }
}

/** The target a path shows (without Browse/Ideas presets); `null` for an unknown path. */
export function parsePath(pathname: string): NavTarget | null {
  const [first = "", second, ...rest] = pathname.replace(/^\/+|\/+$/g, "").split("/");
  if (rest.length > 0) return null;
  const id = second === undefined ? undefined : decodeURIComponent(second);
  if (first === "app" && id) return { to: "app", appId: id };
  if (first === "channel" && id) return { to: "channel", channelId: id };
  if (first === "ideas" && id) return { to: "idea", ideaId: id };
  if (first === "settings") {
    return id && isSettingsSection(id) ? { to: "settings", section: id } : { to: "settings" };
  }
  if (id !== undefined || !isSection(first)) return null;
  return { to: first };
}

/** The section a path belongs to; `null` for detail screens and unknown paths. */
export function sectionOfPath(pathname: string): Section | null {
  const target = parsePath(pathname);
  return target && !isDetail(target) ? target.to : null;
}

function returnPathOf(state: unknown): string | null {
  if (typeof state !== "object" || state === null || !("from" in state)) return null;
  const { from } = state;
  return typeof from === "string" && parsePath(from) !== null ? from : null;
}

/**
 * The section the sidebar highlights: the current section, or for a detail screen the section it
 * was opened from (Home when it was opened directly).
 */
export function activeSection(pathname: string, state: unknown): Section {
  const own = sectionOfPath(pathname);
  if (own) return own;
  const from = returnPathOf(state);
  return (from && sectionOfPath(from)) || "home";
}

/** Where `back()` goes from a location: the stored return path, else Home. */
export function returnPath(pathname: string, state: unknown): string {
  if (sectionOfPath(pathname)) return pathname;
  return returnPathOf(state) ?? "/home";
}

/**
 * The initial route of a plain-browser session from the URL hash (`#/dev` opens the component
 * gallery); anything else starts at Home. Inside Tauri there is no hash.
 */
export function initialPathFromHash(hash: string): string {
  const path = hash.replace(/^#/, "");
  return path && parsePath(path) ? path : "/home";
}

export interface Nav {
  /** The section the sidebar highlights (see `activeSection`). */
  section: Section;
  go(target: NavTarget): void;
  /** Detail screens: back to the section they were opened from. */
  back(): void;
}

/**
 * Every navigation clears the search, closes the Library overflow menu, bumps `navCount` (the
 * content scrolls to the top and replays the enter animation) and shows the 420 ms skeleton
 * unless animations are off. Leaving Updates clears the "Updated just now" markers (README:
 * "until you leave the screen").
 */
export function useNav(): Nav {
  const navigate = useNavigate();
  const { pathname, state } = useLocation();
  const section = activeSection(pathname, state);

  const go = useCallback(
    (target: NavTarget) => {
      if (sectionOfPath(pathname) === "updates" && target.to !== "updates") {
        useDownloadsStore.getState().clearJustUpdated();
      }
      if (target.to === "browse") {
        const browse = useBrowseStore.getState();
        if (target.filters) browse.apply(target.filters);
        else browse.apply({ ...selectBrowseFilters(browse), sources: [] });
      }
      if (target.to === "ideas" && target.appFilter !== undefined) {
        useIdeasStore.getState().focusApp(target.appFilter);
      }
      useLibraryStore.getState().closeMenu();
      useUiStore
        .getState()
        .beginNavigation({ skeleton: useSettingsStore.getState().settings.animations });
      // A detail opened from another detail keeps the original return path.
      const nav: NavState | null = isDetail(target) ? { from: returnPath(pathname, state) } : null;
      void navigate(pathOf(target), { state: nav });
    },
    [navigate, pathname, state],
  );

  const back = useCallback(() => {
    const target = parsePath(returnPath(pathname, state)) ?? { to: "home" };
    go(target);
  }, [go, pathname, state]);

  return useMemo(() => ({ section, go, back }), [section, go, back]);
}
