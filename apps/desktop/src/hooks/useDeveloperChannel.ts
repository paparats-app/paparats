import { useMemo } from "react";
import { myApps } from "@/domain/ideas";
import { useCatalog, useChannels } from "@/queries";
import type { App, ChannelId, ChannelInfo } from "@/services/types";

/**
 * The channel the developer view acts as: `fixtures/meta.json › developerChannel`, the same
 * value the core's embedded catalog meta carries (paparats-catalog `developer_channel`). No
 * service exposes the meta yet, so the id lives here, in one place.
 */
export const DEVELOPER_CHANNEL_ID: ChannelId = "kvetka";

export interface DeveloperChannel {
  id: ChannelId;
  /** The channel's card (name, author, tint, monogram); undefined while the channels load. */
  channel: ChannelInfo | undefined;
  /** Apps the channel publishes (`domain/ideas › myApps`): the release dialog's choices. */
  apps: App[];
}

/** The developer view's channel and its apps (the prototype's `devCh` and `myApps`). */
export function useDeveloperChannel(): DeveloperChannel {
  const channels = useChannels().data;
  const catalog = useCatalog().data;
  return useMemo(() => {
    const channel = channels?.find((c) => c.id === DEVELOPER_CHANNEL_ID);
    // Until the channel's author is known, only the apps published on the channel itself.
    const apps = !catalog
      ? []
      : channel
        ? myApps(catalog.apps, channel)
        : catalog.apps.filter((a) => a.channel === DEVELOPER_CHANNEL_ID);
    return { id: DEVELOPER_CHANNEL_ID, channel, apps };
  }, [channels, catalog]);
}
