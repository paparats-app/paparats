import { useTranslation } from "react-i18next";
import type { TrustLevel } from "@/services/types";
import type { AppIconSource } from "../AppCard";
import { AppIcon } from "../AppIcon";
import { Button, IconButton } from "../Button";
import { cx } from "../internal/cx";
import { Toggle } from "../Toggle";
import { TrustBadge } from "../TrustBadge";
import { WarnCallout } from "../WarnCallout";
import styles from "./ChannelRow.module.css";

/** The stale-channel callout under a row (unreachable ≥ 14 days, not acknowledged). */
export interface ChannelStale {
  /** "FOSS Friends hasn't answered for 16 days" (`sources.staleTitle`). */
  title: string;
  onKeep: () => void;
  onUnsubscribe: () => void;
}

interface ChannelRowBase {
  name: string;
  /** Monogram tile (`mono` on the channel tint). */
  icon: AppIconSource;
  trust: TrustLevel;
  /** "Developer · by Nilesoft · 12 apps". */
  meta: string;
  /** Opens the channel page. */
  onOpen: () => void;
  className?: string;
}

export type ChannelRowProps = ChannelRowBase &
  (
    | {
        /** Settings › Sources list row. */
        variant?: "settings";
        /** "Synced 2 days ago" / "Not synced yet" / "Unreachable for 16 days". */
        syncText?: string;
        /** Sync text in `--warn`. */
        unreachable?: boolean;
        /** The official catalog: "Always on" instead of the pause toggle. */
        official?: boolean;
        /** Not paused. Paused rows render at .55 opacity. */
        enabled: boolean;
        onEnabledChange: (enabled: boolean) => void;
        stale?: ChannelStale;
      }
    | {
        /** Add-channel dialog catalog row: "Learn more" + Subscribe. */
        variant: "catalog";
        onSubscribe: () => void;
      }
  );

const TRUST_KEY = {
  official: "sources.trustOfficial",
  verified: "sources.trustVerified",
  community: "sources.trustCommunity",
} as const;

/**
 * Channel list row: monogram tile, name + trust badge, meta, then sync state, the pause toggle
 * (or "Always on") and a chevron to the channel page; optional stale callout below
 * (prototype lines 830–850). The catalog variant (lines 1388–1396) ends in Subscribe.
 */
export function ChannelRow(props: ChannelRowProps) {
  const { t } = useTranslation();
  const { name, icon, trust, meta, onOpen, className } = props;
  const catalog = props.variant === "catalog";
  const paused = !catalog && !props.official && !props.enabled;

  const identity = (
    <>
      <AppIcon mono={icon.mono} tint={icon.tint} iconUrl={icon.iconUrl} size={catalog ? 40 : 44} />
      <span className={styles.text}>
        <span className={styles.nameLine}>
          <span className={styles.name}>{name}</span>
          <TrustBadge level={trust} label={t(TRUST_KEY[trust])} size={catalog ? "sm" : "md"} />
        </span>
        <span className={styles.meta}>{meta}</span>
      </span>
    </>
  );

  if (props.variant === "catalog") {
    return (
      <div className={cx(styles.row, styles.catalog, className)}>
        <div className={styles.identity}>{identity}</div>
        <Button variant="ghost" size="compact" className={styles.learn} onClick={onOpen}>
          {t("common.learnMore")}
        </Button>
        <Button size="compact" className={styles.subscribe} onClick={props.onSubscribe}>
          {t("common.subscribe")}
        </Button>
      </div>
    );
  }

  const stateLabel = props.enabled ? t("sources.enabledCh") : t("sources.pausedCh");
  return (
    <div className={cx(styles.item, className)} data-paused={paused || undefined}>
      <div className={styles.row}>
        <button
          type="button"
          className={cx(styles.identity, styles.identityButton, paused && styles.paused)}
          onClick={onOpen}
        >
          {identity}
        </button>
        {props.syncText !== undefined && (
          <div className={cx(styles.sync, props.unreachable && styles.syncWarn)}>
            {props.syncText}
          </div>
        )}
        {props.official ? (
          <span className={styles.alwaysOn}>{t("sources.alwaysOn")}</span>
        ) : (
          <Toggle
            checked={props.enabled}
            onChange={props.onEnabledChange}
            label={name}
            title={stateLabel}
          />
        )}
        <IconButton
          icon="chevron-right"
          label={name}
          size="compact"
          iconSize={16}
          className={styles.chevron}
          onClick={onOpen}
        />
      </div>
      {props.stale && (
        <WarnCallout
          title={props.stale.title}
          className={styles.stale}
          actions={[
            { label: t("common.keepChannel"), onClick: props.stale.onKeep },
            {
              label: t("common.unsubscribe"),
              onClick: props.stale.onUnsubscribe,
              destructive: true,
            },
          ]}
        >
          {t("common.staleBody")}
        </WarnCallout>
      )}
    </div>
  );
}
