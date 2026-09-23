// M3 "Library, Updates, download engine" end to end through the whole shell (renderApp): Update
// all landing everywhere, one download seen from the Library and from Updates, uninstall reaching
// Updates and the badge, the Library's views across navigation, and offline. No console errors.
import { act, fireEvent, screen, waitFor, within } from "@testing-library/react";
import { vi } from "vitest";
import { useDownloadsStore } from "@/stores/useDownloadsStore";
import { useSettingsStore } from "@/stores/useSettingsStore";
import { useUiStore } from "@/stores/useUiStore";
import { flush, renderApp } from "@/test/render";

/** The mock download tick; the test services add 10 % per tick. */
const TICK = 110;
/** Ticks from start to installed: 10 to reach 100 %, then the 8-tick "Installing…" hold. */
const INSTALL_TICKS = 18;
const UPDATES = [
  "Obsidian",
  "ShareX",
  "VLC media player",
  "Notepad++",
  "Visual Studio Code",
  "Nilesoft Shell",
];

const sidebar = () => screen.getByRole("navigation", { name: "Main" });
const navItem = (name: string) =>
  within(sidebar()).getByRole("button", { name: new RegExp(`^${name}`) });
const badge = () => within(sidebar()).queryByRole("img", { name: /updates? available/ });
const toast = () => useUiStore.getState().toast?.message;
const h1 = () => screen.getByRole("heading", { level: 1 }).textContent;

/** Lets React and the services settle, with or without fake timers. */
const settle = () => (vi.isFakeTimers() ? flush() : act(async () => {}));

/** Navigates through the sidebar (the navigation skeleton is off). */
async function go(name: string) {
  fireEvent.click(navItem(name));
  await settle();
  expect(h1()).toBe(name);
}

/** The offline banner (a status region with Retry; the toast is another status). */
const offlineBanner = () =>
  screen
    .queryAllByRole("status")
    .find((el) => within(el).queryByRole("button", { name: "Retry" }) !== null);

// ---- Updates -------------------------------------------------------------------------------
const updatesList = () => screen.getByRole("list", { name: "Updates" });
const updateItems = () => [...updatesList().children] as HTMLElement[];
const updateName = (li: HTMLElement) =>
  UPDATES.find((name) => within(li).queryByText(name, { selector: "span" }) !== null);
const updateNames = () => updateItems().map(updateName);
function updateRow(name: string) {
  const li = updateItems().find((item) => updateName(item) === name);
  if (!li) throw new Error(`no Updates row for ${name}`);
  return within(li);
}
const updateLabels = () =>
  updateItems().map((li) => li.querySelector("button[data-tone]")?.textContent);

// ---- Library -------------------------------------------------------------------------------
function libraryRow(name: string) {
  const el = screen
    .getAllByText(name, { selector: "[data-library-row] span" })[0]
    ?.closest<HTMLElement>("[data-library-row]");
  if (!el) throw new Error(`no Library row for ${name}`);
  return within(el);
}
const libraryNames = () =>
  [...document.querySelectorAll("[data-library-row] button + button span span")].map(
    (el) => el.textContent,
  );
const tab = (name: RegExp) => screen.getByRole("tab", { name });
const quickFilter = (name: RegExp) =>
  within(screen.getByRole("region", { name: "Quick filters" })).getByRole("button", { name });

async function start(route: string) {
  const rendered = await renderApp({ route });
  await act(async () => {
    await useSettingsStore.getState().update({ animations: false });
  });
  await screen.findByRole("heading", { level: 1 });
  return rendered;
}

const setSettings = (
  patch: Parameters<ReturnType<typeof useSettingsStore.getState>["update"]>[0],
) =>
  act(async () => {
    await useSettingsStore.getState().update(patch);
  });

const errors = vi.spyOn(console, "error");
const warnings = vi.spyOn(console, "warn");

beforeEach(() => {
  errors.mockClear();
  warnings.mockClear();
});

afterEach(() => {
  vi.clearAllTimers();
  vi.useRealTimers();
  expect(errors).not.toHaveBeenCalled();
  expect(warnings).not.toHaveBeenCalled();
});

describe("Library and Updates (M3) end to end", () => {
  it("lands Update all everywhere: rows, badge, toast, the Library, and the markers on leaving", async () => {
    await start("/updates");
    expect(badge()).toHaveTextContent("6");
    // VS Code and Obsidian start with their release notes open; ShareX expands on demand.
    expect(updateRow("Visual Studio Code").getByText("What’s new")).toBeInTheDocument();
    fireEvent.click(updateRow("ShareX").getByRole("button", { name: "View details" }));
    expect(updateRow("ShareX").getByText("New annotation tools")).toBeInTheDocument();

    vi.useFakeTimers();
    fireEvent.click(screen.getByRole("button", { name: "Update all" }));
    await flush(TICK);
    expect(screen.getByText("Updating 0 of 6")).toBeInTheDocument();
    expect(updateLabels()).toEqual(["10% · Pause", "10% · Pause", ...Array(4).fill("Queued")]);
    expect(updateRow("Obsidian").getByText("Downloading… 10% · 1 MB of 12 MB")).toBeVisible();

    // Two at a time (Parallel downloads = 2): three waves.
    await flush(3 * INSTALL_TICKS * TICK + TICK);
    expect(updateLabels()).toEqual(Array(6).fill("Updated just now"));
    expect(updateRow("Visual Studio Code").getByText("1.93.0")).toBeInTheDocument();
    expect(toast()).toBe("All updates installed");
    expect(badge()).toBeNull();
    expect(screen.queryByRole("button", { name: "Update all" })).toBeNull();
    expect(screen.queryByText(/^Updating/)).toBeNull();
    vi.useRealTimers();

    // Leaving Updates clears "Updated just now"; the Library shows the new versions.
    await go("Library");
    expect(useDownloadsStore.getState().justUpdated).toEqual({});
    const vscode = libraryRow("Visual Studio Code");
    expect(vscode.getByText("1.93.0")).toBeInTheDocument();
    expect(vscode.getByText("Updated today")).toBeInTheDocument();
    expect(vscode.getByRole("button", { name: "Open" })).toBeInTheDocument();
    expect(quickFilter(/^Updates available/)).toHaveTextContent("Updates available0");
    fireEvent.click(quickFilter(/^Updates available/));
    expect(screen.getByText("Everything is up to date")).toBeInTheDocument();

    await go("Updates");
    expect(screen.queryByRole("list", { name: "Updates" })).toBeNull();
    // The count line and the empty state.
    expect(screen.getAllByText("Everything is up to date")).toHaveLength(2);
  });

  it("shows one download from the Library and from Updates: pause there, resume here", async () => {
    await start("/library");
    vi.useFakeTimers();
    fireEvent.click(libraryRow("Visual Studio Code").getByRole("button", { name: "Update" }));
    await flush(4 * TICK);
    const vscode = () => libraryRow("Visual Studio Code");
    expect(vscode().getByText("Downloading… 40%")).toBeInTheDocument();
    // 40 % of the 87 MB update manifest.
    expect(vscode().getByText("35 MB of 87 MB")).toBeInTheDocument();
    expect(vscode().getByRole("button", { name: "40% · Pause" })).toBeInTheDocument();
    expect(vscode().getByRole("progressbar", { name: "Visual Studio Code" })).toHaveAttribute(
      "aria-valuenow",
      "40",
    );
    expect(quickFilter(/^Downloads/)).toHaveTextContent("Downloads1");
    fireEvent.click(quickFilter(/^Downloads/));
    expect(libraryNames()).toEqual(["Visual Studio Code"]);

    await go("Updates");
    expect(
      updateRow("Visual Studio Code").getByText("Downloading… 40% · 35 MB of 87 MB"),
    ).toBeInTheDocument();
    fireEvent.click(updateRow("Visual Studio Code").getByRole("button", { name: "40% · Pause" }));
    await flush(3 * TICK);
    expect(updateRow("Visual Studio Code").getByText("Paused · 40%")).toBeInTheDocument();

    // Back in the Library the Downloads filter is still on; the paused row keeps its size line.
    await go("Library");
    expect(tab(/^Installed/)).toHaveAttribute("aria-selected", "true");
    expect(libraryNames()).toEqual(["Visual Studio Code"]);
    expect(vscode().getByText("Paused · 40%")).toBeInTheDocument();
    expect(vscode().getByText("35 MB of 87 MB")).toBeInTheDocument();
    fireEvent.click(vscode().getByRole("button", { name: "Resume" }));
    await flush(6 * TICK);
    expect(vscode().getAllByText("Installing…")).toHaveLength(2);
    await flush(8 * TICK + TICK / 2);
    expect(screen.getByText("No active downloads")).toBeInTheDocument();
    expect(badge()).toHaveTextContent("5");
    vi.useRealTimers();

    fireEvent.click(quickFilter(/^All/));
    expect(vscode().getByText("1.93.0")).toBeInTheDocument();
    expect(vscode().getByText("Updated today")).toBeInTheDocument();

    // It landed while the Library was open: Updates still shows it as "Updated just now".
    await go("Updates");
    expect(updateNames()).toEqual(UPDATES);
    expect(
      updateRow("Visual Studio Code").getByRole("button", { name: "Updated just now" }),
    ).toBeDisabled();
    expect(screen.getByText("5 updates available")).toBeInTheDocument();
  });

  it("uninstalling in the Library takes the app out of Updates and the badge", async () => {
    await start("/library");
    fireEvent.click(screen.getByRole("button", { name: "More actions for Obsidian" }));
    fireEvent.click(await screen.findByRole("menuitem", { name: "Uninstall" }));
    await waitFor(() => expect(libraryNames()).not.toContain("Obsidian"));
    expect(toast()).toBe("Obsidian uninstalled");
    expect(tab(/^Installed/)).toHaveTextContent("Installed13");
    expect(tab(/^Favorites/)).toHaveTextContent("Favorites2");
    await waitFor(() => expect(badge()).toHaveTextContent("5"));

    await go("Updates");
    expect(updateNames()).toEqual(UPDATES.filter((name) => name !== "Obsidian"));
    expect(screen.getByText("5 updates available")).toBeInTheDocument();
  });

  it("keeps the Library's views across navigation: tabs, sort, grid, collections, app page", async () => {
    await start("/library");
    fireEvent.click(tab(/^Favorites/));
    expect(libraryNames()).toEqual(["Obsidian", "Everything", "VLC media player"]);

    fireEvent.click(tab(/^Collections/));
    const cards = screen.getByRole("list", { name: "Collections" });
    fireEvent.click(within(cards).getByRole("button", { name: /^Work/ }));
    const crumbs = screen.getByRole("navigation", { name: "Collections" });
    expect(crumbs).toHaveTextContent("All collections/Work");
    expect(libraryNames()).toEqual([
      "Visual Studio Code",
      "Obsidian",
      "Everything",
      "Notepad++",
      "PowerToys",
    ]);

    // The app page returns to the open collection.
    fireEvent.click(libraryRow("Notepad++").getByRole("button", { name: /^Notepad\+\+/ }));
    await settle();
    expect(h1()).toBe("Notepad++");
    fireEvent.click(screen.getByRole("button", { name: "Back" }));
    await settle();
    expect(h1()).toBe("Library");
    const crumbsAgain = screen.getByRole("navigation", { name: "Collections" });
    expect(crumbsAgain).toHaveTextContent("Work");
    fireEvent.click(within(crumbsAgain).getByRole("button", { name: "All collections" }));
    expect(screen.getByRole("list", { name: "Collections" })).toBeInTheDocument();

    // A quick filter goes back to Installed; sort and view stay through another section.
    fireEvent.click(quickFilter(/^All/));
    fireEvent.change(screen.getByRole("combobox", { name: "Sort by" }), {
      target: { value: "name" },
    });
    fireEvent.click(screen.getByRole("radio", { name: "Grid" }));
    await go("Categories");
    await go("Library");
    expect(screen.getByRole("combobox", { name: "Sort by" })).toHaveValue("name");
    expect(screen.getByRole("radio", { name: "Grid" })).toBeChecked();
    expect(document.querySelector("[data-library-row]")).toBeNull();

    // Open from a grid card: the prototype's "Opening …" toast.
    const grid = screen.getByRole("list", { name: "Installed" });
    const first = within(grid).getAllByRole("listitem")[0] as HTMLElement;
    expect(first).toHaveTextContent("7-Zip");
    fireEvent.click(within(first).getByRole("button", { name: "Open" }));
    expect(toast()).toBe("Opening 7-Zip…");
  });

  it("offline: banner with Retry, inert Get and Update, downloads freeze and resume", async () => {
    await start("/library");
    vi.useFakeTimers();
    fireEvent.click(libraryRow("ShareX").getByRole("button", { name: "Update" }));
    await flush(3 * TICK);
    expect(libraryRow("ShareX").getByText("Downloading… 30%")).toBeInTheDocument();

    await setSettings({ dev: true, simulateOffline: true });
    expect(offlineBanner()).toHaveTextContent("You’re offline");

    // Update is inert: it reads Offline and only says so.
    const vscode = () => libraryRow("Visual Studio Code");
    fireEvent.click(vscode().getByRole("button", { name: "Offline" }));
    expect(toast()).toBe("You’re offline");
    await flush(3 * TICK);
    expect(vscode().queryByRole("progressbar")).toBeNull();
    // The running download holds still.
    expect(libraryRow("ShareX").getByText("Downloading… 30%")).toBeInTheDocument();

    await go("Updates");
    expect(screen.getByText("Can’t check for updates while offline.")).toBeInTheDocument();
    expect(screen.queryByRole("button", { name: "Update all" })).toBeNull();
    expect(updateLabels()).toEqual([
      "Offline",
      "30% · Pause",
      "Offline",
      "Offline",
      "Offline",
      "Offline",
    ]);

    await go("Categories");
    expect(screen.queryAllByRole("button", { name: "Get" })).toHaveLength(0);
    expect(screen.getAllByRole("button", { name: "Offline" }).length).toBeGreaterThan(0);

    fireEvent.click(within(offlineBanner() as HTMLElement).getByRole("button", { name: "Retry" }));
    await flush();
    expect(useSettingsStore.getState().settings.simulateOffline).toBe(false);
    expect(toast()).toBe("Back online");
    expect(offlineBanner()).toBeUndefined();
    expect(screen.getAllByRole("button", { name: "Get" }).length).toBeGreaterThan(0);

    // The download picks up where it stopped and lands.
    await flush(7 * TICK + 8 * TICK + TICK / 2);
    await go("Updates");
    expect(updateRow("ShareX").getByRole("button", { name: "Updated just now" })).toBeDisabled();
    expect(badge()).toHaveTextContent("5");
  });
});
