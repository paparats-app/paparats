// What the idea page shows, derived from an idea (the detail block of the prototype's
// `renderVals`, lines 2081–2089). The parts the board shares — title, body, kind chip, developer
// name, author, released app — come from `screens/shared › useIdeaView`.
import { useMemo } from "react";
import { useTranslation } from "react-i18next";
import type { CommentView } from "@/components/CommentThread";
import { IDEA_STATUS_KEY, type IdeaKindView } from "@/components/IdeaCard";
import type { TimelineStep } from "@/components/Timeline";
import { canTake, type ViewAs } from "@/domain/ideas";
import { initials, pickText } from "@/domain/text";
import {
  useAppIndex,
  useChannelContext,
  useDeveloperChannel,
  useLocale,
  useViewAs,
  type AppIndex,
} from "@/hooks";
import { useFormat } from "@/i18n/format";
import { useAccount } from "@/queries";
import { useIdeaView } from "@/screens/shared";
import type { App, ChannelId, ChannelInfo, Idea, IdeaStatus } from "@/services/types";

type ChannelsById = Readonly<Record<ChannelId, ChannelInfo>>;

/** The 8px dot: the channel's tint, or the improved app's tint for a catalog developer. */
export function developerTint(idea: Idea, channels: ChannelsById, apps: AppIndex): string {
  const tint = idea.dev ? channels[idea.dev]?.tint : apps.get(idea.appId)?.tint;
  return tint ?? "var(--text3)";
}

/** Index of the latest reached timeline step: 0 proposed · 1 in work · 2 released. */
export function reachedStep(status: IdeaStatus): number {
  return status === "released" ? 2 : status === "work" ? 1 : 0;
}

/** The developer view's part of the status card. */
export type IdeaDeveloperAction =
  { type: "take" } | { type: "release" } | { type: "takenByOther"; developer: string };

/**
 * Take this idea (open ideas the channel may take), Mark as released (in work at the channel) or
 * "In work at <developer>" (in work elsewhere); nothing in the user view.
 */
export function developerAction(
  idea: Idea,
  view: ViewAs,
  devChannel: ChannelId,
  devApps: readonly App[],
  developer: string,
): IdeaDeveloperAction | null {
  if (canTake(idea, view, devApps)) return { type: "take" };
  if (view !== "developer" || idea.status !== "work") return null;
  return idea.dev === devChannel ? { type: "release" } : { type: "takenByOther", developer };
}

export interface IdeaDetailView {
  title: string;
  body: string;
  kind: IdeaKindView;
  statusLabel: string;
  /** "You" (user view) or the profile name (developer view) for the user's own ideas. */
  author: string;
  date: string;
  /** Shown once the idea is in work or released. */
  developer: { name: string; tint: string } | null;
  statusHint: string;
  /** The released app row (released ideas whose app is in the catalog). */
  releasedApp: { app: App; version: string } | null;
  timeline: TimelineStep[];
  reached: number;
  comments: CommentView[];
  action: IdeaDeveloperAction | null;
  /** The developer view's channel name ("It will be pinned to Nilesoft…", the take toast). */
  devChannelName: string;
  /** The composer's avatar: the channel's monogram and tint in the developer view. */
  composer: { initials: string; tint?: string };
}

/** The idea page's view model (catalog, channels and account must have loaded). */
export function useIdeaDetail(idea: Idea): IdeaDetailView {
  const { t } = useTranslation();
  const format = useFormat();
  const locale = useLocale();
  const view = useViewAs();
  const apps = useAppIndex();
  const { byId: channels } = useChannelContext();
  const dev = useDeveloperChannel();
  const profileName = useAccount().data?.profile.name ?? "";
  const ideaView = useIdeaView();

  return useMemo(() => {
    const author = ideaView.author(idea);
    const developer = ideaView.developerName(idea);
    const released = ideaView.releasedApp(idea);
    const reached = reachedStep(idea.status);
    const releasedName = released ? `${released.name} ${idea.releasedVersion ?? ""}`.trim() : "";
    const notYet: string = t("ideas.tlPending");
    const takenOn = format.date(idea.takenAt ?? "");
    const releasedOn = format.date(idea.releasedAt ?? "");

    const statusHint: string =
      idea.status === "open"
        ? t("ideas.statusOpenHint")
        : idea.status === "work"
          ? t("ideas.statusWorkHint", { channel: developer, date: takenOn })
          : t("ideas.statusReleasedHint", { app: releasedName, date: releasedOn });

    const timeline: TimelineStep[] = [
      { label: t("ideas.tlProposed"), detail: `${author} · ${format.date(idea.date)}` },
      { label: t("ideas.tlWork"), detail: reached >= 1 ? `${developer} · ${takenOn}` : notYet },
      {
        label: t("ideas.tlReleased"),
        detail: reached >= 2 ? `${releasedName} · ${releasedOn}` : notYet,
      },
    ];

    // Own comments read "You" in the user view and the profile name in the developer view; a
    // channel's comments carry its Developer badge and sit on its tint (prototype line 2086).
    const comments: CommentView[] = idea.comments.map((comment, index) => {
      const channel = comment.dev ? channels[comment.dev] : undefined;
      const name = comment.mine ? profileName : (comment.author ?? "");
      const isAuthor = comment.mine ? idea.mine : !comment.dev && comment.author === idea.author;
      return {
        id: `${index}`,
        author: comment.mine && view === "user" ? t("ideas.you") : name,
        initials: initials(name),
        date: format.date(comment.date),
        text: pickText(comment.text, locale),
        badge: comment.dev
          ? { type: "developer", channel: channel?.name ?? comment.dev }
          : isAuthor
            ? { type: "author" }
            : undefined,
        avatarTint: channel?.tint,
      };
    });

    const devTile = view === "developer" ? dev.channel : undefined;
    return {
      title: ideaView.title(idea),
      body: ideaView.body(idea),
      kind: ideaView.kind(idea),
      statusLabel: t(IDEA_STATUS_KEY[idea.status]),
      author,
      date: format.date(idea.date),
      developer:
        idea.status !== "open" && developer !== ""
          ? { name: developer, tint: developerTint(idea, channels, apps) }
          : null,
      statusHint,
      releasedApp:
        idea.status === "released" && released
          ? { app: released, version: idea.releasedVersion ?? "" }
          : null,
      timeline,
      reached,
      comments,
      action: developerAction(idea, view, dev.id, dev.apps, developer),
      devChannelName: dev.channel?.name ?? "",
      composer: devTile
        ? { initials: devTile.mono, tint: devTile.tint }
        : { initials: initials(profileName) },
    };
  }, [idea, ideaView, t, format, locale, view, apps, channels, dev, profileName]);
}
