// What following a channel does, wherever it is done — Settings › Sources and its dialogs, the
// channel page and a store card's Subscribe (the prototype's `subscribeChannel` /
// `confirmChannel`, `unsubscribeChannel`, `toggleChannel` and `keepChannel`, lines 1772–1784):
// each calls the channel service, then toasts like the prototype and keeps the Browse source
// filter clean. A failed call shows nothing (the handoff has no failure copy).
import { useMemo } from "react";
import { useTranslation } from "react-i18next";
import { useChannelActions } from "@/queries";
import type { ChannelInfo } from "@/services/types";
import { useBrowseStore } from "@/stores/useBrowseStore";
import { useDialogStore } from "@/stores/useDialogStore";
import { useUiStore } from "@/stores/useUiStore";

export interface ChannelFollow {
  /**
   * Subscribe as the buttons do: a community channel opens the trust confirmation
   * (`{kind:'trustConfirm'}`); any other is followed at once (`subscribe`).
   */
  follow(channel: ChannelInfo): void;
  /**
   * Follows the channel and toasts "Subscribed to <Channel>". A community channel must have been
   * confirmed first (`TrustConfirmDialog`). Resolves `false` when the service refused.
   */
  subscribe(channel: ChannelInfo): Promise<boolean>;
  /** Unfollows it, drops it from the Browse source filter, toasts "Unsubscribed from …". */
  unsubscribe(channel: ChannelInfo): Promise<boolean>;
  /** Switches it off/on, drops it from the Browse source filter, toasts "… paused/resumed". */
  setPaused(channel: ChannelInfo, paused: boolean): Promise<boolean>;
  /** "Keep" on the stale callout: the callout goes, nothing is toasted. */
  keep(channel: ChannelInfo): Promise<boolean>;
}

export function useChannelFollow(): ChannelFollow {
  const { t } = useTranslation();
  const actions = useChannelActions();
  const notify = useUiStore((s) => s.notify);
  const dropSource = useBrowseStore((s) => s.dropSource);
  const openDialog = useDialogStore((s) => s.open);

  return useMemo(() => {
    const attempt = async (call: () => Promise<unknown>, then: () => void) => {
      try {
        await call();
      } catch {
        return false;
      }
      then();
      return true;
    };
    const subscribe = ({ id, name }: ChannelInfo) =>
      attempt(
        () => actions.subscribe(id),
        () => notify(t("channel.subscribedTo", { channel: name })),
      );
    return {
      follow(channel) {
        if (channel.trust === "community") {
          openDialog({ kind: "trustConfirm", channelId: channel.id });
          return;
        }
        void subscribe(channel);
      },
      subscribe,
      unsubscribe: ({ id, name }) =>
        attempt(
          () => actions.unsubscribe(id),
          () => {
            dropSource(id);
            notify(t("channel.unsubscribedFrom", { channel: name }));
          },
        ),
      setPaused: ({ id, name }, paused) =>
        attempt(
          () => actions.setPaused(id, paused),
          () => {
            dropSource(id);
            notify(
              paused
                ? t("channel.channelPausedMsg", { channel: name })
                : t("channel.channelResumedMsg", { channel: name }),
            );
          },
        ),
      keep: ({ id }) =>
        attempt(
          () => actions.acknowledgeStale(id),
          () => undefined,
        ),
    };
  }, [t, actions, notify, dropSource, openDialog]);
}
