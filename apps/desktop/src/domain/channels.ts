// Channels: which ones are active, where an app installs from, outages and the stale rule.
import type {
  App,
  AppId,
  ChannelId,
  ChannelInfo,
  ChannelLookup,
  ChannelSubscription,
  IsoDate,
  TrustLevel,
} from "@/services/types";
import { OFFICIAL_CHANNEL } from "@/services/types";
import { daysBetween } from "./dates";

/** Lower is more trusted: official › verified › community. */
export const TRUST_RANK: Readonly<Record<TrustLevel, number>> = {
  official: 0,
  verified: 1,
  community: 2,
};

/** Channels unknown to the client sort after every trust level. */
const UNKNOWN_RANK = 3;

/** A followed channel that has not answered for this many days gets the stale callout. */
export const STALE_AFTER_DAYS = 14;

/** What the source rule needs to know about channels (`useChannelContext()` satisfies it). */
export interface ChannelContextData {
  byId: Readonly<Record<ChannelId, ChannelInfo>>;
  subscriptions: readonly ChannelSubscription[];
}

export function indexChannels(channels: readonly ChannelInfo[]): Record<ChannelId, ChannelInfo> {
  return Object.fromEntries(channels.map((c) => [c.id, c]));
}

export function subscriptionOf(
  subscriptions: readonly ChannelSubscription[],
  channelId: ChannelId,
): ChannelSubscription | undefined {
  return subscriptions.find((s) => s.channelId === channelId);
}

/** Followed, whether switched on or paused. */
export function isFollowed(
  subscriptions: readonly ChannelSubscription[],
  channelId: ChannelId,
): boolean {
  return subscriptionOf(subscriptions, channelId) !== undefined;
}

/** Followed and not paused. The official catalog cannot be paused, so it is active while followed. */
export function isActive(
  subscriptions: readonly ChannelSubscription[],
  channelId: ChannelId,
): boolean {
  const sub = subscriptionOf(subscriptions, channelId);
  return sub !== undefined && (channelId === OFFICIAL_CHANNEL || !sub.paused);
}

/** The channel that publishes the app (absent = the official catalog). */
export function homeChannel(app: App): ChannelId {
  return app.channel ?? OFFICIAL_CHANNEL;
}

/** Every channel that offers the app: its home channel first, then `alsoIn`. */
export function candidates(app: App): ChannelId[] {
  return [homeChannel(app), ...app.alsoIn];
}

function rankOf(ctx: ChannelContextData, channelId: ChannelId): number {
  const channel = ctx.byId[channelId];
  return channel ? TRUST_RANK[channel.trust] : UNKNOWN_RANK;
}

/** Source rule: the most trusted active candidate; with none active, the home channel. */
export function sourceOf(app: App, ctx: ChannelContextData): ChannelId {
  const active = candidates(app).filter((id) => isActive(ctx.subscriptions, id));
  const [best] = active.sort((a, b) => rankOf(ctx, a) - rankOf(ctx, b));
  return best ?? homeChannel(app);
}

/** The other active channels that also offer the app. */
export function alternativesOf(app: App, ctx: ChannelContextData): ChannelId[] {
  const source = sourceOf(app, ctx);
  return candidates(app).filter((id) => id !== source && isActive(ctx.subscriptions, id));
}

/** Days a channel has been unreachable (at least 1 during an outage), 0 when it answers. */
export function downDays(channel: ChannelInfo | undefined, today: IsoDate): number {
  if (!channel?.outage) return 0;
  return Math.max(1, Math.round(daysBetween(channel.outage, today)));
}

/** A followed channel down for ≥ 14 days whose callout the user has not answered with "Keep". */
export function isStale(
  channel: ChannelInfo | undefined,
  sub: ChannelSubscription | undefined,
  today: IsoDate,
): boolean {
  if (!sub) return false;
  return downDays(channel, today) >= STALE_AFTER_DAYS && !sub.staleAcknowledged;
}

/** Apps offered by a followed, switched-on channel, plus every installed app. */
export function visibleApps(
  apps: readonly App[],
  ctx: ChannelContextData,
  installed: { has(appId: AppId): boolean },
): App[] {
  return apps.filter(
    (app) => installed.has(app.id) || candidates(app).some((id) => isActive(ctx.subscriptions, id)),
  );
}

/** Apps a channel offers (as home channel or through `alsoIn`), followed or not. */
export function channelApps(apps: readonly App[], channelId: ChannelId): App[] {
  return apps.filter((app) => candidates(app).includes(channelId));
}

/** `https://www.Kvetka.Example/paparats/` → `kvetka.example/paparats`. */
export function normaliseAddress(address: string): string {
  return address
    .trim()
    .toLowerCase()
    .replace(/^https?:\/\//, "")
    .replace(/^www\./, "")
    .replace(/\/+$/, "");
}

/** Matches the full address, its host, `@handle` or `handle`, case-insensitively. */
export function findChannelByAddress(
  channels: readonly ChannelInfo[],
  address: string,
): ChannelInfo | undefined {
  const q = normaliseAddress(address);
  if (!q) return undefined;
  return channels.find((c) => {
    const addr = c.addr.toLowerCase();
    const handle = c.handle.toLowerCase();
    return addr === q || addr.split("/")[0] === q || handle === q || handle.slice(1) === q;
  });
}

/** `ChannelService.lookup` semantics over an in-memory channel list. */
export function lookupChannel(
  channels: readonly ChannelInfo[],
  subscriptions: readonly ChannelSubscription[],
  address: string,
): ChannelLookup {
  const channel = findChannelByAddress(channels, address);
  if (!channel) return { kind: "notFound" };
  return isFollowed(subscriptions, channel.id)
    ? { kind: "alreadySubscribed", channel }
    : { kind: "found", channel };
}
