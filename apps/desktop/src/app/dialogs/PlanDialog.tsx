import { useState } from "react";
import { useTranslation } from "react-i18next";
import appIcon from "@/assets/images/paparats-icon.webp";
import { Button } from "@/components/Button";
import { Modal } from "@/components/Modal";
import { addMonths, addYears } from "@/domain/dates";
import { useToday } from "@/hooks";
import { useFormat } from "@/i18n/format";
import { useAccountActions, usePlatform } from "@/queries";
import type { IsoDate, PlanId } from "@/services/types";
import { useDialogStore } from "@/stores/useDialogStore";
import { useUiStore } from "@/stores/useUiStore";
import styles from "./PlanDialog.module.css";

type PaidPlan = Exclude<PlanId, "free">;

/** The renewal a purchase made today would get: one month or one year later. */
function renewalDate(plan: PaidPlan, today: IsoDate): IsoDate {
  return plan === "monthly" ? addMonths(today, 1) : addYears(today, 1);
}

export interface PlanDialogProps {
  plan: PaidPlan;
}

/**
 * "Confirm Paparats Pro Monthly" (prototype lines 1355–1366, logic `modalTitle` / `modalBody` /
 * `confirmPlan`): the exact charge and the renewal date, Cancel + Confirm. Confirming buys the plan
 * (the account's Pro state updates everywhere) and toasts "Welcome to Paparats Pro".
 */
export function PlanDialog({ plan }: PlanDialogProps) {
  const { t } = useTranslation();
  const format = useFormat();
  const today = useToday();
  const close = useDialogStore((s) => s.close);
  const notify = useUiStore((s) => s.notify);
  const { purchase } = useAccountActions();
  const offer = usePlatform().data?.plans.find((p) => p.id === plan);
  const [buying, setBuying] = useState(false);

  const body = offer ? (
    <p>
      {t("subscription.confirmBody", {
        price: format.price(offer.amount, offer.currency),
        date: format.date(renewalDate(plan, today)),
      })}
    </p>
  ) : undefined;

  const confirm = async () => {
    if (buying) return;
    setBuying(true);
    try {
      await purchase(plan);
      close();
      notify(t("subscription.planConfirmed"));
    } catch {
      // Nothing was charged (no failure copy in the handoff): keep the dialog so the user can retry.
      setBuying(false);
    }
  };

  return (
    <Modal
      open
      onClose={close}
      width={440}
      icon={<img className={styles.icon} src={appIcon} alt="" width={36} height={36} />}
      title={t("subscription.confirmTitle", { plan: t(`subscription.planNames.${plan}`) })}
      footer={
        <>
          <Button onClick={close}>{t("common.cancel")}</Button>
          <Button
            variant="primary"
            className={styles.confirm}
            disabled={!offer}
            loading={buying}
            onClick={() => void confirm()}
          >
            {t("subscription.confirm")}
          </Button>
        </>
      }
    >
      {body}
    </Modal>
  );
}
