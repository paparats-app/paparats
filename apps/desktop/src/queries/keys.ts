/** Query keys are `[service, method]` (docs/architecture.md §4). */
export const queryKeys = {
  catalog: ["catalog", "getCatalog"],
  platform: ["catalog", "getPlatform"],
  library: ["install", "getLibrary"],
  channels: ["channels", "getChannels"],
  subscriptions: ["channels", "getSubscriptions"],
  ideas: ["ideas", "getIdeas"],
  account: ["account", "getAccount"],
} as const;
