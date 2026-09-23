import { useLayoutEffect, useRef, useState, type MouseEvent } from "react";
import { useTranslation } from "react-i18next";
import { AppIcon } from "@/components/AppIcon";
import { Button } from "@/components/Button";
import { Chip } from "@/components/Chip";
import { Icon } from "@/components/Icon";
import { ToggleTrack } from "@/components/Toggle";
import { TRUST_KEY, TrustBadge } from "@/components/TrustBadge";
import { WarnCallout } from "@/components/WarnCallout";
import { pickLocalized } from "@/domain/text";
import { useChannelContext, useLocale } from "@/hooks";
import { KIND_KEY, useBusyAction } from "@/screens/shared";
import type { ChannelInfo } from "@/services/types";
import { ChannelDetails } from "./ChannelDetails";
import { useChannelCommands, type ChannelCommands } from "./useChannelCommands";
import styles from "./ChannelHeader.module.css";

/**
 * 96px monogram | name, trust, kind, meta, description, actions, warnings | Details
 * (prototype lines 1121–1164, `chView()` in the logic).
 */
export function ChannelHeader({ channel }: { channel: ChannelInfo }) {
  const { t } = useTranslation();
  const locale = useLocale();
  const ctx = useChannelContext();
  const commands = useChannelCommands(channel);
  const subscribed = ctx.isFollowed(channel.id);
  const paused = ctx.subscriptionOf(channel.id)?.paused ?? false;
  const official = channel.trust === "official";
  // Only a followed channel reports an outage (the prototype's `down = isSub ? downDays(c) : 0`).
  const downDays = subscribed ? ctx.downDays(channel.id) : 0;
  const stale = ctx.isStale(channel.id);
  // Keep / Unsubscribe on the callout: one call at a time.
  const [, runStale] = useBusyAction();

  return (
    <header className={styles.header}>
      <AppIcon mono={channel.mono} tint={channel.tint} size={96} />
      <div className={styles.main}>
        <div className={styles.titleRow}>
          <h1 className={styles.title}>{channel.name}</h1>
          <TrustBadge
            level={channel.trust}
            label={t(TRUST_KEY[channel.trust])}
            size="lg"
            iconSize={12}
          />
          <Chip className={styles.kind}>{t(KIND_KEY[channel.kind])}</Chip>
        </div>
        <div className={styles.meta}>
          <span>{t("sources.byAuthor", { author: channel.author })}</span>
          <span className={styles.sep} aria-hidden="true">
            ·
          </span>
          <span className={styles.handle}>{channel.handle}</span>
          <span className={styles.sep} aria-hidden="true">
            ·
          </span>
          <span>{t("sources.subscribersCount", { count: channel.subscribers })}</span>
        </div>
        <p className={styles.desc}>{pickLocalized(channel.desc, locale)}</p>

        <ChannelActionRow
          commands={commands}
          subscribed={subscribed}
          paused={paused}
          official={official}
        />

        {downDays > 0 && (
          <WarnCallout
            size="md"
            className={styles.stale}
            title={t("sources.staleTitle", { channel: channel.name, count: downDays })}
            actions={
              stale
                ? [
                    {
                      label: t("common.keepChannel"),
                      onClick: () => void runStale(commands.keep),
                    },
                    {
                      label: t("common.unsubscribe"),
                      onClick: () => void runStale(commands.unsubscribe),
                      destructive: true,
                    },
                  ]
                : undefined
            }
          >
            {t("common.staleBody")}
          </WarnCallout>
        )}
        {official ? (
          <div className={styles.note}>
            <Icon name="shield" size={15} strokeWidth={2} className={styles.officialIcon} />
            {t("channel.officialNote")}
          </div>
        ) : (
          <div className={styles.note}>
            <Icon name="info" size={15} strokeWidth={2} className={styles.infoIcon} />
            {t("channel.proNotCovered")}
          </div>
        )}
      </div>
      <ChannelDetails channel={channel} subscribed={subscribed} downDays={downDays} />
    </header>
  );
}

interface ChannelActionRowProps {
  commands: ChannelCommands;
  subscribed: boolean;
  paused: boolean;
  official: boolean;
}

/**
 * Subscribe, or "Subscribed" + the Enabled/Paused switch + Unsubscribe (not for the official
 * catalog); then Copy address, Report a problem and, while followed, Sync now (lines 1133–1142).
 * Subscribe, Unsubscribe and Sync now show their busy state and ignore presses while they run.
 * A keyboard press on Subscribe / Unsubscribe hands the focus to what replaces the button.
 */
function ChannelActionRow({ commands, subscribed, paused, official }: ChannelActionRowProps) {
  const { t } = useTranslation();
  const [following, runFollow] = useBusyAction();
  const [syncing, runSync] = useBusyAction();
  const [pressed, setPressed] = useState<"subscribe" | "unsubscribe" | null>(null);
  const subscribeRef = useRef<HTMLButtonElement>(null);
  const toggleRef = useRef<HTMLButtonElement>(null);
  const handoff = useRef(false);
  const follow = (which: "subscribe" | "unsubscribe") => (event: MouseEvent<HTMLButtonElement>) => {
    // Enter / Space fire the click with `detail` 0: only keyboard users get the focus moved.
    handoff.current = event.detail === 0;
    setPressed(which);
    void runFollow(which === "subscribe" ? commands.subscribe : commands.unsubscribe).finally(() =>
      setPressed(null),
    );
  };
  useLayoutEffect(() => {
    if (!handoff.current) return;
    handoff.current = false;
    (subscribed ? toggleRef : subscribeRef).current?.focus();
  }, [subscribed]);
  // The switch shows the requested state at once (the prototype's instant toggle) until the
  // subscription carries it; a refused call reverts it (like Settings › Sources).
  const [requested, setRequested] = useState<boolean | null>(null);
  const shownPaused = requested ?? paused;
  const togglePaused = () => {
    const next = !shownPaused;
    setRequested(next);
    void commands.setPaused(next).finally(() => {
      setRequested((current) => (current === next ? null : current));
    });
  };
  return (
    <div className={styles.actions}>
      {subscribed ? (
        <>
          <div className={styles.subscribed}>
            <Icon name="check" size={15} strokeWidth={2.6} />
            {t("channel.subscribed")}
          </div>
          {!official && (
            <>
              <Button
                ref={toggleRef}
                variant="outline"
                size="field"
                role="switch"
                aria-checked={!shownPaused}
                className={styles.toggle}
                leadingIcon={<ToggleTrack checked={!shownPaused} size="sm" />}
                onClick={togglePaused}
              >
                {shownPaused ? t("sources.pausedCh") : t("sources.enabledCh")}
              </Button>
              <Button
                variant="outline"
                size="field"
                className={styles.unsubscribe}
                loading={following && pressed === "unsubscribe"}
                onClick={follow("unsubscribe")}
              >
                {t("common.unsubscribe")}
              </Button>
            </>
          )}
        </>
      ) : (
        <Button
          ref={subscribeRef}
          variant="primary"
          size="field"
          className={styles.subscribe}
          leadingIcon={<Icon name="plus" size={16} strokeWidth={2.2} />}
          loading={following && pressed === "subscribe"}
          onClick={follow("subscribe")}
        >
          {t("common.subscribe")}
        </Button>
      )}
      <Button
        variant="outline"
        size="field"
        className={styles.secondary}
        leadingIcon={<Icon name="copy" size={15} strokeWidth={2} />}
        onClick={commands.copyAddress}
      >
        {t("channel.copyAddr")}
      </Button>
      <Button
        variant="outline"
        size="field"
        className={styles.secondary}
        leadingIcon={<Icon name="flag" size={15} strokeWidth={2} />}
        onClick={commands.report}
      >
        {t("common.reportProblem")}
      </Button>
      {subscribed && (
        <Button
          variant="outline"
          size="field"
          className={styles.secondary}
          leadingIcon={<Icon name="rotate-ccw" size={15} strokeWidth={2} />}
          loading={syncing}
          onClick={() => void runSync(commands.sync)}
        >
          {t("channel.syncNow")}
        </Button>
      )}
    </div>
  );
}
