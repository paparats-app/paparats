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
    // The password goes to the core, which drops it (no account API before M7, D24).
    signIn: (email, password) => unwrap(commands.accountSignIn(email, password)),
    signOut: () => unwrap(commands.accountSignOut()),
  };
}
