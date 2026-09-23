// Subscription (prototype lines 674–746): banner, plans, Pro apps and the side column, and the
// plan flows — choose → confirm → Pro everywhere on the screen, cancel plan, the idea gift.
import { act, screen, waitFor, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { DialogHost } from "@/app/DialogHost";
import { ToastHost } from "@/app/ToastHost";
import { changeLocale } from "@/i18n";
import type { MockServices } from "@/services";
import { useBrowseStore } from "@/stores/useBrowseStore";
import { useDialogStore } from "@/stores/useDialogStore";
import { createTestServices, renderWithProviders } from "@/test/render";
import { SubscriptionScreen } from "./SubscriptionScreen";

async function openSubscription(services: MockServices = createTestServices()) {
  const rendered = await renderWithProviders(
    <>
      <SubscriptionScreen />
      <DialogHost />
      <ToastHost />
    </>,
    { route: "/subscription", services },
  );
  await screen.findByRole("heading", { level: 1, name: "Subscription" });
  return { ...rendered, path: () => rendered.router.state.location.pathname };
}

/** The plan cards in order: Free, Monthly, Yearly. */
function plans() {
  const [free, monthly, yearly] = screen.getAllByRole("article");
  if (!free || !monthly || !yearly) throw new Error("expected three plan cards");
  return { free, monthly, yearly };
}

const banner = () => screen.getByRole("banner");
/** The banner's status chip, whose label is three flex items ("<plan>", "·", "Active"). */
const chip = (text: string) =>
  within(banner()).getByText((_, el) => el?.tagName === "DIV" && el.textContent === text);
const statusCard = (name: string) => screen.getByRole("region", { name });
const toast = () => screen.queryByRole("status");

/** Services whose account is already on `plan` (renewing on `renewsOn`). */
function onPlan(plan: "monthly" | "yearly", renewsOn: string): MockServices {
  const services = createTestServices();
  services.world.account.subscription = { plan, renewsOn, giftUntil: null };
  return services;
}

describe("SubscriptionScreen", () => {
  it("renders the banner, benefits, plans, Pro apps and the side column", async () => {
    await openSubscription();

    const hero = banner();
    expect(within(hero).getByText("One subscription. More possibilities.")).toBeInTheDocument();
    expect(
      within(hero).getByText(/^Unlock advanced features across all Paparats apps/),
    ).toBeVisible();
    expect(within(hero).getByText("Small apps. Big possibilities.")).toBeInTheDocument();
    expect(within(hero).getByRole("button", { name: "Get Paparats Pro" })).toBeInTheDocument();
    expect(within(hero).getByRole("button", { name: "Learn more" })).toBeInTheDocument();

    for (const title of [
      "Unlock Pro features",
      "One simple plan",
      "Support developers",
      "A growing ecosystem",
    ]) {
      expect(screen.getByText(title)).toBeInTheDocument();
    }

    const { free, monthly, yearly } = plans();
    expect(within(free).getByRole("heading", { name: "Free" })).toBeInTheDocument();
    expect(within(free).getByText("$0")).toBeInTheDocument();
    expect(within(free).getByText("forever")).toBeInTheDocument();
    expect(within(free).getAllByRole("listitem")).toHaveLength(5);
    expect(free).toHaveAttribute("aria-current", "true");
    expect(within(free).getByRole("button", { name: "Current plan" })).toBeDisabled();

    expect(within(monthly).getByText("$4.99")).toBeInTheDocument();
    expect(within(monthly).getByText("/ month")).toBeInTheDocument();
    expect(within(monthly).getByText("Most popular")).toBeInTheDocument();
    expect(within(monthly).getByRole("button", { name: "Choose plan" })).toHaveAttribute(
      "data-variant",
      "primary",
    );
    expect(within(yearly).getByText("$49")).toBeInTheDocument();
    expect(within(yearly).getByText("/ year")).toBeInTheDocument();
    expect(within(yearly).getByText("Save 18%")).toBeInTheDocument();
    expect(within(yearly).getByText("Priority support")).toBeInTheDocument();

    const pro = screen.getByRole("region", { name: "Popular apps with Pro features" });
    const cards = within(pro).getAllByRole("listitem");
    const expected = [
      ["Obsidian", "Sync, publish, advanced plugins"],
      ["ShareX", "Cloud upload, advanced workflows"],
      ["Krita", "Advanced brushes, cloud backup"],
      ["RustDesk", "More devices, self-hosting"],
      ["Flow Launcher", "Cloud plugins, settings sync"],
    ] as const;
    expect(cards).toHaveLength(expected.length);
    expected.forEach(([name, note], index) => {
      const card = within(cards[index] as HTMLElement).getByRole("button");
      expect(within(card).getByText(name)).toBeInTheDocument();
      expect(within(card).getByText(note)).toBeInTheDocument();
      expect(within(card).getByText("Pro")).toBeInTheDocument();
    });

    expect(screen.getByRole("region", { name: "Your impact" })).toHaveTextContent(
      "Your subscription helps independent developers create and maintain great software.",
    );
    expect(
      screen.getByText(
        "“Paparats Pro helps me focus on my work. One subscription, so many amazing tools.”",
      ),
    ).toBeInTheDocument();
    expect(screen.getByText("— A happy user")).toBeInTheDocument();
    for (const [value, label] of [
      ["50+", "Independent developers"],
      ["200+", "Apps and counting"],
      ["10,000+", "Pro members"],
    ]) {
      expect(screen.getByText(value ?? "")).toBeInTheDocument();
      expect(screen.getByText(label ?? "")).toBeInTheDocument();
    }
    const status = statusCard("Free plan");
    expect(status).toHaveTextContent("Upgrade to unlock Pro features in every participating app.");
    expect(within(status).queryByText("Active")).toBeNull();
    expect(within(status).getByRole("button", { name: "Upgrade" })).toBeInTheDocument();
  });

  it("buys the monthly plan from Choose plan and shows Pro across the screen", async () => {
    const user = userEvent.setup();
    const { services } = await openSubscription();
    const purchase = vi.spyOn(services.account, "purchase");

    await user.click(within(plans().monthly).getByRole("button", { name: "Choose plan" }));
    const dialog = screen.getByRole("dialog", { name: "Confirm Paparats Pro Monthly" });
    expect(dialog).toHaveTextContent(
      "You will be charged $4.99 today. Renews on 15 October 2026. Cancel any time from Settings › Account.",
    );
    expect(within(dialog).getByRole("button", { name: "Cancel" })).toHaveFocus();

    await user.click(within(dialog).getByRole("button", { name: "Confirm" }));
    await waitFor(() => expect(screen.queryByRole("dialog")).toBeNull());
    expect(purchase).toHaveBeenCalledWith("monthly");
    expect(toast()).toHaveTextContent("Welcome to Paparats Pro");

    // The banner's first button becomes the status chip.
    expect(within(banner()).queryByRole("button", { name: "Get Paparats Pro" })).toBeNull();
    expect(chip("Paparats Pro Monthly · Active")).toBeInTheDocument();

    // The monthly card is current ("Current plan" replaces "Most popular"), the free one offers
    // to cancel.
    const { free, monthly, yearly } = plans();
    expect(monthly).toHaveAttribute("aria-current", "true");
    expect(within(monthly).getByRole("button", { name: "Current plan" })).toBeDisabled();
    expect(within(monthly).getAllByText("Current plan")).toHaveLength(2);
    expect(within(monthly).queryByText("Most popular")).toBeNull();
    expect(within(yearly).getByText("Save 18%")).toBeInTheDocument();
    expect(within(free).getByRole("button", { name: "Cancel plan" })).toBeEnabled();
    expect(within(yearly).getByRole("button", { name: "Choose plan" })).toBeEnabled();

    // The Pro status card: plan name, Active, price and renewal.
    const status = statusCard("Paparats Pro Monthly");
    expect(within(status).getByText("Active")).toBeInTheDocument();
    expect(within(status).getByText("$4.99 / month")).toBeInTheDocument();
    expect(within(status).getByText("Renews on 15 October 2026")).toBeInTheDocument();
    expect(within(status).queryByRole("button", { name: "Upgrade" })).toBeNull();
  });

  it("opens the monthly confirmation from Get Paparats Pro and from Upgrade", async () => {
    const user = userEvent.setup();
    await openSubscription();

    await user.click(within(banner()).getByRole("button", { name: "Get Paparats Pro" }));
    expect(useDialogStore.getState().dialog).toEqual({ kind: "plan", plan: "monthly" });
    await user.click(screen.getByRole("button", { name: "Cancel" }));
    expect(screen.queryByRole("dialog")).toBeNull();

    await user.click(within(statusCard("Free plan")).getByRole("button", { name: "Upgrade" }));
    expect(screen.getByRole("dialog", { name: "Confirm Paparats Pro Monthly" })).toBeVisible();
  });

  it("names the yearly charge and renewal a year from today", async () => {
    const user = userEvent.setup();
    await openSubscription();

    await user.click(within(plans().yearly).getByRole("button", { name: "Choose plan" }));
    const dialog = screen.getByRole("dialog", { name: "Confirm Paparats Pro Yearly" });
    expect(dialog).toHaveTextContent(
      "You will be charged $49 today. Renews on 15 September 2027. Cancel any time from Settings › Account.",
    );
    await user.click(within(dialog).getByRole("button", { name: "Confirm" }));
    await waitFor(() => expect(screen.queryByRole("dialog")).toBeNull());

    expect(chip("Paparats Pro Yearly · Active")).toBeInTheDocument();
    const status = statusCard("Paparats Pro Yearly");
    expect(within(status).getByText("$49 / year")).toBeInTheDocument();
    expect(within(status).getByText("Renews on 15 September 2027")).toBeInTheDocument();
    expect(plans().yearly).toHaveAttribute("aria-current", "true");
  });

  it("keeps the plan when the confirmation is cancelled", async () => {
    const user = userEvent.setup();
    const { services } = await openSubscription();
    const purchase = vi.spyOn(services.account, "purchase");

    await user.click(within(plans().yearly).getByRole("button", { name: "Choose plan" }));
    await user.keyboard("{Escape}");
    expect(screen.queryByRole("dialog")).toBeNull();
    expect(purchase).not.toHaveBeenCalled();
    expect(toast()).toBeNull();
    expect(plans().free).toHaveAttribute("aria-current", "true");
  });

  it("cancels a paid plan back to Free", async () => {
    const user = userEvent.setup();
    await openSubscription(onPlan("monthly", "2026-10-15"));
    expect(chip("Paparats Pro Monthly · Active")).toBeInTheDocument();

    await user.click(within(plans().free).getByRole("button", { name: "Cancel plan" }));

    await waitFor(() => expect(plans().free).toHaveAttribute("aria-current", "true"));
    expect(within(plans().free).getByRole("button", { name: "Current plan" })).toBeDisabled();
    expect(plans().monthly).not.toHaveAttribute("aria-current");
    expect(within(banner()).getByRole("button", { name: "Get Paparats Pro" })).toBeInTheDocument();
    expect(statusCard("Free plan")).toHaveTextContent("Upgrade");
    expect(toast()).toBeNull();
  });

  it("shows the idea gift as Paparats Pro · gift", async () => {
    const services = createTestServices();
    await services.account.claimIdeaBonus();
    await openSubscription(services);

    expect(chip("Paparats Pro · gift · Active")).toBeInTheDocument();
    expect(within(banner()).queryByRole("button", { name: "Get Paparats Pro" })).toBeNull();
    const status = statusCard("Paparats Pro · gift");
    expect(within(status).getByText("Active")).toBeInTheDocument();
    // The prototype repeats the gift label on the price line.
    expect(within(status).getAllByText("Paparats Pro · gift")).toHaveLength(2);
    expect(
      within(status).getByText("Idea bonus · active until 15 December 2026"),
    ).toBeInTheDocument();
    // The gift rides on the free plan, so the paid plans can still be bought.
    const { free, monthly } = plans();
    expect(free).toHaveAttribute("aria-current", "true");
    expect(within(monthly).getByRole("button", { name: "Choose plan" })).toBeEnabled();
  });

  it("leads to Settings › About, the Pro filter in Browse and the app pages", async () => {
    const user = userEvent.setup();
    const { path } = await openSubscription();

    await user.click(within(banner()).getByRole("button", { name: "Learn more" }));
    expect(path()).toBe("/settings/about");

    const pro = screen.getByRole("region", { name: "Popular apps with Pro features" });
    await user.click(within(pro).getByRole("button", { name: /^See all/ }));
    expect(path()).toBe("/browse");
    expect(useBrowseStore.getState()).toMatchObject({
      pro: true,
      categories: [],
      portable: false,
      sort: "featured",
      collection: null,
    });

    await user.click(within(pro).getByRole("button", { name: /^Krita/ }));
    expect(path()).toBe("/app/krita");
  });

  it("formats prices and dates in Russian", async () => {
    const user = userEvent.setup();
    await openSubscription();
    await act(() => changeLocale("ru"));

    expect(within(plans().monthly).getByText("4,99 $")).toBeInTheDocument();
    expect(screen.getByText("10 000+")).toBeInTheDocument();
    await user.click(within(plans().yearly).getByRole("button", { name: "Выбрать план" }));
    const dialog = screen.getByRole("dialog", { name: "Подтвердить Paparats Pro (год)" });
    expect(dialog).toHaveTextContent(
      "Сегодня будет списано 49 $. Следующее списание — 15 сентября 2027 г.",
    );
  });
});
