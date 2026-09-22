import { useMemo } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import type { UseQueryResult } from "@tanstack/react-query";
import { useServices } from "@/services/registry";
import type { Account, PlanId, ProfilePatch } from "@/services/types";
import { queryKeys } from "./keys";

export function useAccount(): UseQueryResult<Account> {
  const { account } = useServices();
  return useQuery({ queryKey: queryKeys.account, queryFn: () => account.getAccount() });
}

export interface AccountActions {
  updateProfile(patch: ProfilePatch): Promise<Account>;
  removeDevice(deviceId: string): Promise<Account>;
  setTwoFactor(enabled: boolean): Promise<Account>;
  purchase(plan: Exclude<PlanId, "free">): Promise<Account>;
  cancelPlan(): Promise<Account>;
  claimIdeaBonus(): Promise<Account>;
  signIn(email: string, password: string): Promise<Account>;
  signOut(): Promise<Account>;
}

export function useAccountActions(): AccountActions {
  const { account } = useServices();
  const queryClient = useQueryClient();
  return useMemo(() => {
    const write = async (pending: Promise<Account>) => {
      const next = await pending;
      queryClient.setQueryData(queryKeys.account, next);
      return next;
    };
    return {
      updateProfile: (patch) => write(account.updateProfile(patch)),
      removeDevice: (deviceId) => write(account.removeDevice(deviceId)),
      setTwoFactor: (enabled) => write(account.setTwoFactor(enabled)),
      purchase: (plan) => write(account.purchase(plan)),
      cancelPlan: () => write(account.cancelPlan()),
      claimIdeaBonus: () => write(account.claimIdeaBonus()),
      signIn: (email, password) => write(account.signIn(email, password)),
      signOut: () => write(account.signOut()),
    };
  }, [account, queryClient]);
}
