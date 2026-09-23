import { StrictMode } from "react";
import { act, fireEvent, screen, waitFor, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { vi } from "vitest";
import type { MockServices } from "@/services";
import { useDownloadsStore } from "@/stores/useDownloadsStore";
import { useSettingsStore } from "@/stores/useSettingsStore";
import { useUiStore } from "@/stores/useUiStore";
import { createTestServices, flush, renderApp, renderWithProviders } from "@/test/render";
import { UpdatesScreen } from "./UpdatesScreen";

/** The mock download tick (the tests' services add 10 % per tick). */
const TICK = 110;
/** Ticks from start to installed: 10 to reach 100 %, then the 8-tick "Installing…" hold. */
const INSTALL_TICKS = 18;
const ORDER = [
  "Obsidian",
  "ShareX",
  "VLC media player",
  "Notepad++",
  "Visual Studio Code",
  "Nilesoft Shell",
];

const list = () => screen.getByRole("list", { name: "Updates" });
/** The rows (the list's own items; the release notes are lists of their own). */
const items = () => [...list().children] as HTMLElement[];
const nameOf = (li: HTMLElement) =>
  ORDER.find((name) => within(li).queryByText(name, { selector: "span" }) !== null);
/** The Updates row of `name`. */
function row(name: string): HTMLElement {
  const item = items().find((li) => nameOf(li) === name);
  if (!item) throw new Error(`no row for ${name}`);
  return item;
}
const rowNames = () => items().map(nameOf);
/** Each row's action label, in list order. */
const labels = () => items().map((li) => li.querySelector("button[data-tone]")?.textContent);
const sidebar = () => screen.getByRole("navigation", { name: "Main" });
const setSettings = (
  patch: Parameters<ReturnType<typeof useSettingsStore.getState>["update"]>[0],
) =>
  act(async () => {
    await useSettingsStore.getState().update(patch);
  });

async function openUpdates(services?: MockServices) {
  const rendered = await renderWithProviders(<UpdatesScreen />, { route: "/updates", services });
  await screen.findByRole("heading", { level: 1, name: "Updates" });
  return rendered;
}

/** The whole shell at /updates, without the navigation skeleton. */
async function openShell(services?: MockServices) {
  const rendered = await renderApp({ route: "/updates", services });
  await setSettings({ animations: false });
  await screen.findByRole("list", { name: "Updates" });
  return rendered;
}

/** Services whose library has every app at its catalog version (nothing to update). */
function upToDateServices(): MockServices {
  const services = createTestServices();
  const versions = new Map(services.world.catalog.apps.map((a) => [a.id, a.version]));
  services.world.library.installed = services.world.library.installed.map((i) => ({
    ...i,
    version: versions.get(i.appId) ?? i.version,
  }));
  return services;
}

function useFakeTimers() {
  vi.useFakeTimers();
  return () => {
    vi.clearAllTimers();
    vi.useRealTimers();
  };
}

describe("UpdatesScreen", () => {
  it("renders the banner, the pending updates and the side column", async () => {
    await openUpdates();
    expect(screen.getByText("Keep your apps up to date.")).toBeInTheDocument();
    expect(screen.getByText("6 updates available")).toBeInTheDocument();
    // 12 + 8 + 40 + 5 + 87 + 3 MB of update manifests.
    expect(screen.getByText("155 MB")).toBeInTheDocument();
    expect(screen.getByText("Same tools. New possibilities.")).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Update all" })).toBeInTheDocument();

    expect(rowNames()).toEqual(ORDER);
    const vscode = within(row("Visual Studio Code"));
    expect(vscode.getByText("1.92.2 → 1.93.0")).toBeInTheDocument();
    expect(vscode.getByText("87 MB")).toBeInTheDocument();
    expect(vscode.getByRole("button", { name: "Update" })).toBeEnabled();
    expect(within(row("Nilesoft Shell")).getByText("Nilesoft")).toBeInTheDocument();
    expect(labels()).toEqual(Array(6).fill("Update"));
    expect(screen.queryByRole("progressbar")).toBeNull();

    // VS Code and Obsidian start expanded with their manifest notes.
    expect(vscode.getByText("What’s new")).toBeInTheDocument();
    expect(vscode.getByText("Improved performance and stability")).toBeInTheDocument();
    expect(within(row("Obsidian")).getByText("New editor improvements")).toBeInTheDocument();
    expect(within(row("ShareX")).queryByText("What’s new")).toBeNull();

    expect(screen.getByRole("switch", { name: "Automatic updates" })).toBeChecked();
    expect(screen.getByRole("button", { name: /^Update settings/ })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: /^Update history/ })).toHaveAttribute(
      "aria-expanded",
      "false",
    );
    expect(screen.getByText("Better tools every day.")).toBeInTheDocument();
  });

  it("expands and collapses the release notes", async () => {
    const user = userEvent.setup();
    const { router } = await openUpdates();
    const sharex = within(row("ShareX"));
    const toggle = sharex.getByRole("button", { name: "View details" });
    expect(toggle).toHaveAttribute("aria-expanded", "false");

    await user.click(toggle);
    expect(toggle).toHaveAttribute("aria-expanded", "true");
    expect(toggle).toHaveAccessibleName("Hide details");
    expect(sharex.getByText("New annotation tools")).toBeInTheDocument();

    await user.click(toggle);
    expect(sharex.queryByText("New annotation tools")).toBeNull();

    // Collapsing a row that starts open.
    const vscode = within(row("Visual Studio Code"));
    await user.click(vscode.getByRole("button", { name: "Hide details" }));
    expect(vscode.queryByText("What’s new")).toBeNull();

    // "View details →" opens the app page.
    const obsidian = within(row("Obsidian"));
    const links = obsidian.getAllByRole("button", { name: "View details" });
    await user.click(links[links.length - 1] as HTMLElement);
    expect(router.state.location.pathname).toBe("/app/obsidian");
  });

  it("toggles automatic updates, opens Settings › Updates and the update history", async () => {
    const user = userEvent.setup();
    const { router } = await openUpdates();
    await user.click(screen.getByRole("switch", { name: "Automatic updates" }));
    expect(useSettingsStore.getState().settings.auto).toBe(false);
    expect(screen.getByRole("switch", { name: "Automatic updates" })).not.toBeChecked();

    const history = screen.getByRole("button", { name: /^Update history/ });
    await user.click(history);
    expect(history).toHaveAttribute("aria-expanded", "true");
    const entries = within(await screen.findByRole("list", { name: "Update history" }))
      .getAllByRole("listitem")
      .map((li) => li.textContent);
    expect(entries).toEqual([
      "ObObsidian 1.8.92 days ago",
      "SxShareX 17.0.02 weeks ago",
      "VLVLC media player 3.0.20last month",
    ]);
    await user.click(history);
    expect(screen.queryByRole("list", { name: "Update history" })).toBeNull();

    await user.click(screen.getByRole("button", { name: /^Update settings/ }));
    expect(router.state.location.pathname).toBe("/settings/updates");
  });

  it("updates one app: progress, Installing…, Updated just now, and the badge drops", async () => {
    await openShell();
    const sharex = () => within(row("ShareX"));
    expect(within(sidebar()).getByRole("img", { name: "6 updates available" })).toHaveTextContent(
      "6",
    );
    const restore = useFakeTimers();
    try {
      fireEvent.click(sharex().getByRole("button", { name: "Update" }));
      await flush(4 * TICK);
      expect(sharex().getByRole("button", { name: "40% · Pause" })).toBeInTheDocument();
      expect(sharex().getByText("Downloading… 40% · 3 MB of 8 MB")).toBeInTheDocument();
      expect(sharex().getByRole("progressbar", { name: "ShareX" })).toHaveAttribute(
        "aria-valuenow",
        "40",
      );
      // A lone update is not a batch: Update all stays for the rest.
      expect(screen.getByRole("button", { name: "Update all" })).toBeInTheDocument();

      fireEvent.click(sharex().getByRole("button", { name: "40% · Pause" }));
      await flush(3 * TICK);
      expect(sharex().getByText("Paused · 40%")).toBeInTheDocument();
      fireEvent.click(sharex().getByRole("button", { name: "Resume" }));

      await flush(6 * TICK);
      expect(sharex().getByRole("button", { name: "Installing…" })).toBeDisabled();
      expect(sharex().getAllByText("Installing…")).toHaveLength(2);

      await flush(8 * TICK);
      expect(sharex().getByRole("button", { name: "Updated just now" })).toBeDisabled();
      expect(sharex().getByText("17.1.0")).toBeInTheDocument();
      expect(sharex().queryByRole("progressbar")).toBeNull();
      expect(screen.getByText("5 updates available")).toBeInTheDocument();
      expect(screen.getByText("147 MB")).toBeInTheDocument();
      // The sidebar hears about the library through TanStack's batched notify.
      await flush(TICK / 2);
      expect(within(sidebar()).getByRole("img", { name: "5 updates available" })).toHaveTextContent(
        "5",
      );
      // A single update is confirmed by its row, not by the batch toast (D8).
      expect(useUiStore.getState().toast).toBeNull();
      expect(rowNames()).toEqual(ORDER);
    } finally {
      restore();
    }

    // The history now starts with the new version.
    fireEvent.click(screen.getByRole("button", { name: /^Update history/ }));
    const history = await screen.findByRole("list", { name: "Update history" });
    await waitFor(() =>
      expect(within(history).getAllByRole("listitem")[0]).toHaveTextContent("ShareX 17.1.0today"),
    );
    expect(within(history).getAllByRole("listitem")).toHaveLength(4);
  });

  it("runs Update all as a batch: Pause all, Resume all, Cancel all", async () => {
    await openShell();
    const restore = useFakeTimers();
    try {
      fireEvent.click(screen.getByRole("button", { name: "Update all" }));
      await flush(TICK);
      expect(screen.queryByRole("button", { name: "Update all" })).toBeNull();
      expect(screen.getByText("Updating 0 of 6")).toBeInTheDocument();
      expect(screen.getByRole("progressbar", { name: "Updating 0 of 6" })).toHaveAttribute(
        "aria-valuenow",
        "3",
      );
      // Two run at a time (Parallel downloads = 2); the rest wait.
      expect(labels()).toEqual([
        "10% · Pause",
        "10% · Pause",
        "Queued",
        "Queued",
        "Queued",
        "Queued",
      ]);
      // "Queued" is both the action and the status line.
      expect(within(row("Notepad++")).getAllByText("Queued")).toHaveLength(2);
      expect(screen.getAllByRole("progressbar")).toHaveLength(7);

      fireEvent.click(screen.getByRole("button", { name: "Pause all" }));
      await flush();
      expect(screen.getByRole("button", { name: "Resume all" })).toBeInTheDocument();
      expect(labels().slice(0, 2)).toEqual(["Resume", "Resume"]);
      expect(within(row("Obsidian")).getByText("Paused · 10%")).toBeInTheDocument();
      await flush(5 * TICK);
      expect(labels().slice(0, 2)).toEqual(["Resume", "Resume"]);

      fireEvent.click(screen.getByRole("button", { name: "Resume all" }));
      await flush(2 * TICK);
      expect(screen.getByRole("button", { name: "Pause all" })).toBeInTheDocument();
      expect(labels().slice(0, 2)).toEqual(["30% · Pause", "30% · Pause"]);
      expect(screen.getByText("10%")).toBeInTheDocument();

      fireEvent.click(screen.getByRole("button", { name: "Cancel all" }));
      await flush();
      expect(labels()).toEqual(Array(6).fill("Update"));
      expect(screen.queryByText(/^Updating/)).toBeNull();
      expect(screen.queryByRole("progressbar")).toBeNull();
      expect(screen.getByRole("button", { name: "Update all" })).toBeInTheDocument();
      expect(useDownloadsStore.getState().batch).toBeNull();
    } finally {
      restore();
    }
  });

  it("lands the whole batch: rows settle, the badge clears and the toast confirms", async () => {
    await openShell();
    const restore = useFakeTimers();
    try {
      fireEvent.click(screen.getByRole("button", { name: "Update all" }));
      await flush(INSTALL_TICKS * TICK + TICK / 2);
      expect(screen.getByText("Updating 2 of 6")).toBeInTheDocument();
      expect(labels().slice(0, 2)).toEqual(["Updated just now", "Updated just now"]);
      expect(within(sidebar()).getByRole("img", { name: "4 updates available" })).toBeVisible();
      expect(useUiStore.getState().toast).toBeNull();

      await flush(2 * INSTALL_TICKS * TICK);
      expect(labels()).toEqual(Array(6).fill("Updated just now"));
      expect(screen.getByRole("status")).toHaveTextContent("All updates installed");
      expect(screen.getByText("Everything is up to date")).toBeInTheDocument();
      expect(screen.queryByText(/^Updating/)).toBeNull();
      // Nothing left to update: no Update all, no badge.
      expect(screen.queryByRole("button", { name: "Update all" })).toBeNull();
      expect(within(sidebar()).queryByRole("img", { name: /updates? available/ })).toBeNull();
    } finally {
      restore();
    }
  });

  it("follows Parallel downloads, also while the batch runs", async () => {
    await openShell();
    await setSettings({ parallel: 1 });
    const restore = useFakeTimers();
    try {
      fireEvent.click(screen.getByRole("button", { name: "Update all" }));
      await flush(TICK);
      expect(labels()).toEqual(["10% · Pause", "Queued", "Queued", "Queued", "Queued", "Queued"]);

      await setSettings({ parallel: 4 });
      await flush(TICK);
      expect(labels()).toEqual([
        "20% · Pause",
        "10% · Pause",
        "10% · Pause",
        "10% · Pause",
        "Queued",
        "Queued",
      ]);
    } finally {
      restore();
    }
  });

  it("offline: says it can't check, blocks Update, and freezes then resumes running downloads", async () => {
    await openShell();
    const restore = useFakeTimers();
    try {
      fireEvent.click(within(row("ShareX")).getByRole("button", { name: "Update" }));
      await flush(3 * TICK);
      expect(labels()[1]).toBe("30% · Pause");

      await setSettings({ simulateOffline: true });
      expect(screen.getByText("Can’t check for updates while offline.")).toBeInTheDocument();
      expect(screen.queryByText("155 MB")).toBeNull();
      expect(screen.queryByRole("button", { name: "Update all" })).toBeNull();
      expect(labels()).toEqual([
        "Offline",
        "30% · Pause",
        "Offline",
        "Offline",
        "Offline",
        "Offline",
      ]);

      // The running download holds still.
      await flush(5 * TICK);
      expect(labels()[1]).toBe("30% · Pause");
      expect(within(row("ShareX")).getByText("Downloading… 30% · 2 MB of 8 MB")).toBeVisible();

      // "Offline" is inert: it explains instead of starting a download.
      fireEvent.click(within(row("VLC media player")).getByRole("button", { name: "Offline" }));
      await flush();
      expect(useUiStore.getState().toast?.message).toBe("You’re offline");
      expect(useDownloadsStore.getState().items.vlc).toBeUndefined();

      await setSettings({ simulateOffline: false });
      await flush(2 * TICK);
      expect(labels()[1]).toBe("50% · Pause");
      expect(screen.getByText("6 updates available")).toBeInTheDocument();
      expect(screen.getByRole("button", { name: "Update all" })).toBeInTheDocument();
    } finally {
      restore();
    }
  });

  it("clears “Updated just now” when leaving the screen", async () => {
    await openShell();
    const restore = useFakeTimers();
    try {
      fireEvent.click(within(row("ShareX")).getByRole("button", { name: "Update" }));
      await flush(INSTALL_TICKS * TICK + TICK / 2);
      expect(within(row("ShareX")).getByRole("button", { name: "Updated just now" })).toBeVisible();
    } finally {
      restore();
    }
    const user = userEvent.setup();
    await user.click(within(sidebar()).getByRole("button", { name: /^Home/ }));
    expect(useDownloadsStore.getState().justUpdated).toEqual({});
    await user.click(within(sidebar()).getByRole("button", { name: /^Updates/ }));
    await screen.findByRole("heading", { level: 1, name: "Updates" });
    expect(rowNames()).toEqual(ORDER.filter((name) => name !== "ShareX"));
  });

  it("clears the markers on unmount but keeps them through a StrictMode remount", async () => {
    const services = upToDateServices();
    act(() => useDownloadsStore.setState({ justUpdated: { sharex: true } }));
    const { unmount } = await renderWithProviders(
      <StrictMode>
        <UpdatesScreen />
      </StrictMode>,
      { route: "/updates", services },
    );
    expect(
      await within(await screen.findByRole("list", { name: "Updates" })).findByRole("button", {
        name: "Updated just now",
      }),
    ).toBeDisabled();
    await act(async () => {
      await Promise.resolve();
    });
    expect(useDownloadsStore.getState().justUpdated).toEqual({ sharex: true });

    unmount();
    await act(async () => {
      await Promise.resolve();
    });
    expect(useDownloadsStore.getState().justUpdated).toEqual({});
  });

  it("shows the empty state when everything is up to date", async () => {
    await openUpdates(upToDateServices());
    expect(screen.getAllByText("Everything is up to date")).toHaveLength(2);
    expect(
      screen.getByText("Paparats checks for updates every hour in the background."),
    ).toBeInTheDocument();
    expect(screen.queryByRole("list", { name: "Updates" })).toBeNull();
    expect(screen.queryByRole("button", { name: "Update all" })).toBeNull();
  });

  it("speaks Russian and Belarusian with the right plural forms", async () => {
    await openUpdates();
    await setSettings({ locale: "ru" });
    expect(screen.getByRole("heading", { level: 1, name: "Обновления" })).toBeInTheDocument();
    expect(screen.getByText("Доступно 6 обновлений")).toBeInTheDocument();
    expect(screen.getByText(/^155\sМБ$/)).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Обновить всё" })).toBeInTheDocument();
    expect(screen.getAllByRole("button", { name: "Обновить" })).toHaveLength(6);

    await setSettings({ locale: "be" });
    expect(screen.getByText("Даступна 6 абнаўленняў")).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Абнавіць усё" })).toBeInTheDocument();
    expect(screen.getByText("Лепшыя інструменты кожны дзень.")).toBeInTheDocument();
  });
});
