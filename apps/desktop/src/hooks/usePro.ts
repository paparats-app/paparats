import { useMemo } from "react";
import { compareIso } from "@/domain/dates";
import { useAccount } from "@/queries";
import type { IsoDate, PlanId } from "@/services/types";
import { useToday } from "./useToday";

export interface ProStatus {
  /** A paid plan, or the idea thank-you gift while it runs. */
  isPro: boolean;
  /** Pro comes from the gift on top of the free plan ("Paparats Pro · gift"). */
  isGift: boolean;
  planId: PlanId;
  renewsOn: IsoDate | null;
  giftUntil: IsoDate | null;
}

/** Paparats Pro state from the account (free while the account loads). */
export function usePro(): ProStatus {
  const subscription = useAccount().data?.subscription;
  const today = useToday();

  return useMemo(() => {
    const planId = subscription?.plan ?? "free";
    const giftUntil = subscription?.giftUntil ?? null;
    const giftActive = giftUntil !== null && compareIso(today, giftUntil) <= 0;
    return {
      isPro: planId !== "free" || giftActive,
      isGift: planId === "free" && giftActive,
      planId,
      renewsOn: subscription?.renewsOn ?? null,
      giftUntil,
    };
  }, [subscription, today]);
}
