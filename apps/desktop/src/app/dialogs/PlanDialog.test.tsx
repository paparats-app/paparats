// Plan confirmation (prototype lines 1355–1366): title, the exact charge and renewal date,
// Cancel / Confirm, the purchase and its toast — and, through the whole shell, Pro everywhere.
import { act, fireEvent, screen, waitFor, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { changeLocale } from "@/i18n";
import { ServiceError } from "@/services";
import { useDialogStore } from "@/stores/useDialogStore";
import { useSettingsStore } from "@/stores/useSettingsStore";
import { useUiStore } from "@/stores/useUiStore";
import { createTestServices, renderApp, renderWithProviders } from "@/test/render";
import { DialogHost } from "../DialogHost";
import { ToastHost } from "../ToastHost";

async function openPlan(plan: "monthly" | "yearly", services = createTestServices()) {
  const rendered = await renderWithProviders(
    <>
      <DialogHost />
      <ToastHost />
    </>,
    { services },
  );
  act(() => useDialogStore.getState().open({ kind: "plan", plan }));
  return rendered;
}

describe("PlanDialog", () => {
  it("names the monthly charge and the renewal a month from today", async () => {
    await openPlan("monthly");
    const dialog = await screen.findByRole("dialog", { name: "Confirm Paparats Pro Monthly" });
    expect(
      await within(dialog).findByText(
        "You will be charged $4.99 today. Renews on 15 October 2026. Cancel any time from Settings › Account.",
      ),
    ).toBeInTheDocument();
    // The decorative 36px Paparats app icon.
    expect(dialog.querySelector("img[alt='']")).toHaveAttribute("width", "36");
    expect(within(dialog).getByRole("button", { name: "Cancel" })).toHaveFocus();
  });

  it("names the yearly charge and the renewal a year from today", async () => {
    await openPlan("yearly");
    const dialog = await screen.findByRole("dialog", { name: "Confirm Paparats Pro Yearly" });
    expect(
      await within(dialog).findByText(
        "You will be charged $49 today. Renews on 15 September 2027. Cancel any time from Settings › Account.",
      ),
    ).toBeInTheDocument();
  });

  it("counts the renewal from the app's today", async () => {
    await openPlan("monthly", createTestServices({ today: "2027-01-31" }));
    const dialog = await screen.findByRole("dialog");
    // Calendar months, clamped to the shorter month.
    expect(await within(dialog).findByText(/Renews on 28 February 2027\./)).toBeInTheDocument();
  });

  it("buys the plan on Confirm and welcomes the user", async () => {
    const user = userEvent.setup();
    const services = createTestServices();
    const purchase = vi.spyOn(services.account, "purchase");
    const { queryClient } = await openPlan("yearly", services);
    const dialog = await screen.findByRole("dialog");
    await within(dialog).findByText(/^You will be charged/);

    await user.click(within(dialog).getByRole("button", { name: "Confirm" }));
    await waitFor(() => expect(screen.queryByRole("dialog")).toBeNull());
    expect(purchase).toHaveBeenCalledTimes(1);
    expect(purchase).toHaveBeenCalledWith("yearly");
    expect(screen.getByRole("status")).toHaveTextContent("Welcome to Paparats Pro");
    expect(useDialogStore.getState().dialog).toBeNull();
    expect(queryClient.getQueryData(["account", "getAccount"])).toMatchObject({
      subscription: { plan: "yearly", renewsOn: "2027-09-15" },
    });
  });

  it("closes without buying on Cancel and on Escape", async () => {
    const user = userEvent.setup();
    const services = createTestServices();
    const purchase = vi.spyOn(services.account, "purchase");
    await openPlan("monthly", services);

    await user.click(await screen.findByRole("button", { name: "Cancel" }));
    expect(screen.queryByRole("dialog")).toBeNull();

    act(() => useDialogStore.getState().open({ kind: "plan", plan: "monthly" }));
    await screen.findByRole("dialog");
    await user.keyboard("{Escape}");
    expect(screen.queryByRole("dialog")).toBeNull();
    expect(purchase).not.toHaveBeenCalled();
    expect(useUiStore.getState().toast).toBeNull();
  });

  it("keeps the dialog when the purchase fails", async () => {
    const user = userEvent.setup();
    const services = createTestServices();
    vi.spyOn(services.account, "purchase").mockRejectedValue(
      new ServiceError("internal", "payment declined"),
    );
    await openPlan("monthly", services);
    const dialog = await screen.findByRole("dialog");
    await within(dialog).findByText(/^You will be charged/);

    await user.click(within(dialog).getByRole("button", { name: "Confirm" }));
    await waitFor(() =>
      expect(within(dialog).getByRole("button", { name: "Confirm" })).not.toHaveAttribute(
        "aria-busy",
      ),
    );
    expect(screen.getByRole("dialog")).toBeInTheDocument();
    expect(useUiStore.getState().toast).toBeNull();
  });

  it("speaks Belarusian", async () => {
    await openPlan("monthly");
    await act(() => changeLocale("be"));
    const dialog = await screen.findByRole("dialog", { name: "Падцвердзіць Paparats Pro (месяц)" });
    expect(dialog).toHaveTextContent(
      "Сёння спішацца 4,99 $. Наступнае спісанне — 15 кастрычніка 2026 г.",
    );
    expect(within(dialog).getByRole("button", { name: "Падцвердзіць" })).toBeInTheDocument();
  });
});

describe("Plan purchase through the shell", () => {
  it("turns on Pro in the sidebar and on the Subscription screen", async () => {
    const errors = vi.spyOn(console, "error");
    const warnings = vi.spyOn(console, "warn");
    await renderApp({ route: "/subscription" });
    await act(async () => {
      await useSettingsStore.getState().update({ animations: false });
    });
    await screen.findByRole("heading", { level: 1, name: "Subscription" });
    const sidebar = screen.getByRole("navigation", { name: "Main" });
    const item = within(sidebar).getByRole("button", { name: /^Subscription/ });
    expect(within(item).queryByText("Pro")).toBeNull();

    fireEvent.click(screen.getByRole("button", { name: "Get Paparats Pro" }));
    const dialog = await screen.findByRole("dialog", { name: "Confirm Paparats Pro Monthly" });
    fireEvent.click(within(dialog).getByRole("button", { name: "Confirm" }));
    await waitFor(() => expect(screen.queryByRole("dialog")).toBeNull());

    expect(within(item).getByText("Pro")).toBeInTheDocument();
    expect(
      screen.getByText(
        (_, el) => el?.tagName === "DIV" && el.textContent === "Paparats Pro Monthly · Active",
      ),
    ).toBeInTheDocument();
    expect(screen.getByRole("region", { name: "Paparats Pro Monthly" })).toHaveTextContent(
      "Renews on 15 October 2026",
    );
    expect(useUiStore.getState().toast?.message).toBe("Welcome to Paparats Pro");
    expect(errors).not.toHaveBeenCalled();
    expect(warnings).not.toHaveBeenCalled();
  });
});
