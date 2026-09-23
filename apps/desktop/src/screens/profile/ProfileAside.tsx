import { useId, useMemo } from "react";
import { useTranslation } from "react-i18next";
import { useNav } from "@/app/navigation";
import { ActivePill } from "@/components/ActivePill";
import { AppIcon } from "@/components/AppIcon";
import { Button } from "@/components/Button";
import { Card } from "@/components/Card";
import { Icon } from "@/components/Icon";
import { SectionHeader } from "@/components/SectionHeader";
import { StatTile } from "@/components/StatTile";
import { installedApps } from "@/domain/apps";
import { useInstalledIndex, useVisibleApps } from "@/hooks";
import { useFormat } from "@/i18n/format";
import { useProStatusView } from "@/screens/shared";
import type { Account, App } from "@/services/types";
import styles from "./ProfileScreen.module.css";

/** Rows in "Recent activity" (the prototype's five activity entries). */
const ACTIVITY_ROWS = 5;

/** The right column (prototype lines 939–964): Pro status, usage stats, recent activity. */
export function ProfileAside({ account }: { account: Account }) {
  return (
    <aside className={styles.aside}>
      <ProStatusCard />
      <UsageCard account={account} />
      <ActivityCard account={account} />
    </aside>
  );
}

/**
 * Plan name, "Active", price and renewal, Manage / Upgrade → Subscription (`useProStatusView`, the
 * same view the Subscription screen shows): a paid plan shows "$4.99 / month" and "Renews on …";
 * the idea gift shows "Paparats Pro · gift" and "Idea bonus · active until …"; the free plan shows
 * the upgrade hint.
 */
function ProStatusCard() {
  const { t } = useTranslation();
  const { go } = useNav();
  const { isPro, name, price, renews } = useProStatusView();
  const nameId = useId();

  return (
    <Card as="section" padding="lg" radius={12} tone="mint" aria-labelledby={nameId}>
      <div className={styles.proHead}>
        <div className={styles.proIdentity}>
          <Icon name="crown" size={22} className={styles.proIcon} />
          <div>
            <div id={nameId} className={styles.cardTitle}>
              {name}
            </div>
            <div className={styles.cardSub}>{t("profile.proActiveHint")}</div>
          </div>
        </div>
        {isPro && <ActivePill label={t("common.active")} size="md" />}
      </div>
      <div className={styles.proFoot}>
        {isPro ? (
          <div>
            <div className={styles.proPrice}>{price}</div>
            <div className={styles.proRenews}>{renews}</div>
          </div>
        ) : (
          <div className={styles.proFreeHint}>{t("common.proFreeHint")}</div>
        )}
        <Button
          className={styles.proCta}
          trailingIcon={<Icon name="arrow-right" size={14} strokeWidth={2} />}
          onClick={() => go({ to: "subscription" })}
        >
          {isPro ? t("subscription.manage") : t("subscription.upgrade")}
        </Button>
      </div>
    </Card>
  );
}

/** Apps installed, updates installed, time saved — three tiles on `--bg` (lines 950–956). */
function UsageCard({ account }: { account: Account }) {
  const { t } = useTranslation();
  const format = useFormat();
  const apps = useVisibleApps();
  const installedIndex = useInstalledIndex();
  const installedCount = installedApps(apps, installedIndex).length;
  return (
    <Card as="section" padding="lg" radius={12} aria-label={t("profile.usage")}>
      <div className={styles.cardTitle}>{t("profile.usage")}</div>
      <div className={styles.cardSubSpaced}>{t("profile.acrossApps")}</div>
      <div className={styles.usageGrid}>
        <StatTile
          variant="tile"
          icon="layout-grid"
          value={format.number(installedCount)}
          label={t("profile.appsInstalled")}
        />
        <StatTile
          variant="tile"
          icon="download"
          value={format.number(account.usage.updatesInstalled)}
          label={t("profile.updatesInstalled")}
        />
        <StatTile
          variant="tile"
          icon="clock"
          value={t("profile.hours", { hours: account.usage.timeSavedHours })}
          label={t("profile.timeSaved")}
        />
      </div>
    </Card>
  );
}

interface ActivityRow {
  key: string;
  app: App;
  text: string;
  version: string;
  when: string;
}

/**
 * The newest five activity entries of visible apps (the prototype's `activityRows`), with
 * "See all" → Updates (lines 957–962).
 */
function ActivityCard({ account }: { account: Account }) {
  const { t } = useTranslation();
  const format = useFormat();
  const { go } = useNav();
  const apps = useVisibleApps();

  const rows = useMemo(() => {
    const byId = new Map(apps.map((app) => [app.id, app]));
    const list: ActivityRow[] = [];
    account.activity.forEach((entry, index) => {
      const app = byId.get(entry.appId);
      if (!app || list.length >= ACTIVITY_ROWS) return;
      list.push({
        key: `${index}:${entry.appId}:${entry.version}`,
        app,
        text:
          entry.kind === "updated"
            ? t("profile.actUpdated", { app: app.name })
            : t("profile.actInstalled", { app: app.name }),
        version: entry.version,
        when: format.relative(entry.date),
      });
    });
    return list;
  }, [account.activity, apps, format, t]);

  return (
    <Card as="section" radius={12} padding="none" className={styles.activityCard}>
      <SectionHeader
        title={t("profile.recentActivity")}
        level={2}
        size="sm"
        actionLabel={t("common.seeAll")}
        onAction={() => go({ to: "updates" })}
        className={styles.activityHead}
      />
      <ul className={styles.activityList} aria-label={t("profile.recentActivity")}>
        {rows.map((row) => (
          <li key={row.key} className={styles.activityRow}>
            <AppIcon mono={row.app.mono} tint={row.app.tint} iconUrl={row.app.iconUrl} size={34} />
            <div className={styles.activityText}>
              <div className={styles.activityTitle}>{row.text}</div>
              <div className={styles.activityVersion}>{row.version}</div>
            </div>
            <div className={styles.activityWhen}>{row.when}</div>
          </li>
        ))}
      </ul>
    </Card>
  );
}
