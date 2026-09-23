// The Ideas board's data: tabs with counts, the filtered list, the user's ideas and release notes,
// the developer panel's numbers (Paparats Prototype.dc.html, `renderVals` "// ideas" 2040–2079).
import { useMemo } from "react";
import {
  canTake,
  effectiveIdeaTab,
  filterIdeas,
  IDEA_TABS,
  ideasForApp,
  ideaTabPredicate,
  releaseNotes,
  type IdeaTab,
  type ViewAs,
} from "@/domain/ideas";
import { useAppIndex, useDeveloperChannel, useViewAs, type DeveloperChannel } from "@/hooks";
import { useAccount, useCatalog, useChannels, useIdeas } from "@/queries";
import type { App, Idea } from "@/services/types";
import { useIdeasStore } from "@/stores/useIdeasStore";

export interface IdeasBoard {
  /** Ideas, catalog and channels have loaded. */
  ready: boolean;
  view: ViewAs;
  /** The view's tabs with their counts (over the app filter, before the status chips). */
  tabs: ReadonlyArray<{ value: IdeaTab; count: number }>;
  /** The selected tab, "all" when the view lacks the stored one. */
  tab: IdeaTab;
  /** App filter → tab → status chips → sort. */
  list: Idea[];
  /** The app of the "For <App>" filter chip. */
  appFilter: App | undefined;
  /** The user's own ideas ("Your ideas"). */
  mine: Idea[];
  /** Released ideas of the user whose note is not dismissed (user view only). */
  notes: Idea[];
  /** The 3-month thank-you has been activated (`giftUntil` set). */
  bonusClaimed: boolean;
  developer: DeveloperChannel;
  /** Developer panel: In work / Released for the channel, open ideas for its apps. */
  devStats: { work: number; released: number; forApps: number };
  /** The developer view may take this idea. */
  canTake(idea: Idea): boolean;
}

const NO_IDEAS: Idea[] = [];

export function useIdeasBoard(): IdeasBoard {
  const view = useViewAs();
  const ideasQuery = useIdeas();
  const catalogReady = useCatalog().data !== undefined;
  const channelsReady = useChannels().data !== undefined;
  const giftUntil = useAccount().data?.subscription.giftUntil ?? null;
  const apps = useAppIndex();
  const developer = useDeveloperChannel();
  const storedTab = useIdeasStore((s) => s.tab);
  const statuses = useIdeasStore((s) => s.statuses);
  const sort = useIdeasStore((s) => s.sort);
  const appFilterId = useIdeasStore((s) => s.appFilter);
  const ideas = ideasQuery.data ?? NO_IDEAS;

  return useMemo(() => {
    const ctx = { myApps: developer.apps, devChannel: developer.id };
    const tab = effectiveIdeaTab(storedTab, view);
    const base = ideasForApp(ideas, appFilterId);
    const tabs = IDEA_TABS[view].map((value) => ({
      value,
      count: base.filter(ideaTabPredicate(value, ctx)).length,
    }));
    const ownApp = (idea: Idea) =>
      idea.kind === "app" && developer.apps.some((a) => a.id === idea.appId);
    return {
      ready: ideasQuery.data !== undefined && catalogReady && channelsReady,
      view,
      tabs,
      tab,
      list: filterIdeas(ideas, { ...ctx, view, tab, statuses, sort, appFilter: appFilterId }),
      appFilter: apps.get(appFilterId),
      mine: ideas.filter((i) => i.mine),
      notes: releaseNotes(ideas, view),
      bonusClaimed: giftUntil !== null,
      developer,
      devStats: {
        work: ideas.filter((i) => i.dev === developer.id && i.status === "work").length,
        released: ideas.filter((i) => i.dev === developer.id && i.status === "released").length,
        forApps: ideas.filter((i) => i.status === "open" && ownApp(i)).length,
      },
      canTake: (idea) => canTake(idea, view, developer.apps),
    };
  }, [
    appFilterId,
    apps,
    catalogReady,
    channelsReady,
    developer,
    giftUntil,
    ideas,
    ideasQuery.data,
    sort,
    statuses,
    storedTab,
    view,
  ]);
}
