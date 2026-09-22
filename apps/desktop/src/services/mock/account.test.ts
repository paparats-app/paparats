import { createMockServices } from "./index";
import type { MockServices } from "./index";
import { createMemoryStorage } from "./runtime";

let services: MockServices;

beforeEach(() => {
  services = createMockServices({ latencyMs: 0, storage: createMemoryStorage() });
});

afterEach(() => services.dispose());

describe("mock account", () => {
  it("purchase renews one period from today; cancelPlan returns to free", async () => {
    const { account } = services;
    expect((await account.purchase("monthly")).subscription).toEqual({
      plan: "monthly",
      renewsOn: "2026-10-15",
      giftUntil: null,
    });
    expect((await account.purchase("yearly")).subscription).toMatchObject({
      plan: "yearly",
      renewsOn: "2027-09-15",
    });
    expect((await account.cancelPlan()).subscription).toEqual({
      plan: "free",
      renewsOn: null,
      giftUntil: null,
    });
  });

  it("clamps the renewal day to the end of a shorter month", async () => {
    const fresh = createMockServices({
      latencyMs: 0,
      today: "2026-01-31",
      storage: createMemoryStorage(),
    });
    expect((await fresh.account.purchase("monthly")).subscription.renewsOn).toBe("2026-02-28");
  });

  it("claimIdeaBonus grants Pro until meta.ideaBonusUntil and keeps it past cancelPlan", async () => {
    const { account } = services;
    expect((await account.claimIdeaBonus()).subscription.giftUntil).toBe("2026-12-15");
    expect((await account.cancelPlan()).subscription.giftUntil).toBe("2026-12-15");
  });

  it("updates the profile, rejecting empty fields without partial writes", async () => {
    const { account } = services;
    const next = await account.updateProfile({ name: " Serj K. ", email: "serj@example.com" });
    expect(next.profile).toMatchObject({ name: "Serj K.", email: "serj@example.com" });
    await expect(account.updateProfile({ name: "New", email: " " })).rejects.toMatchObject({
      kind: "invalid",
    });
    expect((await account.getAccount()).profile.name).toBe("Serj K.");
  });

  it("removes other devices but never this PC", async () => {
    const { account } = services;
    expect((await account.removeDevice("dev-2")).devices.map((d) => d.id)).toEqual(["dev-1"]);
    await expect(account.removeDevice("dev-1")).rejects.toMatchObject({ kind: "invalid" });
    await expect(account.removeDevice("dev-9")).rejects.toMatchObject({ kind: "notFound" });
  });

  it("toggles two-factor and signs out / in", async () => {
    const { account } = services;
    expect((await account.setTwoFactor(false)).twoFactor).toBe(false);
    expect((await account.signOut()).signedIn).toBe(false);
    const signedIn = await account.signIn(" me@example.org ", "secret");
    expect(signedIn.signedIn).toBe(true);
    expect(signedIn.profile.email).toBe("me@example.org");
    await expect(account.signIn("", "x")).rejects.toMatchObject({ kind: "invalid" });
  });
});
