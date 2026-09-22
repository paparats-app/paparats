import { lookupChannel } from "@/domain/channels";
import { daysBetween } from "@/domain/dates";
import { ServiceError } from "../errors";
import type { ChannelService } from "../contracts";
import { OFFICIAL_CHANNEL } from "../types";
import type { ChannelId, ReportReceipt, SyncOutcome } from "../types";
import { mustFind } from "./runtime";
import type { MockContext } from "./runtime";
import type { MockWorld } from "./world";

export function createMockChannelService(world: MockWorld, ctx: MockContext): ChannelService {
  const channel = (id: ChannelId) => mustFind(world.channels, (c) => c.id === id, `Channel ${id}`);
  const subscription = (id: ChannelId) =>
    mustFind(world.subscriptions, (s) => s.channelId === id, `Subscription to ${id}`);
  const isFollowed = (id: ChannelId) => world.subscriptions.some((s) => s.channelId === id);
  const protect = (id: ChannelId, action: string) => {
    if (id === OFFICIAL_CHANNEL) {
      throw new ServiceError("invalid", `The official catalog cannot be ${action}`);
    }
  };

  return {
    getChannels: () => ctx.respond(() => world.channels),
    getSubscriptions: () => ctx.respond(() => world.subscriptions),

    // Address matching is the domain's (the prototype's `lookupChannel()`).
    lookup: (address) =>
      ctx.respond(() => lookupChannel(world.channels, world.subscriptions, address)),

    subscribe: (channelId) =>
      ctx.respond(() => {
        channel(channelId);
        if (!isFollowed(channelId)) {
          world.subscriptions.push({ channelId, paused: false, staleAcknowledged: false });
        }
        return world.subscriptions;
      }),

    unsubscribe: (channelId) =>
      ctx.respond(() => {
        protect(channelId, "removed");
        world.subscriptions = world.subscriptions.filter((s) => s.channelId !== channelId);
        return world.subscriptions;
      }),

    setPaused: (channelId, paused) =>
      ctx.respond(() => {
        protect(channelId, "paused");
        subscription(channelId).paused = paused;
        return world.subscriptions;
      }),

    acknowledgeStale: (channelId) =>
      ctx.respond(() => {
        subscription(channelId).staleAcknowledged = true;
        return world.subscriptions;
      }),

    sync: (channelId) =>
      ctx.respond((): SyncOutcome => {
        const c = channel(channelId);
        if (c.outage) {
          return { kind: "unreachable", days: Math.max(1, daysBetween(c.outage, ctx.today)) };
        }
        c.synced = ctx.today;
        return { kind: "synced", at: ctx.today };
      }),

    report: (target) =>
      ctx.respond((): ReportReceipt => {
        const c = channel(target.channelId);
        return c.trust === "official"
          ? { kind: "paparats" }
          : { kind: "author", channelName: c.name, author: c.author };
      }),
  };
}
