// No channel commands in bindings.ts yet: every method delegates to the mock. To switch one,
// replace its body with `unwrap(commands.<name>(…))` (see ./result.ts).
import type { ChannelService } from "../contracts";

export function createTauriChannelService(mock: ChannelService): ChannelService {
  return {
    getChannels: () => mock.getChannels(),
    getSubscriptions: () => mock.getSubscriptions(),
    lookup: (address) => mock.lookup(address),
    subscribe: (channelId) => mock.subscribe(channelId),
    unsubscribe: (channelId) => mock.unsubscribe(channelId),
    setPaused: (channelId, paused) => mock.setPaused(channelId, paused),
    acknowledgeStale: (channelId) => mock.acknowledgeStale(channelId),
    sync: (channelId) => mock.sync(channelId),
    report: (target, text) => mock.report(target, text),
  };
}
