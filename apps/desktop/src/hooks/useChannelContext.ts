import { useMemo } from "react";
import {
  alternativesOf,
  downDays,
  indexChannels,
  isActive,
  isStale,
  sourceOf,
  subscriptionOf,
  type ChannelContextData,
} from "@/domain/channels";
import { useChannels, useSubscriptions } from "@/queries";
import type { App, ChannelId, ChannelInfo, ChannelSubscription } from "@/services/types";
import { useToday } from "./useToday";

/** Channels, the user's subscriptions and the source rule bound to them. */
export interface ChannelContext extends ChannelContextData {
  channels: ChannelInfo[];
  byId: Readonly<Record<ChannelId, ChannelInfo>>;
  subscriptions: ChannelSubscription[];
  /** Channels and subscriptions have loaded (before that both lists are empty). */
  ready: boolean;
  subscriptionOf(id: ChannelId): ChannelSubscription | undefined;
  /** Followed, switched on or paused. */
  isFollowed(id: ChannelId): boolean;
  /** Followed and switched on. */
  isActive(id: ChannelId): boolean;
  /** The channel the app installs from (most trusted active one). */
  sourceOf(app: App): ChannelId;
  alternativesOf(app: App): ChannelId[];
  /** Days the channel has been unreachable (0 = answering). */
  downDays(id: ChannelId): number;
  /** Followed, down ≥ 14 days and not kept by the user. */
  isStale(id: ChannelId): boolean;
}

const NO_CHANNELS: ChannelInfo[] = [];
const NO_SUBSCRIPTIONS: ChannelSubscription[] = [];

export function useChannelContext(): ChannelContext {
  const channelsData = useChannels().data;
  const subscriptionsData = useSubscriptions().data;
  const today = useToday();

  return useMemo(() => {
    const channels = channelsData ?? NO_CHANNELS;
    const subscriptions = subscriptionsData ?? NO_SUBSCRIPTIONS;
    const data: ChannelContextData = { byId: indexChannels(channels), subscriptions };
    return {
      channels,
      byId: data.byId,
      subscriptions,
      ready: channelsData !== undefined && subscriptionsData !== undefined,
      subscriptionOf: (id) => subscriptionOf(subscriptions, id),
      isFollowed: (id) => subscriptionOf(subscriptions, id) !== undefined,
      isActive: (id) => isActive(subscriptions, id),
      sourceOf: (app) => sourceOf(app, data),
      alternativesOf: (app) => alternativesOf(app, data),
      downDays: (id) => downDays(data.byId[id], today),
      isStale: (id) => isStale(data.byId[id], subscriptionOf(subscriptions, id), today),
    };
  }, [channelsData, subscriptionsData, today]);
}
