// Subscription — banner, benefits, the three plans, "Popular apps with Pro features" and the side
// column (Paparats Prototype.dc.html lines 674–746, `renderVals` "// subscription" 1972–1986).
import { useId, useMemo } from "react";
import { useTranslation } from "react-i18next";
import subHero from "@/assets/images/sub-hero.webp";
import { useNav } from "@/app/navigation";
import { AppCard } from "@/components/AppCard";
import { Button } from "@/components/Button";
import { Icon } from "@/components/Icon";
import { PageBanner } from "@/components/PageBanner";
import { SectionHeader } from "@/components/SectionHeader";
import { BenefitStrip, type Benefit } from "@/components/SubscriptionPlan";
import { SubscriptionPlan } from "@/components/SubscriptionPlan";
import { pickByIds } from "@/domain/apps";
import { pickText } from "@/domain/text";
import { useChannelContext, useLocale, usePro, useVisibleApps } from "@/hooks";
import { useFormat } from "@/i18n/format";
import { useAccount, useAccountActions, useCatalog, useLibrary, usePlatform } from "@/queries";
import type { Plan } from "@/services/types";
import { useDialogStore } from "@/stores/useDialogStore";
import { PERIOD_KEYS, useProStatusView } from "@/screens/shared";
import { SubscriptionAside } from "./SubscriptionAside";
import styles from "./SubscriptionScreen.module.css";

/** Feature lines of a plan (`subscription.plans.<id>.features.f1…fN`, N = `Plan.featureCount`). */
const FEATURE_INDEXES = [1, 2, 3, 4, 5] as const;

/** The benefit strip's glyphs, in the prototype's order (`benefits` in the data file). */
const BENEFITS = [
  { id: "b1", icon: "infinity" },
  { id: "b2", icon: "zap" },
  { id: "b3", icon: "heart" },
  { id: "b4", icon: "users" },
] as const;

export function SubscriptionScreen() {
  const { t } = useTranslation();
  const { go } = useNav();
  const catalog = useCatalog().data;
  const platform = usePlatform().data;
  const account = useAccount().data;
  const library = useLibrary().data;
  const { ready: channelsReady } = useChannelContext();
  const visible = useVisibleApps();
  const status = useProStatusView();
  const openDialog = useDialogStore((s) => s.open);
  // Hidden apps are skipped (the prototype's `byIds`).
  const proApps = useMemo(() => pickByIds(visible, catalog?.proApps ?? []), [visible, catalog]);

  // Rendered once everything is in (the navigation skeleton covers the wait), so neither the
  // plan state nor the Pro apps flash.
  if (!catalog || !platform || !account || !library || !channelsReady) return null;

  const openPro = () => openDialog({ kind: "plan", plan: "monthly" });
  const benefits: Benefit[] = BENEFITS.map((b) => ({
    icon: b.icon,
    title: t(`subscription.benefits.${b.id}.title`),
    subtitle: t(`subscription.benefits.${b.id}.sub`),
  }));

  return (
    <div className={styles.screen}>
      <PageBanner
        title={t("nav.subscription")}
        motto={t("common.mottoA")}
        size="xl"
        photo={subHero}
      >
        <div className={styles.lead}>{t("subscription.subLead")}</div>
        <p className={styles.body}>{t("subscription.subBody")}</p>
        <div className={styles.bannerActions}>
          {status.isPro ? (
            <div className={styles.statusChip}>
              <Icon name="check" size={16} strokeWidth={2.4} />
              {/* Three flex items like the prototype's: the 8px gap also spaces the dot. */}
              <span>{status.name}</span>
              {" · "}
              <span>{t("common.active")}</span>
            </div>
          ) : (
            <Button variant="primaryOnImage" size="lg" className={styles.getPro} onClick={openPro}>
              {t("subscription.getPro")}
            </Button>
          )}
          <Button
            variant="onImage"
            size="lg"
            className={styles.learnMore}
            onClick={() => go({ to: "settings", section: "about" })}
          >
            {t("common.learnMore")}
          </Button>
        </div>
      </PageBanner>

      <div className={styles.layout}>
        <div className={styles.main}>
          <BenefitStrip items={benefits} />
          <Plans plans={platform.plans} />
          <ProApps apps={proApps} onSeeAll={() => go({ to: "browse", filters: { pro: true } })} />
        </div>
        <SubscriptionAside stats={platform.platformStats} onUpgrade={openPro} />
      </div>
    </div>
  );
}

/** The three plan cards, equal height (prototype lines 698–709, `planList`). */
function Plans({ plans }: { plans: readonly Plan[] }) {
  const { t } = useTranslation();
  const format = useFormat();
  const { planId } = usePro();
  const { cancelPlan } = useAccountActions();
  const openDialog = useDialogStore((s) => s.open);

  const select = (plan: Plan) => {
    if (plan.id === planId) return;
    if (plan.id === "free") {
      // No failure copy in the handoff: a failed cancel leaves the plan as it was.
      cancelPlan().catch(() => undefined);
      return;
    }
    openDialog({ kind: "plan", plan: plan.id });
  };

  return (
    <div className={styles.plans}>
      {plans.map((plan) => (
        <SubscriptionPlan
          key={plan.id}
          name={t(`subscription.plans.${plan.id}.name`)}
          subtitle={t(`subscription.plans.${plan.id}.sub`)}
          price={format.price(plan.amount, plan.currency)}
          period={t(PERIOD_KEYS[plan.period])}
          features={FEATURE_INDEXES.slice(0, plan.featureCount).map((n) =>
            t(`subscription.plans.${plan.id}.features.f${n}`),
          )}
          // "Most popular" / "Save 18%", or "Current plan" on the plan in effect (README §6): the
          // prototype showed both, and the second pill ran out of the card.
          badge={plan.badge && plan.id !== planId ? t(`subscription.${plan.badge}`) : undefined}
          current={plan.id === planId}
          recommended={plan.id === "monthly"}
          buttonLabel={
            plan.id === "free" ? t("subscription.cancelPlan") : t("subscription.choosePlan")
          }
          onSelect={() => select(plan)}
        />
      ))}
    </div>
  );
}

interface ProAppsProps {
  apps: ReturnType<typeof pickByIds>;
  onSeeAll: () => void;
}

/** "Popular apps with Pro features": 5-column link cards with the Pro pill (lines 711–722). */
function ProApps({ apps, onSeeAll }: ProAppsProps) {
  const { t } = useTranslation();
  const { go } = useNav();
  const locale = useLocale();
  const headingId = useId();

  return (
    <section aria-labelledby={headingId}>
      <SectionHeader
        id={headingId}
        title={t("subscription.popularPro")}
        size="md"
        actionLabel={t("common.seeAll")}
        onAction={onSeeAll}
        className={styles.proHeader}
      />
      <ul className={styles.proGrid}>
        {apps.map((app) => (
          <li key={app.id} className={styles.proItem}>
            <AppCard
              name={app.name}
              icon={{ mono: app.mono, tint: app.tint, iconUrl: app.iconUrl }}
              tagline={app.proNote ? pickText(app.proNote, locale) : undefined}
              proLabel={t("common.pro")}
              onOpen={() => go({ to: "app", appId: app.id })}
            />
          </li>
        ))}
      </ul>
    </section>
  );
}
