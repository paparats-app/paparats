// What the app says about the user's plan: the Subscription banner chip and status card, and the
// Profile Pro card (the prototype's `proStatus`, `renderVals` "// subscription", lines 1983–1984).
import { useTranslation } from "react-i18next";
import { usePro } from "@/hooks";
import { useFormat } from "@/i18n/format";
import { usePlatform } from "@/queries";
import type { PlanPeriod } from "@/services/types";

/** Plan period → its label ("forever", "/ month", "/ year"). */
export const PERIOD_KEYS = {
  forever: "subscription.forever",
  month: "subscription.perMonth",
  year: "subscription.perYear",
} as const satisfies Record<PlanPeriod, string>;

export interface ProStatusView {
  isPro: boolean;
  /** "Paparats Pro Monthly" · "Paparats Pro · gift" · "Free plan". */
  name: string;
  /** "$4.99 / month"; the gift repeats "Paparats Pro · gift" (prototype); empty on the free plan. */
  price: string;
  /** "Renews on 15 October 2026" · "Idea bonus · active until 15 December 2026"; empty when free. */
  renews: string;
}

/** The plan in effect, as the Subscription and Profile screens show it. */
export function useProStatusView(): ProStatusView {
  const { t } = useTranslation();
  const format = useFormat();
  const pro = usePro();
  const plans = usePlatform().data?.plans ?? [];

  if (pro.isGift) {
    return {
      isPro: true,
      name: t("subscription.proGift"),
      price: t("subscription.proGift"),
      renews: pro.giftUntil
        ? t("subscription.giftUntil", { date: format.date(pro.giftUntil) })
        : "",
    };
  }
  if (pro.planId === "free") {
    return { isPro: false, name: t("subscription.proFree"), price: "", renews: "" };
  }
  const plan = plans.find((p) => p.id === pro.planId);
  return {
    isPro: true,
    name: t(`subscription.planNames.${pro.planId}`),
    price: plan ? `${format.price(plan.amount, plan.currency)} ${t(PERIOD_KEYS[plan.period])}` : "",
    renews: pro.renewsOn ? t("subscription.renewsOn", { date: format.date(pro.renewsOn) }) : "",
  };
}
