// M4 "Account surfaces" end to end through the whole shell (renderApp): a plan bought on
// Subscription reaching the sidebar, the Subscription status card and the Profile card (and
// cancelled again); every Settings section, theme and language applied at once, Parallel
// downloads reshaping the live queue; Settings › About's update check; Profile tabs, Edit → Save,
// devices and Data & Privacy. Fails on any console error or warning.
import { act, fireEvent, screen, waitFor, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { vi } from "vitest";
import { SELF_UPDATE_CHECK_MS } from "@/services/mock";
import { useDownloadsStore } from "@/stores/useDownloadsStore";
import { useSettingsStore } from "@/stores/useSettingsStore";
import { useUiStore } from "@/stores/useUiStore";
import { flush, renderApp } from "@/test/render";

const sidebar = () => screen.getByRole("navigation", { name: "Main" });
const navItem = (name: RegExp) => within(sidebar()).getByRole("button", { name });
const subscriptionItem = () => navItem(/^Subscription/);
const h1 = () => screen.getByRole("heading", { level: 1 }).textContent;
const toast = () => useUiStore.getState().toast?.message;
const sectionNav = () => screen.getByRole("navigation", { name: "Settings sections" });

/** The plan cards in order: Free, Monthly, Yearly. */
function plans() {
  const [free, monthly, yearly] = screen.getAllByRole("article");
  if (!free || !monthly || !yearly) throw new Error("expected three plan cards");
  return { free, monthly, yearly };
}

/** The Profile screen's Pro card, named after the plan. */
const profileProCard = (name: string) => within(screen.getByRole("region", { name }));

const errors = vi.spyOn(console, "error");
const warnings = vi.spyOn(console, "warn");

beforeEach(() => {
  errors.mockClear();
  warnings.mockClear();
});

afterEach(() => {
  expect(errors).not.toHaveBeenCalled();
  expect(warnings).not.toHaveBeenCalled();
});

async function start(route = "/home") {
  const rendered = await renderApp({ route });
  // No navigation skeleton: every screen is on screen right after a click.
  await act(async () => {
    await useSettingsStore.getState().update({ animations: false });
  });
  return rendered;
}

describe("M4 account surfaces in the shell", () => {
  it("a plan bought on Subscription is Pro in the sidebar, on Subscription and on Profile", async () => {
    const user = userEvent.setup();
    const { services } = await start();

    await user.click(subscriptionItem());
    expect(h1()).toBe("Subscription");
    expect(within(subscriptionItem()).queryByText("Pro")).toBeNull();
    expect(screen.getByRole("region", { name: "Free plan" })).toBeInTheDocument();

    // Choose plan → the confirmation → the plan becomes current.
    await user.click(within(plans().yearly).getByRole("button", { name: "Choose plan" }));
    const dialog = screen.getByRole("dialog", { name: "Confirm Paparats Pro Yearly" });
    expect(dialog).toHaveTextContent("You will be charged $49 today. Renews on 15 September 2027.");
    await user.click(within(dialog).getByRole("button", { name: "Confirm" }));
    await waitFor(() => expect(screen.queryByRole("dialog")).toBeNull());
    expect(toast()).toBe("Welcome to Paparats Pro");
    expect(services.world.account.subscription.plan).toBe("yearly");

    expect(within(plans().yearly).getByRole("button", { name: "Current plan" })).toHaveAttribute(
      "aria-disabled",
      "true",
    );
    expect(within(plans().free).getByRole("button", { name: "Cancel plan" })).toBeEnabled();
    // Sidebar Pro pill and the Subscription status card.
    expect(within(subscriptionItem()).getByText("Pro")).toBeInTheDocument();
    const status = within(screen.getByRole("region", { name: "Paparats Pro Yearly" }));
    expect(status.getByText("Active")).toBeInTheDocument();
    expect(status.getByText("$49 / year")).toBeInTheDocument();
    expect(status.getByText("Renews on 15 September 2027")).toBeInTheDocument();

    // The Profile card says the same, and Manage returns to Subscription.
    await user.click(screen.getByRole("button", { name: "Profile" }));
    expect(h1()).toBe("Profile");
    const card = profileProCard("Paparats Pro Yearly");
    expect(card.getByText("Active")).toBeInTheDocument();
    expect(card.getByText("$49 / year")).toBeInTheDocument();
    expect(card.getByText("Renews on 15 September 2027")).toBeInTheDocument();
    await user.click(card.getByRole("button", { name: "Manage" }));
    expect(h1()).toBe("Subscription");

    // Cancel plan: Free everywhere again.
    await user.click(within(plans().free).getByRole("button", { name: "Cancel plan" }));
    await waitFor(() => expect(within(subscriptionItem()).queryByText("Pro")).toBeNull());
    expect(screen.getByRole("region", { name: "Free plan" })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Get Paparats Pro" })).toBeInTheDocument();
    await user.click(screen.getByRole("button", { name: "Profile" }));
    expect(profileProCard("Free plan").getByRole("button", { name: "Upgrade" })).toBeEnabled();
  });

  it("Settings: every listed section opens; theme and language apply to the whole window at once", async () => {
    const user = userEvent.setup();
    await start();
    await user.click(navItem(/^Settings/));
    expect(h1()).toBe("Settings");

    const sections = [
      "General",
      "Updates",
      "Downloads",
      "Sources",
      "Privacy",
      "Account",
      "Advanced",
      "About",
    ];
    expect(
      within(sectionNav())
        .getAllByRole("button")
        .map((b) => b.textContent),
    ).toEqual(sections);
    for (const name of sections) {
      await user.click(within(sectionNav()).getByRole("button", { name }));
      expect(within(sectionNav()).getByRole("button", { name })).toHaveAttribute(
        "aria-current",
        "page",
      );
      // Every panel is a region named after its section (About's heading is the brand).
      expect(screen.getByRole("region", { name })).toBeInTheDocument();
    }

    await user.click(within(sectionNav()).getByRole("button", { name: "General" }));
    await user.click(screen.getByRole("radio", { name: "Light" }));
    expect(document.documentElement.dataset.theme).toBe("light");
    await user.click(screen.getByRole("radio", { name: "Dark" }));
    expect(document.documentElement.dataset.theme).toBe("dark");

    await user.click(screen.getByRole("radio", { name: "Беларуская" }));
    const mainNav = await screen.findByRole("navigation", { name: "Галоўнае меню" });
    expect(within(mainNav).getByRole("button", { name: /^Налады/ })).toBeInTheDocument();
    expect(h1()).toBe("Налады");
    expect(document.documentElement.lang).toBe("be");
    await user.click(screen.getByRole("radio", { name: "English" }));
    expect(await screen.findByRole("navigation", { name: "Main" })).toBeInTheDocument();
  });

  it("Settings › Downloads › Parallel downloads reshapes the live queue", async () => {
    const user = userEvent.setup();
    const { services } = await start("/settings/downloads");
    const concurrency = vi.spyOn(services.downloads, "setConcurrency");
    await act(() =>
      useDownloadsStore.getState().enqueue(
        ["joplin", "ditto", "krita"].map((appId) => ({
          appId,
          version: "1.0.0",
          sizeMb: 500,
          kind: "install" as const,
        })),
      ),
    );
    const states = () =>
      useDownloadsStore.getState().order.map((id) => useDownloadsStore.getState().items[id]?.state);
    await waitFor(() => expect(states()).toEqual(["downloading", "downloading", "queued"]));

    const parallel = screen.getByRole("combobox", { name: "Parallel downloads" });
    await user.selectOptions(parallel, "4");
    await waitFor(() => expect(concurrency).toHaveBeenLastCalledWith(4));
    await waitFor(() => expect(states()).toEqual(["downloading", "downloading", "downloading"]));

    // Back to one at a time: running items finish, nothing new starts beside them.
    await user.selectOptions(parallel, "1");
    await waitFor(() => expect(concurrency).toHaveBeenLastCalledWith(1));
    expect((await services.downloads.getSnapshot()).concurrency).toBe(1);
    await act(() => services.downloads.cancelAll());
  });

  it("Settings › About › Check for updates: Checking… then the toast", async () => {
    await start("/settings/about");
    expect(await screen.findByText("Version 1.2.3 (Build 20260915)")).toBeInTheDocument();
    vi.useFakeTimers();
    try {
      const button = screen.getByRole("button", { name: "Check for updates" });
      fireEvent.click(button);
      await flush();
      expect(button).toHaveTextContent("Checking…");
      await flush(SELF_UPDATE_CHECK_MS);
      expect(button).toHaveTextContent("Check for updates");
      expect(toast()).toBe("You’re up to date!");
      // The toast is rendered by the shell.
      expect(screen.getAllByText("You’re up to date!").length).toBeGreaterThan(1);
    } finally {
      vi.clearAllTimers();
      vi.useRealTimers();
    }
  });

  it("Profile: tabs, Edit → Save → toast and avatar, devices, Data & Privacy", async () => {
    const user = userEvent.setup();
    const { services } = await start();
    await user.click(screen.getByRole("button", { name: "Profile" }));
    expect(h1()).toBe("Profile");

    const tabs = within(screen.getByRole("tablist", { name: "Profile sections" }));
    for (const name of ["Preferences", "Security", "Devices", "Data & Privacy", "Account"]) {
      await user.click(tabs.getByRole("tab", { name }));
      expect(tabs.getByRole("tab", { name })).toHaveAttribute("aria-selected", "true");
      expect(screen.getByRole("tabpanel", { name })).toBeInTheDocument();
    }

    // Edit → Save → toast; the header and the top bar's avatar follow.
    const header = within(screen.getByRole("region", { name: "Serj Kaje" }));
    await user.click(header.getByRole("button", { name: "Edit profile" }));
    await user.clear(screen.getByLabelText("Name"));
    await user.type(screen.getByLabelText("Name"), "Anna Lee");
    await user.click(screen.getByRole("button", { name: "Save" }));
    expect(await screen.findByRole("region", { name: "Anna Lee" })).toBeInTheDocument();
    expect(toast()).toBe("Profile saved");
    expect(within(screen.getByRole("button", { name: "Profile" })).getByText("AL")).toBeVisible();

    // Devices: Remove drops the other device; this device stays.
    await user.click(tabs.getByRole("tab", { name: "Devices" }));
    const devices = () => screen.getByRole("list", { name: "Devices" });
    expect(within(devices()).getAllByRole("listitem")).toHaveLength(2);
    await user.click(within(devices()).getByRole("button", { name: "Remove Surface Laptop 7" }));
    await waitFor(() => expect(within(devices()).getAllByRole("listitem")).toHaveLength(1));
    expect(within(devices()).getByText("This device")).toBeInTheDocument();
    expect(services.world.account.devices).toHaveLength(1);

    // Data & Privacy: both buttons are there and do nothing (never destructive).
    await user.click(tabs.getByRole("tab", { name: "Data & Privacy" }));
    const account = structuredClone(services.world.account);
    await user.click(screen.getByRole("button", { name: "Export…" }));
    await user.click(screen.getByRole("button", { name: "Delete…" }));
    expect(services.world.account).toEqual(account);
    expect(h1()).toBe("Profile");
  });
});
