// Typed access to fixtures/*.json for unit tests (JSON imports widen literal unions to string).
import catalogJson from "@fixtures/catalog.json";
import channelsJson from "@fixtures/channels.json";
import ideasJson from "@fixtures/ideas.json";
import libraryJson from "@fixtures/library.json";
import metaJson from "@fixtures/meta.json";
import type {
  App,
  Catalog,
  ChannelInfo,
  ChannelSubscription,
  Idea,
  IsoDate,
  Library,
} from "@/services/types";
import { indexChannels, type ChannelContextData } from "./channels";

export const catalog = catalogJson as unknown as Catalog;
export const library = libraryJson as unknown as Library;
export const channels = (channelsJson as unknown as { channels: ChannelInfo[] }).channels;
export const subscriptions = (channelsJson as unknown as { subscriptions: ChannelSubscription[] })
  .subscriptions;
export const ideas = (ideasJson as unknown as { ideas: Idea[] }).ideas;
export const TODAY: IsoDate = metaJson.today;

export function appById(id: string): App {
  const app = catalog.apps.find((a) => a.id === id);
  if (!app) throw new Error(`fixture app ${id} not found`);
  return app;
}

export function channelById(id: string): ChannelInfo {
  const channel = channels.find((c) => c.id === id);
  if (!channel) throw new Error(`fixture channel ${id} not found`);
  return channel;
}

export function ideaById(id: string): Idea {
  const idea = ideas.find((i) => i.id === id);
  if (!idea) throw new Error(`fixture idea ${id} not found`);
  return idea;
}

/** The fixture world's channel context, optionally with different subscriptions. */
export function channelCtx(
  subs: readonly ChannelSubscription[] = subscriptions,
): ChannelContextData {
  return { byId: indexChannels(channels), subscriptions: subs };
}

export function sub(
  channelId: string,
  patch: Partial<ChannelSubscription> = {},
): ChannelSubscription {
  return { channelId, paused: false, staleAcknowledged: false, ...patch };
}
