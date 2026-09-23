import { act, screen, waitFor, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { vi } from "vitest";
import type { SettingsRowSectionId } from "@/domain/settings";
import type { MockServices } from "@/services";
import { useFirstLaunchStore } from "@/stores/useFirstLaunchStore";
import { useSettingsStore } from "@/stores/useSettingsStore";
import { useUiStore } from "@/stores/useUiStore";
import { createTestServices, renderWithProviders } from "@/test/render";
import { SettingsScreen, settingsSectionOf } from "./SettingsScreen";

/** Every section's H2 and the titles of its rows (developer mode off). */
const SECTIONS: Record<SettingsRowSectionId, { label: string; rows: string[] }> = {
  general: {
    label: "General",
    rows: [
      "Theme",
      "Language",
      "Start on Windows login",
      "Minimize to system tray",
      "App recommendations",
      "Subtle animations",
    ],
  },
  updates: {
    label: "Updates",
    rows: [
      "Automatic updates",
      "Check for updates",
      "Download on metered networks",
      "Notify when updates are ready",
    ],
  },
  downloads: {
    label: "Downloads",
    rows: ["Install location", "Parallel downloads", "Keep installers after install"],
  },
  apps: {
    label: "Apps",
    rows: ["Install for current user only", "Create desktop shortcuts", "Open apps after install"],
  },
  notifications: {
    label: "Notifications",
    rows: ["Updates installed", "New apps in the catalog", "Play a sound"],
  },
  privacy: { label: "Privacy", rows: ["Telemetry", "Send crash reports", "Search history"] },
  account: {
    label: "Account",
    rows: ["Profile", "Subscription", "Signed in as serj.kaje@example.com"],
  },
  advanced: {
    label: "Advanced",
    rows: ["Developer mode", "Network proxy", "Prefer portable builds"],
  },
};

const DEV_ROWS = [
  "View Ideas as a channel developer",
  "Simulate offline",
  "Replay first launch",
  "Component gallery",
];

const sectionNav = () => screen.getByRole("navigation", { name: "Settings sections" });
const navItem = (label: string) => within(sectionNav()).getByRole("button", { name: label });
/** The titles of the open section's rows (its card is the last child of the section). */
const rowTitles = (label: string) => {
  const card = screen.getByRole("region", { name: label }).lastElementChild;
  return [...(card?.children ?? [])].map(
    (row) => row.querySelector("[id]")?.textContent ?? row.textContent,
  );
};
const toast = () => useUiStore.getState().toast?.message;

async function openSettings(route = "/settings", services?: MockServices) {
  const rendered = await renderWithProviders(<SettingsScreen />, { route, services });
  await screen.findByRole("heading", { level: 1, name: "Settings" });
  return rendered;
}

describe("SettingsScreen", () => {
  it("renders the title, the ten sections and General by default", async () => {
    await openSettings();
    expect(screen.getByText("Customize your experience.")).toBeInTheDocument();
    expect(
      within(sectionNav())
        .getAllByRole("button")
        .map((b) => b.textContent),
    ).toEqual([
      "General",
      "Updates",
      "Downloads",
      "Apps",
      "Sources",
      "Notifications",
      "Privacy",
      "Account",
      "Advanced",
      "About",
    ]);
    expect(navItem("General")).toHaveAttribute("aria-current", "page");
    expect(screen.getByRole("heading", { level: 2, name: "General" })).toBeInTheDocument();
    expect(rowTitles("General")).toEqual(SECTIONS.general.rows);
  });

  it("every row-card section renders its rows", async () => {
    const user = userEvent.setup();
    const { router } = await openSettings("/settings/about");
    for (const [id, { label, rows }] of Object.entries(SECTIONS)) {
      await user.click(navItem(label));
      expect(router.state.location.pathname).toBe(`/settings/${id}`);
      expect(navItem(label)).toHaveAttribute("aria-current", "page");
      expect(screen.getByRole("heading", { level: 2, name: label })).toBeInTheDocument();
      await waitFor(() => expect(rowTitles(label)).toEqual(rows));
    }
    // Picking a section swaps the panel without a navigation (no skeleton, no scroll reset).
    expect(useUiStore.getState().navCount).toBe(0);
  });

  it("opens the section named by the route; an unknown one falls back to General", async () => {
    expect(settingsSectionOf("/settings/privacy")).toBe("privacy");
    expect(settingsSectionOf("/settings")).toBe("general");
    expect(settingsSectionOf("/settings/nope")).toBe("general");
    await openSettings("/settings/notifications");
    expect(rowTitles("Notifications")).toEqual(SECTIONS.notifications.rows);
  });

  it("theme and language apply instantly", async () => {
    const user = userEvent.setup();
    await openSettings();
    const theme = screen.getByRole("radiogroup", { name: "Theme" });
    await user.click(within(theme).getByRole("radio", { name: "Light" }));
    expect(document.documentElement.dataset.theme).toBe("light");
    expect(useSettingsStore.getState().settings.theme).toBe("light");
    await user.click(within(theme).getByRole("radio", { name: "Dark" }));
    expect(document.documentElement.dataset.theme).toBe("dark");

    await user.click(screen.getByRole("radio", { name: "Русский" }));
    expect(useSettingsStore.getState().settings.locale).toBe("ru");
    expect(document.documentElement.lang).toBe("ru");
    expect(await screen.findByRole("heading", { level: 1, name: "Настройки" })).toBeInTheDocument();
    expect(screen.getByRole("heading", { level: 2, name: "Общие" })).toBeInTheDocument();
    expect(screen.getByText("Запускать при входе в Windows")).toBeInTheDocument();
    await user.click(screen.getByRole("radio", { name: "Беларуская" }));
    expect(await screen.findByRole("heading", { level: 1, name: "Налады" })).toBeInTheDocument();
    expect(document.documentElement.lang).toBe("be");
  });

  it("toggles are bound to the settings; startup is registered, animations set data-motion", async () => {
    const user = userEvent.setup();
    const services = createTestServices();
    const autostart = vi.spyOn(services.system, "setAutostart");
    await openSettings("/settings", services);

    const startup = screen.getByRole("switch", { name: "Start on Windows login" });
    expect(startup).toBeChecked();
    await user.click(startup);
    expect(startup).not.toBeChecked();
    expect(useSettingsStore.getState().settings.startup).toBe(false);
    expect(autostart).toHaveBeenCalledWith(false);

    await user.click(screen.getByRole("switch", { name: "Subtle animations" }));
    expect(useSettingsStore.getState().settings.animations).toBe(false);
    expect(document.documentElement.dataset.motion).toBe("off");

    await user.click(navItem("Notifications"));
    const sound = screen.getByRole("switch", { name: "Play a sound" });
    await user.click(sound);
    expect(sound).toBeChecked();
    // Persisted through SettingsService.
    await waitFor(async () => expect((await services.settings.getSettings()).nSound).toBe(true));
  });

  it("undoes Start on Windows login when the system refuses it", async () => {
    const user = userEvent.setup();
    const services = createTestServices();
    vi.spyOn(services.system, "setAutostart").mockRejectedValue(new Error("denied"));
    await openSettings("/settings", services);
    const startup = screen.getByRole("switch", { name: "Start on Windows login" });
    await user.click(startup);
    await waitFor(() => expect(startup).toBeChecked());
    expect(useSettingsStore.getState().settings.startup).toBe(true);
  });

  it("selects: check frequency, and parallel downloads reaching the live queue", async () => {
    const user = userEvent.setup();
    const services = createTestServices();
    const concurrency = vi.spyOn(services.downloads, "setConcurrency");
    await openSettings("/settings/updates", services);

    const schedule = screen.getByRole("combobox", { name: "Check for updates" });
    expect(schedule).toHaveValue("hourly");
    expect(
      within(schedule)
        .getAllByRole("option")
        .map((o) => o.textContent),
    ).toEqual(["Every hour", "Daily", "Weekly"]);
    await user.selectOptions(schedule, "weekly");
    expect(useSettingsStore.getState().settings.schedule).toBe("weekly");

    await user.click(navItem("Downloads"));
    await act(() =>
      services.downloads.enqueue(
        ["joplin", "ditto", "krita"].map((appId) => ({
          appId,
          version: "1.0.0",
          sizeMb: 500,
          kind: "install" as const,
        })),
      ),
    );
    const states = async () => (await services.downloads.getSnapshot()).items.map((i) => i.state);
    expect(await states()).toEqual(["downloading", "downloading", "queued"]);

    const parallel = screen.getByRole("combobox", { name: "Parallel downloads" });
    expect(parallel).toHaveValue("2");
    await user.selectOptions(parallel, "4");
    expect(useSettingsStore.getState().settings.parallel).toBe(4);
    await waitFor(() => expect(concurrency).toHaveBeenLastCalledWith(4));
    expect((await services.downloads.getSnapshot()).concurrency).toBe(4);
    expect(await states()).toEqual(["downloading", "downloading", "downloading"]);
    await act(() => services.downloads.cancelAll());
  });

  it("the install location shows the path; Change… does nothing (as in the prototype)", async () => {
    const user = userEvent.setup();
    await openSettings("/settings/downloads");
    expect(screen.getByText("C:\\Program Files\\Paparats")).toBeInTheDocument();
    const before = useSettingsStore.getState().settings;
    await user.click(screen.getByRole("button", { name: "Change…" }));
    expect(useSettingsStore.getState().settings).toEqual(before);
    expect(toast()).toBeUndefined();
  });

  it("privacy: the telemetry note, and Clear empties the search history with a toast", async () => {
    const user = userEvent.setup();
    const services = createTestServices();
    const clear = vi.spyOn(services.settings, "clearSearchHistory");
    await openSettings("/settings/privacy", services);
    expect(
      screen.getByText("Paparats sends nothing home. There is no telemetry to turn off."),
    ).toBeInTheDocument();
    await user.click(screen.getByRole("button", { name: "Clear" }));
    expect(clear).toHaveBeenCalledTimes(1);
    await waitFor(() => expect(toast()).toBe("Search history cleared"));
  });

  it("account: the links open Profile and Subscription; Sign out signs out with a toast", async () => {
    const user = userEvent.setup();
    const { router } = await openSettings("/settings/account");
    await user.click(screen.getByRole("button", { name: /^Profile/ }));
    expect(router.state.location.pathname).toBe("/profile");

    await act(() => router.navigate("/settings/account"));
    await user.click(screen.getByRole("button", { name: /^Subscription/ }));
    expect(router.state.location.pathname).toBe("/subscription");

    await act(() => router.navigate("/settings/account"));
    expect(await screen.findByText("Signed in as serj.kaje@example.com")).toBeInTheDocument();
    await user.click(screen.getByRole("button", { name: "Sign out" }));
    await waitFor(() => expect(toast()).toBe("Signed out"));
    expect(await screen.findByText("Not signed in")).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Sign out" })).toBeDisabled();
  });

  it("developer tools show only in developer mode and work", async () => {
    const user = userEvent.setup();
    const { router } = await openSettings("/settings/advanced");
    expect(rowTitles("Advanced")).toEqual(SECTIONS.advanced.rows);
    // Network proxy's "Configure…" does nothing, as in the prototype.
    await user.click(screen.getByRole("button", { name: "Configure…" }));
    expect(toast()).toBeUndefined();

    await user.click(screen.getByRole("switch", { name: "Developer mode" }));
    expect(rowTitles("Advanced")).toEqual([...SECTIONS.advanced.rows, ...DEV_ROWS]);

    await user.click(screen.getByRole("switch", { name: "View Ideas as a channel developer" }));
    expect(useSettingsStore.getState().settings.viewAsDeveloper).toBe(true);
    await user.click(screen.getByRole("switch", { name: "Simulate offline" }));
    expect(useSettingsStore.getState().settings.simulateOffline).toBe(true);
    await user.click(screen.getByRole("button", { name: "Replay" }));
    expect(useFirstLaunchStore.getState().replayRequested).toBe(1);

    await user.click(screen.getByRole("switch", { name: "Developer mode" }));
    expect(rowTitles("Advanced")).toEqual(SECTIONS.advanced.rows);

    await user.click(screen.getByRole("switch", { name: "Developer mode" }));
    await user.click(screen.getByRole("button", { name: /^Component gallery/ }));
    expect(router.state.location.pathname).toBe("/dev");
  });

  it("the Sources section renders its panel", async () => {
    const user = userEvent.setup();
    await openSettings();
    await user.click(navItem("Sources"));
    expect(screen.getByTestId("sources-panel")).toBeInTheDocument();
    expect(screen.getByRole("heading", { level: 2, name: "Sources" })).toBeInTheDocument();
    // The followed channels, not the row card: no settings rows, one switch per pausable channel.
    expect(await screen.findByRole("switch", { name: "Nilesoft" })).toBeChecked();
    expect(screen.getAllByRole("switch")).toHaveLength(2);
  });

  it("the About section renders its own panel", async () => {
    const user = userEvent.setup();
    await openSettings();
    await user.click(navItem("About"));
    expect(screen.getByRole("region", { name: "About" })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Check for updates" })).toBeInTheDocument();
    expect(screen.queryByRole("heading", { level: 2, name: "About" })).toBeNull();
  });
});
