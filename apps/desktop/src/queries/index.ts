// TanStack Query over the services: read hooks keyed `[service, method]` and action hooks that
// write each mutation's authoritative result into the cache (no refetch).
export { queryKeys } from "./keys";
export { createQueryClient } from "./client";
export type { QueryClientOptions } from "./client";
export { useCatalog, usePlatform } from "./catalog";
export { useLibrary, useLibraryActions } from "./library";
export type { LibraryActions } from "./library";
export { useChannels, useSubscriptions, useChannelActions } from "./channels";
export type { ChannelActions } from "./channels";
export { useIdeas, useIdeaActions, upsertIdea } from "./ideas";
export type { IdeaActions } from "./ideas";
export { useAccount, useAccountActions } from "./account";
export type { AccountActions } from "./account";
