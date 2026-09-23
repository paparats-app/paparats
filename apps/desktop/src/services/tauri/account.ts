import { commands } from "@/bindings";
import type { AccountService } from "../contracts";
import { unwrap } from "./result";

export function createTauriAccountService(): AccountService {
  return {
    getAccount: () => unwrap(commands.accountGet()),
    updateProfile: (patch) => unwrap(commands.accountUpdateProfile(patch)),
    removeDevice: (deviceId) => unwrap(commands.accountRemoveDevice(deviceId)),
    setTwoFactor: (enabled) => unwrap(commands.accountSetTwoFactor(enabled)),
    purchase: (plan) => unwrap(commands.accountPurchase(plan)),
    cancelPlan: () => unwrap(commands.accountCancelPlan()),
    claimIdeaBonus: () => unwrap(commands.accountClaimIdeaBonus()),
    // The core drops the password. With PAPARATS_REAL=account it opens the browser sign-in and
    // resolves when the paparats://auth/callback link comes back (D56).
    signIn: (email, password) => unwrap(commands.accountSignIn(email, password)),
    signOut: () => unwrap(commands.accountSignOut()),
  };
}
