// What the channel page's buttons do (prototype `subscribeChannel`, `unsubscribeChannel`,
// `toggleChannel`, `keepChannel`, `openReport` and the `copy` / `sync` toasts, lines 1772–1785
// and 2012). Following goes through the shared `useChannelFollow` (toasts, Browse source filter);
// copy, report and sync are the page's own. A failed call shows nothing (no failure copy).
import { useTranslation } from "react-i18next";
import { useChannelFollow } from "@/hooks";
import { useChannelActions, useSystemActions } from "@/queries";
import type { ChannelInfo } from "@/services/types";
import { useDialogStore } from "@/stores/useDialogStore";
import { useUiStore } from "@/stores/useUiStore";

export interface ChannelCommands {
  /** Follows the channel; a community channel asks for the trust confirmation first. */
  subscribe(): void;
  /** Unfollows it and drops it from the Browse source filter. */
  unsubscribe(): void;
  /**
   * Switches a followed channel on/off and drops it from the Browse source filter. Resolves
   * `false` when the service refused.
   */
  setPaused(paused: boolean): Promise<boolean>;
  /** "Keep" on the stale callout. */
  keep(): void;
  /** Copies the channel address → "Address copied". */
  copyAddress(): void;
  /** Opens "Report a problem with <Channel>". */
  report(): void;
  /** "Channel synced" or "<Channel> is still unreachable". */
  sync(): void;
}

const ignore = () => undefined;

export function useChannelCommands(channel: ChannelInfo): ChannelCommands {
  const { t } = useTranslation();
  const follow = useChannelFollow();
  const { sync } = useChannelActions();
  const { copyToClipboard } = useSystemActions();
  const openDialog = useDialogStore((s) => s.open);
  const notify = useUiStore((s) => s.notify);

  return {
    subscribe: () => follow.follow(channel),
    unsubscribe: () => void follow.unsubscribe(channel),
    setPaused: (paused) => follow.setPaused(channel, paused),
    keep: () => void follow.keep(channel),
    copyAddress() {
      copyToClipboard(channel.addr).then(() => notify(t("sources.addrCopied")), ignore);
    },
    report() {
      openDialog({ kind: "report", target: { appId: null, channelId: channel.id } });
    },
    sync() {
      sync(channel.id).then(
        (outcome) =>
          notify(
            outcome.kind === "synced"
              ? t("sources.channelSynced")
              : t("sources.stillUnreachable", { channel: channel.name }),
          ),
        ignore,
      );
    },
  };
}
