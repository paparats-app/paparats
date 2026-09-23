import { useMemo } from "react";
import { useTranslation } from "react-i18next";
import { useParams } from "react-router";
import { EmptyState } from "@/components/EmptyState";
import { channelApps } from "@/domain/channels";
import { useChannelContext } from "@/hooks";
import { useCatalog } from "@/queries";
import { BackLink } from "@/screens/shared";
import type { App, ChannelInfo } from "@/services/types";
import { ChannelApps } from "./ChannelApps";
import { ChannelHeader } from "./ChannelHeader";
import styles from "./ChannelScreen.module.css";

/**
 * Channel page (`/channel/:channelId`, prototype lines 1119–1183, README §13): header with the
 * subscription actions, warnings and details, then the apps the channel offers. Back returns to
 * the section the page was opened from.
 */
export function ChannelScreen() {
  const { channelId = "" } = useParams();
  const channels = useChannelContext();
  const apps = useCatalog().data?.apps;
  // The navigation skeleton covers the first frames while channels and the catalog load.
  if (!channels.ready || !apps) return null;
  const channel = channels.byId[channelId];
  return channel ? <ChannelPage channel={channel} catalogApps={apps} /> : <ChannelNotFound />;
}

/** An unknown channel id (the prototype fell back to the official catalog). */
function ChannelNotFound() {
  const { t } = useTranslation();
  return (
    <div className={styles.page}>
      <BackLink label={t("common.back")} />
      <EmptyState icon="rss" title={t("channel.notFound")} hint={t("channel.notFoundHint")} />
    </div>
  );
}

function ChannelPage({ channel, catalogApps }: { channel: ChannelInfo; catalogApps: App[] }) {
  const { t } = useTranslation();
  const apps = useMemo(() => channelApps(catalogApps, channel.id), [catalogApps, channel.id]);
  return (
    <div className={styles.page}>
      <BackLink label={t("common.back")} />
      <ChannelHeader channel={channel} />
      <ChannelApps apps={apps} />
    </div>
  );
}
