import { useMemo } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import type { UseQueryResult } from "@tanstack/react-query";
import { useServices } from "@/services/registry";
import type {
  ChannelId,
  ChannelInfo,
  ChannelLookup,
  ChannelSubscription,
  ReportReceipt,
  ReportTarget,
  SyncOutcome,
} from "@/services/types";
import { queryKeys } from "./keys";

export function useChannels(): UseQueryResult<ChannelInfo[]> {
  const { channels } = useServices();
  return useQuery({ queryKey: queryKeys.channels, queryFn: () => channels.getChannels() });
}

export function useSubscriptions(): UseQueryResult<ChannelSubscription[]> {
  const { channels } = useServices();
  return useQuery({
    queryKey: queryKeys.subscriptions,
    queryFn: () => channels.getSubscriptions(),
  });
}

export interface ChannelActions {
  subscribe(channelId: ChannelId): Promise<ChannelSubscription[]>;
  unsubscribe(channelId: ChannelId): Promise<ChannelSubscription[]>;
  setPaused(channelId: ChannelId, paused: boolean): Promise<ChannelSubscription[]>;
  acknowledgeStale(channelId: ChannelId): Promise<ChannelSubscription[]>;
  /** A successful sync also stamps the channel's `synced` date in the channels cache. */
  sync(channelId: ChannelId): Promise<SyncOutcome>;
  report(target: ReportTarget, text: string): Promise<ReportReceipt>;
  lookup(address: string): Promise<ChannelLookup>;
}

export function useChannelActions(): ChannelActions {
  const { channels } = useServices();
  const queryClient = useQueryClient();
  return useMemo(() => {
    const write = async (pending: Promise<ChannelSubscription[]>) => {
      const subscriptions = await pending;
      queryClient.setQueryData(queryKeys.subscriptions, subscriptions);
      return subscriptions;
    };
    return {
      subscribe: (channelId) => write(channels.subscribe(channelId)),
      unsubscribe: (channelId) => write(channels.unsubscribe(channelId)),
      setPaused: (channelId, paused) => write(channels.setPaused(channelId, paused)),
      acknowledgeStale: (channelId) => write(channels.acknowledgeStale(channelId)),
      async sync(channelId) {
        const outcome = await channels.sync(channelId);
        if (outcome.kind === "synced") {
          queryClient.setQueryData<ChannelInfo[]>(queryKeys.channels, (list) =>
            list?.map((c) => (c.id === channelId ? { ...c, synced: outcome.at } : c)),
          );
        }
        return outcome;
      },
      report: (target, text) => channels.report(target, text),
      lookup: (address) => channels.lookup(address),
    };
  }, [channels, queryClient]);
}
