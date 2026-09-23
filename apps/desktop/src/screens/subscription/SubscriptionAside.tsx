import { useId } from "react";
import { useTranslation } from "react-i18next";
import logoMark from "@/assets/images/paparats-mark-light.webp";
import { ActivePill } from "@/components/ActivePill";
import { Button } from "@/components/Button";
import { Icon } from "@/components/Icon";
import { StatTile } from "@/components/StatTile";
import { useFormat } from "@/i18n/format";
import type { PlatformStats } from "@/services/types";
import { useProStatusView } from "@/screens/shared";
import styles from "./SubscriptionScreen.module.css";

export interface SubscriptionAsideProps {
  stats: PlatformStats;
  /** "Upgrade" on the free plan: the monthly plan's confirmation. */
  onUpgrade: () => void;
}

/**
 * The Subscription side column (prototype lines 724–745): Your impact, the customer quote, the
 * ecosystem numbers and the Pro status card (plan, "Active", price and renewal, or Upgrade).
 */
export function SubscriptionAside({ stats, onUpgrade }: SubscriptionAsideProps) {
  const { t } = useTranslation();
  const format = useFormat();
  const status = useProStatusView();
  const ids = { impact: useId(), status: useId() };

  return (
    <aside className={styles.aside}>
      <section className={styles.panel} aria-labelledby={ids.impact}>
        <h2 id={ids.impact} className={styles.panelTitle}>
          {t("subscription.yourImpact")}
        </h2>
        <div className={styles.impact}>
          <img className={styles.mark} src={logoMark} alt="" width={30} height={30} />
          <div className={styles.impactBody}>{t("subscription.impactBody")}</div>
        </div>
      </section>

      <figure className={`${styles.panel} ${styles.quote}`}>
        <blockquote className={styles.quoteText}>
          {t("common.q1")}
          {t("subscription.testimonial")}
          {t("common.q2")}
        </blockquote>
        <figcaption className={styles.signature}>{t("subscription.testimonialBy")}</figcaption>
      </figure>

      <ul className={`${styles.panel} ${styles.ecosystem}`}>
        <li>
          <StatTile
            icon="users"
            value={format.plus(stats.developers)}
            label={t("common.statDevs")}
          />
        </li>
        <li>
          <StatTile icon="package" value={format.plus(stats.apps)} label={t("common.statApps")} />
        </li>
        <li>
          <StatTile
            icon="crown"
            value={format.plus(stats.proMembers)}
            label={t("common.statMembers")}
          />
        </li>
      </ul>

      <section className={`${styles.panel} ${styles.status}`} aria-labelledby={ids.status}>
        <div className={styles.statusHead}>
          <h2 id={ids.status} className={styles.statusName}>
            <Icon name="crown" size={18} className={styles.crown} />
            {status.name}
          </h2>
          {status.isPro && <ActivePill label={t("common.active")} />}
        </div>
        {status.isPro ? (
          <>
            <div className={styles.statusPrice}>{status.price}</div>
            <div className={styles.statusRenews}>{status.renews}</div>
          </>
        ) : (
          <>
            <div className={styles.statusHint}>{t("common.proFreeHint")}</div>
            <Button variant="primary" size="sm" className={styles.upgrade} onClick={onUpgrade}>
              {t("subscription.upgrade")}
            </Button>
          </>
        )}
      </section>
    </aside>
  );
}
