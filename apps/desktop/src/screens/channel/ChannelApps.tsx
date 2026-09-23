import { useId } from "react";
import { useTranslation } from "react-i18next";
import { EmptyState } from "@/components/EmptyState";
import { SectionHeader } from "@/components/SectionHeader";
import { StoreAppCard } from "@/screens/shared";
import type { App } from "@/services/types";
import styles from "./ChannelApps.module.css";

/**
 * "Apps in this channel" + count, then the 5-column store cards (category chip only) of every
 * app the channel offers, followed or not — or the empty card (prototype lines 1165–1182).
 */
export function ChannelApps({ apps }: { apps: readonly App[] }) {
  const { t } = useTranslation();
  const headingId = useId();
  return (
    <section aria-labelledby={headingId}>
      <SectionHeader
        id={headingId}
        title={t("channel.inChannel")}
        meta={t("common.appsCount", { count: apps.length })}
        className={styles.header}
      />
      {apps.length > 0 ? (
        <ul className={styles.cards} aria-labelledby={headingId}>
          {apps.map((app) => (
            <li key={app.id} className={styles.item} data-app-id={app.id}>
              <StoreAppCard app={app} channelChip={false} />
            </li>
          ))}
        </ul>
      ) : (
        <EmptyState
          size="md"
          framed
          wideHint
          title={t("channel.noChannelApps")}
          hint={t("channel.noChannelAppsHint")}
          className={styles.empty}
        />
      )}
    </section>
  );
}
