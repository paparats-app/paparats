// How an idea reads on the board, the idea page and the release dialog: kind chip, developer line, author, the app it shipped in
// (Paparats Prototype.dc.html, `renderVals` "// ideas": `devLabel`, `devTint`, `relApp`,
// `authorOf`, `ideaView`).
import { useMemo } from "react";
import { useTranslation } from "react-i18next";
import type { IdeaDeveloperView, IdeaKindView } from "@/components/IdeaCard";
import { excerpt } from "@/domain/ideas";
import { pickText } from "@/domain/text";
import { useAppIndex, useChannelContext, useLocale, useViewAs } from "@/hooks";
import { useAccount } from "@/queries";
import type { App, Idea } from "@/services/types";

/** Dot colour when neither the developer's channel nor the app is known (the prototype's). */
const UNKNOWN_TINT = "var(--text3)";

export interface IdeaView {
  title(idea: Idea): string;
  body(idea: Idea): string;
  /** The body cut to 150 characters at a word boundary. */
  excerpt(idea: Idea): string;
  /** "For <App>" with the app's 16px tile, or "New app · <Category>". */
  kind(idea: Idea): IdeaKindView;
  /** Who took the idea: the channel name, or the publisher named on the idea. */
  developerName(idea: Idea): string;
  /** "<Dev> is on it" / "Released as <App> <version>" with the tinted dot; none while open. */
  developer(idea: Idea): IdeaDeveloperView | undefined;
  /** "You" for the user's own ideas (the profile name in the developer view), else the author. */
  author(idea: Idea): string;
  /** The app an idea shipped in: the improved app, or the new app it became. */
  releasedApp(idea: Idea): App | undefined;
}

export function useIdeaView(): IdeaView {
  const { t } = useTranslation();
  const locale = useLocale();
  const view = useViewAs();
  const apps = useAppIndex();
  const { byId: channels } = useChannelContext();
  const profileName = useAccount().data?.profile.name ?? "";

  return useMemo(() => {
    const developerName = (idea: Idea) =>
      idea.dev ? (channels[idea.dev]?.name ?? idea.dev) : (idea.devName ?? "");
    const releasedApp = (idea: Idea) =>
      apps.get(idea.kind === "app" ? idea.appId : idea.releasedAppId);
    return {
      title: (idea) => pickText(idea.title, locale),
      body: (idea) => pickText(idea.body, locale),
      excerpt: (idea) => excerpt(pickText(idea.body, locale)),
      kind(idea) {
        if (idea.kind !== "app") {
          return {
            type: "new",
            categoryLabel: idea.category ? t(`categories.items.${idea.category}.label`) : "",
          };
        }
        const app = apps.get(idea.appId);
        return {
          type: "app",
          appName: app?.name ?? "",
          icon: app
            ? { mono: app.mono, tint: app.tint, iconUrl: app.iconUrl }
            : { mono: "", tint: "transparent" },
        };
      },
      developerName,
      developer(idea) {
        const name = developerName(idea);
        if (idea.status === "open" || !name) return undefined;
        const tint = idea.dev
          ? (channels[idea.dev]?.tint ?? UNKNOWN_TINT)
          : (apps.get(idea.appId)?.tint ?? UNKNOWN_TINT);
        if (idea.status === "work") return { tint, label: t("ideas.onIt", { channel: name }) };
        const app = releasedApp(idea);
        // The prototype leaves the line empty when the app is unknown; nothing is shown then.
        if (!app) return undefined;
        const label = t("ideas.releasedAs", { app: app.name, version: idea.releasedVersion ?? "" });
        return { tint, label: label.trim() };
      },
      author(idea) {
        if (idea.mine) return view === "developer" ? profileName : t("ideas.you");
        return idea.author ?? "";
      },
      releasedApp,
    };
  }, [apps, channels, locale, profileName, t, view]);
}
