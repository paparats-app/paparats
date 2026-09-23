// Subscription, keyboard only: the tab order (the current plan's disabled button is skipped, the
// two "Choose plan" buttons are told apart by their plan), the confirmation taking the focus,
// trapping it and giving it back, and Confirm busy while the purchase runs.
import { screen, within } from "@testing-library/react";
import { vi } from "vitest";
import { createTestServices } from "@/test/render";
import {
  expectNamedControls,
  expectTabOrder,
  focusBeforeScreen,
  openScreen,
} from "@/screens/shared/a11yTesting";

const choose = () => screen.getAllByRole("button", { name: "Choose plan" });

async function openSubscription(services = createTestServices()) {
  const opened = await openScreen("/subscription", services);
  await screen.findByRole("button", { name: "Get Paparats Pro" });
  return opened;
}

describe("Subscription a11y", () => {
  it("tabs past the current plan and names each plan's button", async () => {
    const { user } = await openSubscription();
    const current = screen.getByRole("button", { name: "Current plan" });
    expect(current).toBeDisabled();
    const [monthly, yearly] = choose();
    if (!monthly || !yearly) throw new Error("expected two plan buttons");
    expect(monthly).toHaveAccessibleDescription(/^Paparats Pro .+\/ month$/);
    expect(yearly).toHaveAccessibleDescription(/^Paparats Pro .+\/ year$/);

    focusBeforeScreen();
    await expectTabOrder(user, [
      screen.getByRole("button", { name: "Get Paparats Pro" }),
      screen.getByRole("button", { name: "Learn more" }),
      monthly,
      yearly,
      screen.getByRole("button", { name: "See all" }),
    ]);
    expectNamedControls();
  });

  it("confirms a plan with the keyboard; Escape gives the focus back", async () => {
    const { user } = await openSubscription();
    const [monthly] = choose();
    if (!monthly) throw new Error("no plan button");
    monthly.focus();
    await user.keyboard("{Enter}");
    const dialog = screen.getByRole("dialog", { name: "Confirm Paparats Pro Monthly" });
    const cancel = within(dialog).getByRole("button", { name: "Cancel" });
    const confirm = within(dialog).getByRole("button", { name: "Confirm" });
    expect(cancel).toHaveFocus();
    await user.tab();
    expect(confirm).toHaveFocus();
    await user.tab();
    expect(cancel).toHaveFocus();
    await user.keyboard("{Escape}");
    expect(screen.queryByRole("dialog")).toBeNull();
    expect(monthly).toHaveFocus();
  });

  it("keeps Confirm busy and buys once while the purchase runs", async () => {
    const services = createTestServices();
    const purchase = vi
      .spyOn(services.account, "purchase")
      .mockImplementation(() => new Promise(() => {}));
    const { user } = await openSubscription(services);
    const [monthly] = choose();
    if (!monthly) throw new Error("no plan button");
    await user.click(monthly);
    const confirm = within(screen.getByRole("dialog")).getByRole("button", { name: "Confirm" });
    confirm.focus();
    await user.keyboard("{Enter}");
    expect(confirm).toHaveAttribute("aria-busy", "true");
    await user.keyboard("{Enter}");
    expect(purchase).toHaveBeenCalledTimes(1);
  });
});
