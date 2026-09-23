import { useTranslation } from "react-i18next";
import { updateSizeMb, type AppInstallState } from "@/domain/apps";
import { candidates, homeChannel } from "@/domain/channels";
import { useFormat } from "@/i18n/format";
import { useCatalog, useChannelActions } from "@/queries";
import { useServices } from "@/services";
import type { App } from "@/services/types";
import { useDialogStore } from "@/stores/useDialogStore";
import { useDownloadsStore } from "@/stores/useDownloadsStore";
import { useUiStore } from "@/stores/useUiStore";
import { useChannelContext } from "./useChannelContext";
import { useInstallState } from "./useInstallState";
import { useOffline } from "./useOffline";

/**
 * neutral: `--card2` / `--text` · primary: `--mint` / `--ink` (Update) ·
 * progress: `--mint2` text (downloading, paused, installing) · quiet: `--text2` (queued) ·
 * muted: `--text3` (offline) — the prototype's `actColor`.
 */
export type ActionTone = "neutral" | "primary" | "progress" | "quiet" | "muted";

export interface AppAction {
  state: AppInstallState;
  /** Download progress 0–100. */
  progress: number;
  label: string;
  tone: ActionTone;
  disabled: boolean;
  /** The primary action for the current state. */
  run(): void;
  /** Removes the app from the download queue. */
  cancel(): void;
}

const ignore = () => undefined;

/** The primary card/button action — the prototype's `card()` label, colour and `act`. */
export function useAppAction(app: App): AppAction {
  const { t } = useTranslation();
  const format = useFormat();
  const { install } = useServices();
  const { state, progress } = useInstallState(app.id);
  const channels = useChannelContext();
  const offline = useOffline();
  const manifests = useCatalog().data?.updates;
  const channelActions = useChannelActions();
  const openDialog = useDialogStore((s) => s.open);
  const notify = useUiStore((s) => s.notify);
  const downloads = useDownloadsStore.getState;

  // No channel offering the app is followed (paused counts as followed).
  const needsSubscribe = state === "none" && !candidates(app).some(channels.isFollowed);
  const offlineBlocked = offline && (state === "none" || state === "update");

  let label: string;
  if (needsSubscribe) label = t("common.subscribe");
  else if (offlineBlocked) label = t("common.unavailableOffline");
  else if (state === "queued") label = t("common.queued");
  else if (state === "installing") label = t("common.installingNow");
  else if (state === "downloading") label = `${format.percent(progress)} · ${t("common.pause")}`;
  else if (state === "paused") label = t("common.resume");
  else if (state === "installed") label = t("common.open");
  else if (state === "update") label = t("common.update");
  else label = t("common.get");

  let tone: ActionTone;
  if (offlineBlocked) tone = "muted";
  else if (state === "queued") tone = "quiet";
  else if (state === "update") tone = "primary";
  else if (state === "downloading" || state === "paused" || state === "installing") {
    tone = "progress";
  } else tone = "neutral";

  function subscribe() {
    const channelId = homeChannel(app);
    const channel = channels.byId[channelId];
    if (!channel || channels.isFollowed(channelId)) return;
    if (channel.trust === "community") {
      openDialog({ kind: "trustConfirm", channelId });
      return;
    }
    channelActions
      .subscribe(channelId)
      .then(() => notify(t("channel.subscribedTo", { channel: channel.name })), ignore);
  }

  function run() {
    if (needsSubscribe) return subscribe();
    if (offlineBlocked) return notify(t("common.offline"));
    switch (state) {
      case "none":
        void downloads().enqueue([
          { appId: app.id, version: app.version, kind: "install", sizeMb: app.sizeMb },
        ]);
        return;
      case "update":
        void downloads().enqueue([
          {
            appId: app.id,
            version: app.version,
            kind: "update",
            sizeMb: updateSizeMb(app, manifests ?? [], true),
          },
        ]);
        return;
      case "downloading":
        void downloads().pause(app.id);
        return;
      case "paused":
        void downloads().resume(app.id);
        return;
      case "installed":
        notify(t("common.opening", { app: app.name }));
        install.open(app.id).catch(ignore);
        return;
      case "queued":
      case "installing":
        return;
    }
  }

  return {
    state,
    progress,
    label,
    tone,
    disabled: state === "queued" || state === "installing",
    run,
    cancel: () => void downloads().cancel(app.id),
  };
}
