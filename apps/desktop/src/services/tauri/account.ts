// No account commands in bindings.ts yet: every method delegates to the mock. To switch one,
// replace its body with `unwrap(commands.<name>(…))` (see ./result.ts).
import type { AccountService } from "../contracts";

export function createTauriAccountService(mock: AccountService): AccountService {
  return {
    getAccount: () => mock.getAccount(),
    updateProfile: (patch) => mock.updateProfile(patch),
    removeDevice: (deviceId) => mock.removeDevice(deviceId),
    setTwoFactor: (enabled) => mock.setTwoFactor(enabled),
    purchase: (plan) => mock.purchase(plan),
    cancelPlan: () => mock.cancelPlan(),
    claimIdeaBonus: () => mock.claimIdeaBonus(),
    signIn: (email, password) => mock.signIn(email, password),
    signOut: () => mock.signOut(),
  };
}
