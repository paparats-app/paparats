// Ideas board: tabs per view, status filter, sorting, the developer's apps and release helpers.
import type { App, AppId, ChannelId, ChannelInfo, Idea, IdeaStatus } from "@/services/types";

export type ViewAs = "user" | "developer";

export type UserIdeaTab = "all" | "new" | "app" | "mine";
export type DeveloperIdeaTab = "all" | "new" | "myapps" | "mywork";
export type IdeaTab = UserIdeaTab | DeveloperIdeaTab;
export type IdeaSort = "top" | "new";

/** Tabs in display order for each view. */
export const IDEA_TABS: {
  readonly user: readonly UserIdeaTab[];
  readonly developer: readonly DeveloperIdeaTab[];
} = {
  user: ["all", "new", "app", "mine"],
  developer: ["all", "new", "myapps", "mywork"],
};

export const IDEA_STATUSES: readonly IdeaStatus[] = ["open", "work", "released"];

/** The stored tab when the current view has it, else "All". */
export function effectiveIdeaTab(tab: IdeaTab, view: ViewAs): IdeaTab {
  return (IDEA_TABS[view] as readonly IdeaTab[]).includes(tab) ? tab : "all";
}

export interface IdeaTabContext {
  /** The developer view's apps (`myApps`). */
  myApps: readonly App[];
  /** The channel the developer view acts as. */
  devChannel: ChannelId;
}

export function ideaTabPredicate(tab: IdeaTab, ctx: IdeaTabContext): (idea: Idea) => boolean {
  switch (tab) {
    case "all":
      return () => true;
    case "new":
      return (idea) => idea.kind !== "app";
    case "app":
      return (idea) => idea.kind === "app";
    case "mine":
      return (idea) => idea.mine;
    case "myapps":
      return (idea) => idea.kind === "app" && ctx.myApps.some((a) => a.id === idea.appId);
    case "mywork":
      return (idea) => idea.dev === ctx.devChannel;
  }
}

/** No status selected = every status. */
export function statusFilter(ideas: readonly Idea[], statuses: readonly IdeaStatus[]): Idea[] {
  return statuses.length === 0 ? [...ideas] : ideas.filter((i) => statuses.includes(i.status));
}

/** Top = most votes first; new = newest first. */
export function sortIdeas(ideas: readonly Idea[], sort: IdeaSort): Idea[] {
  const list = [...ideas];
  return sort === "new"
    ? list.sort((a, b) => b.date.localeCompare(a.date))
    : list.sort((a, b) => b.votes - a.votes);
}

export interface IdeaListOptions extends IdeaTabContext {
  view: ViewAs;
  tab: IdeaTab;
  statuses: readonly IdeaStatus[];
  sort: IdeaSort;
  /** Only ideas about this app (the "Ideas for <app>" chip). */
  appFilter: AppId | null;
}

/** Ideas matching the app filter — the base the tab counts are computed on. */
export function ideasForApp(ideas: readonly Idea[], appFilter: AppId | null): Idea[] {
  return appFilter ? ideas.filter((i) => i.appId === appFilter) : [...ideas];
}

/** The board list: app filter → tab → statuses → sort. */
export function filterIdeas(ideas: readonly Idea[], options: IdeaListOptions): Idea[] {
  const tab = effectiveIdeaTab(options.tab, options.view);
  const base = ideasForApp(ideas, options.appFilter).filter(ideaTabPredicate(tab, options));
  return sortIdeas(statusFilter(base, options.statuses), options.sort);
}

/** Apps the developer channel publishes: on the channel itself or under its author's name. */
export function myApps(apps: readonly App[], channel: Pick<ChannelInfo, "id" | "author">): App[] {
  return apps.filter((a) => a.channel === channel.id || a.publisher === channel.author);
}

/** The developer view can take open ideas: any new-app idea, or one about its own apps. */
export function canTake(idea: Idea, view: ViewAs, mine: readonly App[]): boolean {
  return (
    view === "developer" &&
    idea.status === "open" &&
    (idea.kind !== "app" || mine.some((a) => a.id === idea.appId))
  );
}

/**
 * "Your idea became an app" notes: the user's own released ideas not dismissed yet (the sidebar
 * Ideas badge and the board's note). Authors only — the developer view has none.
 */
export function releaseNotes(ideas: readonly Idea[], view: ViewAs): Idea[] {
  if (view === "developer") return [];
  return ideas.filter((i) => i.mine && i.status === "released" && !i.releaseNoteDismissed);
}

/** Increments the last numeric segment: 1.9.15 → 1.9.16; a non-numeric tail becomes 1. */
export function nextVersion(version: string): string {
  const parts = version.split(".");
  const last = Number.parseInt(parts[parts.length - 1] ?? "", 10);
  parts[parts.length - 1] = Number.isNaN(last) ? "1" : String(last + 1);
  return parts.join(".");
}

/** Bodies over `max` characters: the first `max − 3`, cut back to a word boundary, plus "…". */
export function excerpt(body: string, max = 150): string {
  if (body.length <= max) return body;
  return `${body.slice(0, max - 3).replace(/\s+\S*$/, "")}…`;
}
