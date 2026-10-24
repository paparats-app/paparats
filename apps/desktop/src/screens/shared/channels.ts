// What the screens say about a channel: the kind, trust and file-host labels, the monogram tile
// and the "Developer · by Kvetka · 12 apps" meta line (the prototype's `chView()`,
// `trustMeta()` and `kindLabel()`, lines 2004–2012). Used by Settings › Sources, the channel page
// and the add-channel / trust dialogs. The trust level names are `components/TrustBadge › TRUST_KEY`.
import { useCallback } from "react";
import { useTranslation } from "react-i18next";
import type { AppIconSource } from "@/components/AppCard";
import { TRUST_KEY } from "@/components/TrustBadge";
import { channelApps } from "@/domain/channels";
import { useCatalog } from "@/queries";
import type { ChannelInfo, ChannelKind, FileHost, TrustLevel } from "@/services/types";

export const KIND_KEY = {
  catalog: "sources.kindCatalog",
  developer: "sources.kindDeveloper",
  curated: "sources.kindCurated",
} as const satisfies Record<ChannelKind, string>;

/** Who serves the files (the channel page's Files row). */
export const HOST_KEY = {
  paparats: "sources.hostPaparats",
  mirrored: "sources.hostMirrored",
  author: "sources.hostAuthor",
} as const satisfies Record<FileHost, string>;

/** The three levels in the order the "Trust levels" cards show them, with their copy. */
export const TRUST_LEVELS = [
  { level: "official", label: TRUST_KEY.official, hint: "sources.trustOfficialHint" },
  { level: "verified", label: TRUST_KEY.verified, hint: "sources.trustVerifiedHint" },
  { level: "community", label: TRUST_KEY.community, hint: "common.trustCommunityHint" },
] as const satisfies ReadonlyArray<{ level: TrustLevel; label: string; hint: string }>;

/** The channel's monogram tile. */
export function channelIcon(channel: ChannelInfo): AppIconSource {
  return { mono: channel.mono, tint: channel.tint, iconUrl: null };
}

/**
 * "Developer · by Kvetka · 12 apps": the kind, the author and every catalog app the channel
 * offers (as home channel or through `alsoIn`, followed or not — the prototype's `chApps`).
 * `ready` is false until the catalog has loaded (the count would read 0 until then).
 */
export function useChannelMeta(): { ready: boolean; meta: (channel: ChannelInfo) => string } {
  const { t } = useTranslation();
  const apps = useCatalog().data?.apps;
  const meta = useCallback(
    (channel: ChannelInfo) =>
      [
        t(KIND_KEY[channel.kind]),
        t("sources.byAuthor", { author: channel.author }),
        t("common.appsCount", { count: apps ? channelApps(apps, channel.id).length : 0 }),
      ].join(" · "),
    [t, apps],
  );
  return { ready: apps !== undefined, meta };
}
