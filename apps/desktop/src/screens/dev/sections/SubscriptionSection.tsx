import { useState } from "react";
import { useTranslation } from "react-i18next";
import { BenefitStrip, SubscriptionPlan } from "@/components/SubscriptionPlan";
import type { PlanId } from "@/services/types";
import { Specimen } from "./Gallery";
import { DesignFrame } from "./DesignFrame";
import { PLATFORM, useSample, WIDTH } from "./sampleData";
import styles from "./composites.module.css";

const FEATURES = ["f1", "f2", "f3", "f4", "f5"] as const;
const BENEFIT_ICONS = { b1: "sparkles", b2: "layers", b3: "heart", b4: "sprout" } as const;
const BENEFITS = ["b1", "b2", "b3", "b4"] as const;

/** Benefit strip + the three plan cards; "Choose plan" makes a plan current (click). */
export function SubscriptionSection() {
  const { t } = useTranslation();
  const { format } = useSample();
  const [current, setCurrent] = useState<PlanId>("free");
  const period = (id: PlanId) =>
    id === "free"
      ? t("subscription.forever")
      : id === "monthly"
        ? t("subscription.perMonth")
        : t("subscription.perYear");
  return (
    <Specimen
      caption="BenefitStrip · SubscriptionPlan current | recommended (monthly) | badge"
      wide
    >
      <DesignFrame width={WIDTH.library}>
        <div className={styles.stack}>
          <BenefitStrip
            items={BENEFITS.map((b) => ({
              icon: BENEFIT_ICONS[b],
              title: t(`subscription.benefits.${b}.title`),
              subtitle: t(`subscription.benefits.${b}.sub`),
            }))}
          />
          <div className={`${styles.grid} ${styles.cols3}`}>
            {PLATFORM.plans.map((plan) => (
              <SubscriptionPlan
                key={plan.id}
                name={t(`subscription.plans.${plan.id}.name`)}
                subtitle={t(`subscription.plans.${plan.id}.sub`)}
                price={format.price(plan.amount, plan.currency)}
                period={period(plan.id)}
                features={FEATURES.map((f) => t(`subscription.plans.${plan.id}.features.${f}`))}
                badge={plan.badge ? t(`subscription.${plan.badge}`) : undefined}
                current={plan.id === current}
                recommended={plan.id === "monthly"}
                buttonLabel={
                  plan.id === "free" ? t("subscription.cancelPlan") : t("subscription.choosePlan")
                }
                onSelect={() => setCurrent(plan.id)}
              />
            ))}
          </div>
        </div>
      </DesignFrame>
    </Specimen>
  );
}
