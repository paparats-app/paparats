import { act, screen, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { vi } from "vitest";
import { queryKeys } from "@/queries";
import type { MockServices } from "@/services";
import { useProfileStore } from "@/stores/useProfileStore";
import { useSettingsStore } from "@/stores/useSettingsStore";
import { useUiStore } from "@/stores/useUiStore";
import { createTestServices, renderApp, renderWithProviders } from "@/test/render";
import { ProfileScreen } from "./ProfileScreen";

const toast = () => useUiStore.getState().toast?.message;
const header = () => screen.getByRole("region", { name: "Serj Kaje" });
const tab = (name: string) => screen.getByRole("tab", { name });
const panel = () => screen.getByRole("tabpanel");

async function openProfile(services?: MockServices) {
  const rendered = await renderWithProviders(<ProfileScreen />, { route: "/profile", services });
  await screen.findByRole("heading", { level: 1, name: "Profile" });
  return rendered;
}

/** Text of each "Recent activity" row: tile, action, version, time. */
const activity = () =>
  within(screen.getByRole("list", { name: "Recent activity" }))
    .getAllByRole("listitem")
    .map((li) => li.textContent);

const errors = vi.spyOn(console, "error");
const warnings = vi.spyOn(console, "warn");

beforeEach(() => {
  errors.mockClear();
  warnings.mockClear();
});

afterEach(() => {
  // No React warning (act, keys, controlled inputs) and no error anywhere in these flows.
  expect(errors).not.toHaveBeenCalled();
  expect(warnings).not.toHaveBeenCalled();
});

describe("ProfileScreen", () => {
  it("renders the banner, the header, the Account tab and the right column", async () => {
    await openProfile();
    expect(screen.getByText("Manage your account, devices and preferences.")).toBeInTheDocument();
    expect(screen.getByText("Good tools. Brighter days.")).toBeInTheDocument();

    const card = within(header());
    expect(card.getByRole("heading", { name: "Serj Kaje" })).toBeInTheDocument();
    expect(card.getByText("serj.kaje@example.com")).toBeInTheDocument();
    expect(card.getByText("Member since September 2024")).toBeInTheDocument();
    expect(card.getByText("SK")).toBeInTheDocument();
    expect(card.getByRole("button", { name: "Change photo" })).toBeInTheDocument();
    expect(card.getByRole("button", { name: "Edit profile" })).toBeInTheDocument();

    const tabs = within(screen.getByRole("tablist", { name: "Profile sections" }));
    expect(tabs.getAllByRole("tab").map((t) => t.textContent)).toEqual([
      "Account",
      "Preferences",
      "Security",
      "Devices",
      "Data & Privacy",
    ]);
    expect(tab("Account")).toHaveAttribute("aria-selected", "true");

    expect(screen.getByRole("heading", { level: 2, name: "Account information" })).toBeVisible();
    const rows = within(panel())
      .getAllByRole("button")
      .map((b) => b.textContent);
    expect(rows).toEqual([
      "NameSerj Kaje",
      "Emailserj.kaje@example.com",
      "CountrySweden",
      "LanguageEnglish",
      "Time zone(UTC+01:00) Stockholm",
    ]);
    expect(screen.getByText("Good tools find good hands.")).toBeInTheDocument();

    // Free plan: the upgrade hint and Upgrade, no Active pill.
    expect(screen.getByText("Free plan")).toBeInTheDocument();
    expect(screen.getByText("More tools. Greater possibilities.")).toBeInTheDocument();
    expect(
      screen.getByText("Upgrade to unlock Pro features in every participating app."),
    ).toBeInTheDocument();
    expect(screen.queryByText("Active")).toBeNull();
    expect(screen.getByRole("button", { name: "Upgrade" })).toBeInTheDocument();

    const usage = within(screen.getByRole("region", { name: "Usage stats" }));
    expect(usage.getByText("Across all your apps")).toBeInTheDocument();
    expect(usage.getByText("14").nextSibling).toHaveTextContent("Apps installed");
    expect(usage.getByText("248").nextSibling).toHaveTextContent("Updates installed");
    expect(usage.getByText("320 h").nextSibling).toHaveTextContent("Time saved");
  });

  it("lists the recent activity and opens Updates from See all", async () => {
    const user = userEvent.setup();
    const { router } = await openProfile();
    expect(activity()).toEqual([
      "ObUpdated Obsidian1.8.92 days ago",
      "RdInstalled RustDesk1.3.2last week",
      "SxUpdated ShareX17.0.02 weeks ago",
      "FlInstalled Flow Launcher1.20.03 weeks ago",
      "VLUpdated VLC media player3.0.20last month",
    ]);
    await user.click(screen.getByRole("button", { name: "See all" }));
    expect(router.state.location.pathname).toBe("/updates");
  });

  it("keeps five activity rows, newest first, and skips apps that are not visible", async () => {
    const services = createTestServices();
    const { activity: entries } = services.world.account;
    services.world.account.activity = [
      { kind: "installed", appId: "no-such-app", version: "1.0", date: "2026-09-15" },
      { kind: "updated", appId: "vscode", version: "1.93.0", date: "2026-09-15" },
      ...entries,
    ];
    await openProfile(services);
    const rows = activity();
    expect(rows).toHaveLength(5);
    expect(rows[0]).toBe("VSUpdated Visual Studio Code1.93.0today");
    expect(rows[4]).toBe("FlInstalled Flow Launcher1.20.03 weeks ago");
  });

  it("edits the profile: Save writes it, toasts and updates the header and rows", async () => {
    const user = userEvent.setup();
    const { services } = await openProfile();
    await user.click(within(header()).getByRole("button", { name: "Edit profile" }));

    const name = screen.getByLabelText("Name");
    const email = screen.getByLabelText("Email");
    expect(name).toHaveValue("Serj Kaje");
    expect(email).toHaveValue("serj.kaje@example.com");
    await user.clear(name);
    await user.type(name, "Anna Lee");
    await user.clear(email);
    await user.type(email, "anna@example.com");
    await user.click(screen.getByRole("button", { name: "Save" }));

    const card = within(await screen.findByRole("region", { name: "Anna Lee" }));
    expect(card.getByRole("heading", { name: "Anna Lee" })).toBeInTheDocument();
    expect(card.getByText("anna@example.com")).toBeInTheDocument();
    expect(card.getByText("AL")).toBeInTheDocument();
    expect(screen.queryByLabelText("Name")).toBeNull();
    expect(toast()).toBe("Profile saved");
    expect(services.world.account.profile).toMatchObject({
      name: "Anna Lee",
      email: "anna@example.com",
    });
    expect(within(panel()).getByRole("button", { name: /^Name/ })).toHaveTextContent("Anna Lee");
  });

  it("cancels an edit and restores the saved values", async () => {
    const user = userEvent.setup();
    const { services } = await openProfile();
    await user.click(within(header()).getByRole("button", { name: "Edit profile" }));
    await user.clear(screen.getByLabelText("Name"));
    await user.type(screen.getByLabelText("Name"), "Someone Else");
    await user.click(screen.getByRole("button", { name: "Cancel" }));

    expect(screen.queryByLabelText("Name")).toBeNull();
    expect(within(header()).getByRole("heading", { name: "Serj Kaje" })).toBeInTheDocument();
    expect(services.world.account.profile.name).toBe("Serj Kaje");
    expect(toast()).toBeUndefined();

    // Editing again starts from the saved profile, not the dropped draft.
    await user.click(within(header()).getByRole("button", { name: "Edit profile" }));
    expect(screen.getByLabelText("Name")).toHaveValue("Serj Kaje");
  });

  it("opens edit mode from any Account information row", async () => {
    const user = userEvent.setup();
    await openProfile();
    await user.click(within(panel()).getByRole("button", { name: /^Time zone/ }));
    expect(screen.getByLabelText("Name")).toHaveValue("Serj Kaje");
    expect(screen.getByLabelText("Email")).toHaveValue("serj.kaje@example.com");
    expect(screen.queryByRole("button", { name: "Edit profile" })).toBeNull();
    // A mouse click moves no focus (the prototype's behaviour).
    expect(screen.getByLabelText("Name")).not.toHaveFocus();
  });

  it("from the keyboard, focus follows the mode switch both ways", async () => {
    const user = userEvent.setup();
    const { services } = await openProfile();
    within(header()).getByRole("button", { name: "Edit profile" }).focus();
    await user.keyboard("{Enter}");
    const name = screen.getByLabelText("Name");
    expect(name).toHaveFocus();

    await user.clear(name);
    await user.type(name, "Anna Lee{Enter}");
    expect(await screen.findByRole("button", { name: "Edit profile" })).toHaveFocus();
    expect(services.world.account.profile.name).toBe("Anna Lee");

    // An Account information row opened with Space lands on the Name field too.
    within(panel())
      .getByRole("button", { name: /^Country/ })
      .focus();
    await user.keyboard(" ");
    expect(screen.getByLabelText("Name")).toHaveFocus();
    await user.tab();
    await user.tab();
    expect(screen.getByRole("button", { name: "Save" })).toHaveFocus();
    await user.tab();
    await user.keyboard("{Enter}");
    expect(screen.getByRole("button", { name: "Edit profile" })).toHaveFocus();
  });

  it("does not save a blank name: the field says why until it is edited", async () => {
    const user = userEvent.setup();
    const { services } = await openProfile();
    await user.click(within(header()).getByRole("button", { name: "Edit profile" }));
    const name = screen.getByLabelText("Name");
    await user.clear(name);
    await user.type(name, "   ");
    await user.click(screen.getByRole("button", { name: "Save" }));

    expect(name).toHaveAttribute("aria-invalid", "true");
    expect(name).toHaveAccessibleDescription("Enter your name");
    expect(screen.getByLabelText("Email")).not.toHaveAttribute("aria-invalid");
    expect(services.world.account.profile.name).toBe("Serj Kaje");
    expect(toast()).toBeUndefined();

    await user.type(name, "Serj");
    expect(name).not.toHaveAttribute("aria-invalid");
    await user.click(screen.getByRole("button", { name: "Save" }));
    expect(await screen.findByRole("heading", { name: "Serj" })).toBeInTheDocument();
    expect(services.world.account.profile.name).toBe("Serj");
  });

  it("Preferences: theme and language apply at once", async () => {
    const user = userEvent.setup();
    await openProfile();
    await user.click(tab("Preferences"));
    expect(tab("Preferences")).toHaveAttribute("aria-selected", "true");
    const prefs = within(panel());
    expect(prefs.getByText("Light, dark or follow Windows.")).toBeInTheDocument();
    expect(prefs.getByText("Applies to the whole app instantly.")).toBeInTheDocument();

    await user.click(prefs.getByRole("radio", { name: "Light" }));
    expect(useSettingsStore.getState().settings.theme).toBe("light");
    expect(prefs.getByRole("radio", { name: "Light" })).toBeChecked();

    // Every option keeps its code, the selected one included (no check mark here).
    const english = prefs.getByRole("radio", { name: /English/ });
    expect(english).toBeChecked();
    expect(english).toHaveTextContent("EnglishEN");

    await user.click(prefs.getByRole("radio", { name: /Русский/ }));
    expect(useSettingsStore.getState().settings.locale).toBe("ru");
    expect(await screen.findByRole("heading", { level: 1, name: "Профиль" })).toBeInTheDocument();
    expect(screen.getByRole("tab", { name: "Настройки" })).toHaveAttribute("aria-selected", "true");
    expect(screen.getByText("С нами с сентябрь 2024 г.")).toBeInTheDocument();
  });

  it("Security: the two-factor switch writes the account; the other buttons do nothing", async () => {
    const user = userEvent.setup();
    const { services } = await openProfile();
    await user.click(tab("Security"));
    const security = within(panel());
    expect(security.getByText("Last changed 4 months ago.")).toBeInTheDocument();
    expect(security.getByText("2 devices signed in.")).toBeInTheDocument();

    const twoFactor = security.getByRole("switch", { name: "Two-factor authentication" });
    expect(twoFactor).toBeChecked();
    await user.click(twoFactor);
    expect(twoFactor).not.toBeChecked();
    await act(async () => {});
    expect(services.world.account.twoFactor).toBe(false);
    await user.click(twoFactor);
    await act(async () => {});
    expect(twoFactor).toBeChecked();
    expect(services.world.account.twoFactor).toBe(true);

    await user.click(security.getByRole("button", { name: "Change…" }));
    await user.click(security.getByRole("button", { name: "Sign out everywhere" }));
    expect(services.world.account.signedIn).toBe(true);
    expect(toast()).toBeUndefined();
  });

  it("Devices: this device has the pill and no Remove; Remove drops the other", async () => {
    const user = userEvent.setup();
    const { services } = await openProfile();
    await user.click(tab("Devices"));
    const list = () => screen.getByRole("list", { name: "Devices" });
    const rows = () => within(list()).getAllByRole("listitem");
    expect(rows()).toHaveLength(2);

    const [current, other] = rows() as [HTMLElement, HTMLElement];
    expect(within(current).getByText("DESKTOP-7F3K2")).toBeInTheDocument();
    expect(within(current).getByText("This device")).toBeInTheDocument();
    expect(within(current).getByText("Windows 11 Pro 24H2 · Last active today")).toBeVisible();
    expect(within(current).queryByRole("button")).toBeNull();
    expect(within(other).queryByText("This device")).toBeNull();
    expect(within(other).getByText("Windows 11 Home 24H2 · Last active 4 days ago")).toBeVisible();

    await user.click(within(other).getByRole("button", { name: "Remove Surface Laptop 7" }));
    expect(await within(list()).findAllByRole("listitem")).toHaveLength(1);
    expect(screen.queryByText("Surface Laptop 7")).toBeNull();
    expect(services.world.account.devices.map((d) => d.id)).toEqual(["dev-1"]);

    // The sessions hint counts the devices that are still signed in.
    await user.click(tab("Security"));
    expect(within(panel()).getByText("1 device signed in.")).toBeInTheDocument();
  });

  it("Data & Privacy: Export… and the destructive Delete… do nothing", async () => {
    const user = userEvent.setup();
    const { services } = await openProfile();
    await user.click(tab("Data & Privacy"));
    const data = within(panel());
    expect(data.getByText("Library, collections and settings as a ZIP archive.")).toBeVisible();
    expect(
      data.getByText("Removes your account and cloud data. Installed apps stay on this PC."),
    ).toBeVisible();
    const remove = data.getByRole("button", { name: "Delete…" });
    expect(remove).toHaveAttribute("data-variant", "destructive");

    await user.click(data.getByRole("button", { name: "Export…" }));
    await user.click(remove);
    expect(services.world.account.signedIn).toBe(true);
    expect(screen.getByRole("heading", { name: "Serj Kaje" })).toBeInTheDocument();
    expect(toast()).toBeUndefined();
  });

  it("switches tabs with the arrow keys", async () => {
    const user = userEvent.setup();
    await openProfile();
    tab("Account").focus();
    await user.keyboard("{ArrowRight}{ArrowRight}");
    expect(tab("Security")).toHaveFocus();
    expect(tab("Security")).toHaveAttribute("aria-selected", "true");
    expect(useProfileStore.getState().tab).toBe("security");
  });

  it("Pro card: a purchased plan shows its price, renewal and Manage", async () => {
    const user = userEvent.setup();
    const services = createTestServices();
    services.world.account.subscription = {
      plan: "monthly",
      renewsOn: "2026-10-15",
      giftUntil: null,
    };
    const { router, queryClient } = await openProfile(services);
    expect(screen.getByText("Paparats Pro Monthly")).toBeInTheDocument();
    expect(screen.getByText("Active")).toBeInTheDocument();
    expect(screen.getByText("$4.99 / month")).toBeInTheDocument();
    expect(screen.getByText("Renews on 15 October 2026")).toBeInTheDocument();
    expect(screen.queryByText("Free plan")).toBeNull();

    // Switching to yearly lands on the card as soon as the account changes.
    await act(async () => {
      queryClient.setQueryData(queryKeys.account, await services.account.purchase("yearly"));
    });
    // TanStack Query notifies its observers on the next tick.
    expect(await screen.findByText("Paparats Pro Yearly")).toBeInTheDocument();
    expect(screen.getByText("$49 / year")).toBeInTheDocument();
    expect(screen.getByText("Renews on 15 September 2027")).toBeInTheDocument();

    await user.click(screen.getByRole("button", { name: "Manage" }));
    expect(router.state.location.pathname).toBe("/subscription");
  });

  it("Pro card: the idea gift on the free plan", async () => {
    const services = createTestServices();
    services.world.account.subscription.giftUntil = services.world.meta.ideaBonusUntil;
    await openProfile(services);
    // Name and price line both read "Paparats Pro · gift" (the prototype's `proStatus`).
    expect(screen.getAllByText("Paparats Pro · gift")).toHaveLength(2);
    expect(screen.getByText("Active")).toBeInTheDocument();
    expect(screen.getByText("Idea bonus · active until 15 December 2026")).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Manage" })).toBeInTheDocument();
  });

  it("Pro card: Upgrade opens Subscription", async () => {
    const user = userEvent.setup();
    const { router } = await openProfile();
    await user.click(screen.getByRole("button", { name: "Upgrade" }));
    expect(router.state.location.pathname).toBe("/subscription");
  });
});

describe("ProfileScreen in the shell", () => {
  it("keeps the tab across navigation; a saved name reaches the toast and the avatar", async () => {
    const user = userEvent.setup();
    await renderApp({ route: "/profile" });
    await act(async () => {
      await useSettingsStore.getState().update({ animations: false });
    });
    await user.click(await screen.findByRole("tab", { name: "Devices" }));

    const sidebar = within(screen.getByRole("navigation", { name: "Main" }));
    await user.click(sidebar.getByRole("button", { name: /^Home/ }));
    await screen.findByRole("heading", { name: "Featured apps" });
    await user.click(screen.getByRole("button", { name: "Profile" }));
    expect(await screen.findByRole("tab", { name: "Devices" })).toHaveAttribute(
      "aria-selected",
      "true",
    );

    await user.click(screen.getByRole("button", { name: "Edit profile" }));
    await user.clear(screen.getByLabelText("Name"));
    await user.type(screen.getByLabelText("Name"), "Anna Lee{Enter}");
    expect(await screen.findByRole("status")).toHaveTextContent("Profile saved");
    expect(screen.getByRole("button", { name: "Profile" })).toHaveTextContent("AL");
  });
});
