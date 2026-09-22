import { addMonths, addYears } from "@/domain/dates";
import type { AccountService } from "../contracts";
import { ServiceError } from "../errors";
import { mustFind, requireText } from "./runtime";
import type { MockContext } from "./runtime";
import type { MockWorld } from "./world";

export function createMockAccountService(world: MockWorld, ctx: MockContext): AccountService {
  const account = world.account;

  return {
    getAccount: () => ctx.respond(() => account),

    updateProfile: (patch) =>
      ctx.respond(() => {
        const name = requireText(patch.name, "Name");
        const email = requireText(patch.email, "Email");
        account.profile = { ...account.profile, name, email };
        return account;
      }),

    removeDevice: (deviceId) =>
      ctx.respond(() => {
        const device = mustFind(account.devices, (d) => d.id === deviceId, `Device ${deviceId}`);
        if (device.current) throw new ServiceError("invalid", "This PC cannot be removed");
        account.devices = account.devices.filter((d) => d !== device);
        return account;
      }),

    setTwoFactor: (enabled) =>
      ctx.respond(() => {
        account.twoFactor = enabled;
        return account;
      }),

    // Renewal is one period from today: 2026-10-15 (monthly) / 2027-09-15 (yearly).
    purchase: (plan) =>
      ctx.respond(() => {
        const renewsOn = plan === "monthly" ? addMonths(ctx.today, 1) : addYears(ctx.today, 1);
        account.subscription = { ...account.subscription, plan, renewsOn };
        return account;
      }),

    cancelPlan: () =>
      ctx.respond(() => {
        account.subscription = { ...account.subscription, plan: "free", renewsOn: null };
        return account;
      }),

    claimIdeaBonus: () =>
      ctx.respond(() => {
        account.subscription.giftUntil = world.meta.ideaBonusUntil;
        return account;
      }),

    signIn: (email) =>
      ctx.respond(() => {
        account.profile.email = requireText(email, "Email");
        account.signedIn = true;
        return account;
      }),

    signOut: () =>
      ctx.respond(() => {
        account.signedIn = false;
        return account;
      }),
  };
}
