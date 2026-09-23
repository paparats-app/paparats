import { commands } from "@/bindings";
import type { ChannelService } from "../contracts";
import { unwrap } from "./result";

export function createTauriChannelService(): ChannelService {
  return {
    getChannels: () => unwrap(commands.channelsGetChannels()),
    getSubscriptions: () => unwrap(commands.channelsGetSubscriptions()),
    lookup: (address) => unwrap(commands.channelsLookup(address)),
    subscribe: (channelId) => unwrap(commands.channelsSubscribe(channelId)),
    unsubscribe: (channelId) => unwrap(commands.channelsUnsubscribe(channelId)),
    setPaused: (channelId, paused) => unwrap(commands.channelsSetPaused(channelId, paused)),
    acknowledgeStale: (channelId) => unwrap(commands.channelsAcknowledgeStale(channelId)),
    sync: (channelId) => unwrap(commands.channelsSync(channelId)),
    report: (target, text) => unwrap(commands.channelsReport(target, text)),
  };
}
