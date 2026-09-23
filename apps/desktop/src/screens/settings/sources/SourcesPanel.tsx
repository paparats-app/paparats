import { useId, useState } from "react";
import { useTranslation } from "react-i18next";
import { useNav } from "@/app/navigation";
import { Button } from "@/components/Button";
import { ChannelRow } from "@/components/ChannelRow";
import { Icon } from "@/components/Icon";
import { SettingsCard } from "@/components/SettingsRow";
import { TRUST_ICON } from "@/components/TrustBadge";
import { useChannelContext, useChannelFollow } from "@/hooks";
import { useFormat } from "@/i18n/format";
import { OFFICIAL_CHANNEL, type ChannelInfo } from "@/services/types";
import { channelIcon, TRUST_LEVELS, useChannelMeta } from "@/screens/shared";
import { useDialogStore } from "@/stores/useDialogStore";
import styles from "./SourcesPanel.module.css";

/**
 * Settings › Sources (prototype lines 823–865; logic `// sources & channels`, lines 2004–2014):
 * the header with Add channel, one card with the followed channels (sync state, the pause switch
 * or "Always on", the chevron to the channel page, the stale callout with Keep / Unsubscribe) and
 * the three "Trust levels" cards.
 */
export function SourcesPanel() {
  const { t } = useTranslation();
  const titleId = useId();
  const levelsId = useId();
  const openDialog = useDialogStore((s) => s.open);
  const ctx = useChannelContext();
  const channelMeta = useChannelMeta();

  // Followed channels in catalog order (the prototype's `sourceRows`).
  const rows = ctx.channels.filter((c) => ctx.isFollowed(c.id));

  return (
    <section aria-labelledby={titleId} data-testid="sources-panel">
      <div className={styles.header}>
        <div>
          <h2 id={titleId} className={styles.title}>
            {t("sources.sources")}
          </h2>
          <div className={styles.subtitle}>{t("sources.sourcesSub")}</div>
        </div>
        <Button
          variant="primary"
          className={styles.add}
          leadingIcon={<Icon name="plus" size={16} strokeWidth={2.2} />}
          onClick={() => openDialog({ kind: "addChannel" })}
        >
          {t("sources.addChannel")}
        </Button>
      </div>

      {ctx.ready && channelMeta.ready && (
        <SettingsCard className={styles.list}>
          {rows.map((channel) => (
            <SourceRow key={channel.id} channel={channel} meta={channelMeta.meta(channel)} />
          ))}
        </SettingsCard>
      )}

      <div id={levelsId} className={styles.overline}>
        {t("sources.trustLevels")}
      </div>
      <ul className={styles.levels} aria-labelledby={levelsId}>
        {TRUST_LEVELS.map(({ level, label, hint }) => (
          <li key={level} className={styles.level}>
            <div className={styles.levelHead}>
              <span className={`${styles.levelIcon} ${styles[level]}`}>
                <Icon name={TRUST_ICON[level]} size={14} strokeWidth={2} />
              </span>
              <span className={styles.levelLabel}>{t(label)}</span>
            </div>
            <div className={styles.levelHint}>{t(hint)}</div>
          </li>
        ))}
      </ul>
    </section>
  );
}

interface SourceRowProps {
  channel: ChannelInfo;
  meta: string;
}

/** One followed channel wired to the channel service, navigation and the toasts. */
function SourceRow({ channel, meta }: SourceRowProps) {
  const { t } = useTranslation();
  const format = useFormat();
  const { go } = useNav();
  const ctx = useChannelContext();
  const follow = useChannelFollow();
  const { id, name } = channel;
  // The switch shows the requested state until the subscription carries it (reverts on failure).
  const [requested, setRequested] = useState<boolean | null>(null);

  const official = id === OFFICIAL_CHANNEL;
  const enabled = requested ?? !ctx.subscriptionOf(id)?.paused;
  const down = ctx.downDays(id);
  // Empty for a channel that never synced (the prototype's `synced: ''`, e.g. Winaero right after
  // subscribing); the channel page's Last sync says "Not synced yet".
  const syncText =
    down > 0
      ? t("sources.unreachableFor", { count: down })
      : channel.synced
        ? t("sources.syncedRel", { when: format.relative(channel.synced) })
        : "";

  const setEnabled = (on: boolean) => {
    setRequested(on);
    void follow.setPaused(channel, !on).finally(() => {
      setRequested((current) => (current === on ? null : current));
    });
  };

  return (
    <ChannelRow
      name={name}
      icon={channelIcon(channel)}
      trust={channel.trust}
      meta={meta}
      syncText={syncText}
      unreachable={down > 0}
      official={official}
      enabled={enabled}
      onEnabledChange={setEnabled}
      onOpen={() => go({ to: "channel", channelId: id })}
      stale={
        ctx.isStale(id) && !official
          ? {
              title: t("sources.staleTitle", { channel: name, count: down }),
              onKeep: () => void follow.keep(channel),
              onUnsubscribe: () => void follow.unsubscribe(channel),
            }
          : undefined
      }
    />
  );
}
