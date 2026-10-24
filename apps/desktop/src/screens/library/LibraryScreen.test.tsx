import { act, fireEvent, screen, waitFor, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { useBrowseStore } from "@/stores/useBrowseStore";
import { useDownloadsStore } from "@/stores/useDownloadsStore";
import { useLibraryStore } from "@/stores/useLibraryStore";
import { useUiStore } from "@/stores/useUiStore";
import { useSettingsStore } from "@/stores/useSettingsStore";
import { createTestServices, flush, renderApp, renderWithProviders } from "@/test/render";
import { LibraryScreen } from "./LibraryScreen";

const TICK = 110;
const toast = () => useUiStore.getState().toast?.message;

/** The installed apps of the mock data set, most recently used first (the default sort). */
const RECENT = [
  "Visual Studio Code",
  "Flow Launcher",
  "Obsidian",
  "Everything",
  "Notepad++",
  "Kvetka Shell",
  "ShareX",
  "LocalSend",
  "VLC media player",
  "PowerToys",
  "RustDesk",
  "Czkawka",
  "Krita",
  "7-Zip",
];

async function renderLibrary(services = createTestServices()) {
  const result = await renderWithProviders(<LibraryScreen />, { route: "/library", services });
  await screen.findByRole("heading", { level: 1, name: "Library" });
  return result;
}

/** The list rows' app names, in order. */
function rowNames(): string[] {
  const list = screen.queryByRole("list", { name: /Installed|Favorites|Collections/ });
  if (!list) return [];
  return within(list)
    .getAllByRole("listitem")
    .map((item) => item.querySelector("[data-library-row] > button span span")?.textContent)
    .filter((name): name is string => Boolean(name));
}

const row = (name: string) => {
  const el = screen
    .getAllByText(name, { selector: "[data-library-row] span" })[0]
    ?.closest<HTMLElement>("[data-library-row]");
  if (!el) throw new Error(`no row for ${name}`);
  return el;
};

const tab = (name: RegExp) => screen.getByRole("tab", { name });
const aside = () => screen.getByRole("complementary");
const quickFilter = (name: RegExp) =>
  within(within(aside()).getByRole("region", { name: "Quick filters" })).getByRole("button", {
    name,
  });

async function openMenu(appName: string) {
  fireEvent.click(screen.getByRole("button", { name: `More actions for ${appName}` }));
  return screen.findByRole("menu");
}

describe("LibraryScreen", () => {
  it("renders the banner, the toolbar with counts, every installed app, stats, filters and the quote", async () => {
    await renderLibrary();
    // The prototype's markup shows the tagline, not the count it computes (D33).
    expect(screen.getByText("Your apps, all in one place.")).toBeInTheDocument();
    expect(screen.getByText("Same tools. New possibilities.")).toBeInTheDocument();

    expect(tab(/^Installed/)).toHaveAttribute("aria-selected", "true");
    expect(tab(/^Installed/)).toHaveTextContent("Installed14");
    expect(tab(/^Favorites/)).toHaveTextContent("Favorites3");
    // "All apps" is every installed app, not a collection of its own.
    expect(tab(/^Collections/)).toHaveTextContent("Collections3");
    expect(screen.getByRole("combobox", { name: "Sort by" })).toHaveValue("recent");
    expect(screen.getByRole("radio", { name: "List" })).toBeChecked();

    expect(rowNames()).toEqual(RECENT);
    const code = row("Visual Studio Code");
    expect(code).toHaveTextContent("Code editing. Redefined.");
    expect(code).toHaveTextContent("DevelopmentPortable");
    expect(code).toHaveTextContent("1.92.2Update → 1.93.0");
    expect(within(code).getByRole("button", { name: "Update" })).toBeInTheDocument();
    const flow = row("Flow Launcher");
    expect(flow).toHaveTextContent("ProductivityPro");
    expect(flow).toHaveTextContent("1.20.0Updated today");
    expect(within(flow).getByRole("button", { name: "Open" })).toBeInTheDocument();
    // Source channel chip, license tag, favourite star.
    expect(row("Kvetka Shell")).toHaveTextContent("SystemPortableKvetka");
    expect(row("PowerToys")).toHaveTextContent("SystemMIT");
    expect(within(row("Obsidian")).getByRole("img", { name: "Favorites" })).toBeInTheDocument();
    expect(within(row("Flow Launcher")).queryByRole("img", { name: "Favorites" })).toBeNull();

    const side = within(aside());
    const stats = side.getByRole("region", { name: "Library stats" });
    expect(stats).toHaveTextContent("14Installed apps3Favorites4Collections0.8 GBTotal size");
    const collections = side.getByRole("region", { name: "Collections" });
    expect(collections).toHaveTextContent("All apps14Work5Creative3Utilities4New collection");
    const filters = side.getByRole("region", { name: "Quick filters" });
    expect(filters).toHaveTextContent("All14Updates available6Downloads0Favorites3");
    expect(quickFilter(/^All/)).toHaveAttribute("aria-pressed", "true");
    expect(
      side.getByText("“The best tools are the ones you forget you found.”"),
    ).toBeInTheDocument();
    expect(side.getByText("— Paparats")).toBeInTheDocument();
  });

  it("Install app opens Browse with every filter reset", async () => {
    useBrowseStore.setState({ pro: true, sort: "size" });
    const { router } = await renderLibrary();
    fireEvent.click(screen.getByRole("button", { name: "Install app" }));
    expect(router.state.location.pathname).toBe("/browse");
    expect(useBrowseStore.getState()).toMatchObject({ pro: false, sort: "featured" });
  });

  it("switches tabs: favorites, then the collection cards with their counts", async () => {
    const user = userEvent.setup();
    await renderLibrary();
    await user.click(tab(/^Favorites/));
    expect(tab(/^Favorites/)).toHaveAttribute("aria-selected", "true");
    expect(rowNames()).toEqual(["Obsidian", "Everything", "VLC media player"]);

    await user.click(tab(/^Collections/));
    const cards = screen.getByRole("list", { name: "Collections" });
    expect(
      within(cards)
        .getAllByRole("button")
        .map((card) => card.textContent),
    ).toEqual(["All apps14 apps", "Work5 apps", "Creative3 apps", "Utilities4 apps"]);
    expect(document.querySelector("[data-library-row]")).toBeNull();
  });

  it("sorts by recently used, A–Z and size", async () => {
    const user = userEvent.setup();
    await renderLibrary();
    const sort = screen.getByRole("combobox", { name: "Sort by" });
    await user.selectOptions(sort, "A–Z");
    expect(useLibraryStore.getState().sort).toBe("name");
    expect(rowNames()).toEqual([...RECENT].sort((a, b) => a.localeCompare(b, "en")));
    expect(rowNames()[0]).toBe("7-Zip");

    await user.selectOptions(sort, "Size");
    expect(rowNames().slice(0, 4)).toEqual([
      "PowerToys",
      "Krita",
      "Obsidian",
      "Visual Studio Code",
    ]);
    expect(rowNames().at(-1)).toBe("7-Zip");

    await user.selectOptions(sort, "Recently used");
    expect(rowNames()).toEqual(RECENT);
  });

  it("toggles between the list and the 4-column grid", async () => {
    const user = userEvent.setup();
    await renderLibrary();
    await user.click(screen.getByRole("radio", { name: "Grid" }));
    expect(useLibraryStore.getState().view).toBe("grid");
    expect(document.querySelector("[data-library-row]")).toBeNull();
    const grid = screen.getByRole("list", { name: "Installed" });
    const cards = within(grid).getAllByRole("listitem");
    expect(cards).toHaveLength(14);
    const obsidian = cards[2] as HTMLElement;
    expect(obsidian).toHaveTextContent("Obsidian1.8.9 · Updated yesterday");
    expect(within(obsidian).getByRole("button", { name: "Update" })).toBeInTheDocument();
    expect(within(obsidian).getByRole("button", { name: "Remove from favorites" })).toHaveAttribute(
      "aria-pressed",
      "true",
    );

    await user.click(screen.getByRole("radio", { name: "List" }));
    expect(rowNames()).toEqual(RECENT);
  });

  it("opens a collection, shows its breadcrumb and goes back to the cards", async () => {
    const user = userEvent.setup();
    await renderLibrary();
    await user.click(tab(/^Collections/));
    const cards = screen.getByRole("list", { name: "Collections" });
    await user.click(within(cards).getByRole("button", { name: /^Work/ }));

    const crumbs = screen.getByRole("navigation", { name: "Collections" });
    expect(crumbs).toHaveTextContent("All collections/Work");
    expect(rowNames()).toEqual([
      "Visual Studio Code",
      "Obsidian",
      "Everything",
      "Notepad++",
      "PowerToys",
    ]);
    // The sidebar marks the open collection.
    expect(within(aside()).getByRole("button", { name: /^Work/ })).toHaveAttribute(
      "aria-current",
      "true",
    );

    await user.click(within(crumbs).getByRole("button", { name: "All collections" }));
    expect(screen.queryByRole("navigation", { name: "Collections" })).toBeNull();
    expect(screen.getByRole("list", { name: "Collections" })).toBeInTheDocument();

    // The selected Collections tab also closes an open collection.
    await user.click(within(aside()).getByRole("button", { name: /^Utilities/ }));
    expect(rowNames()).toEqual(["Everything", "LocalSend", "RustDesk", "7-Zip"]);
    await user.click(tab(/^Collections/));
    expect(screen.getByRole("list", { name: "Collections" })).toBeInTheDocument();

    // A collection in the sidebar opens straight from any tab.
    await user.click(tab(/^Installed/));
    await user.click(within(aside()).getByRole("button", { name: /^Creative/ }));
    expect(tab(/^Collections/)).toHaveAttribute("aria-selected", "true");
    expect(rowNames()).toEqual(["ShareX", "VLC media player", "Krita"]);
  });

  it("quick filters switch to the Installed tab with their filter", async () => {
    const user = userEvent.setup();
    await renderLibrary();
    await user.click(tab(/^Collections/));

    await user.click(quickFilter(/^Updates available/));
    expect(tab(/^Installed/)).toHaveAttribute("aria-selected", "true");
    expect(quickFilter(/^Updates available/)).toHaveAttribute("aria-pressed", "true");
    expect(rowNames()).toEqual([
      "Visual Studio Code",
      "Obsidian",
      "Notepad++",
      "Kvetka Shell",
      "ShareX",
      "VLC media player",
    ]);

    await user.click(quickFilter(/^Favorites/));
    expect(rowNames()).toEqual(["Obsidian", "Everything", "VLC media player"]);

    await user.click(quickFilter(/^Downloads/));
    expect(screen.getByText("No active downloads")).toBeInTheDocument();
    expect(
      screen.getByText("Downloads and updates in progress will show up here."),
    ).toBeInTheDocument();

    await user.click(quickFilter(/^All/));
    expect(rowNames()).toEqual(RECENT);

    // The selected Installed tab drops the quick filter, as in the prototype.
    await user.click(quickFilter(/^Favorites/));
    await user.click(tab(/^Installed/));
    expect(quickFilter(/^All/)).toHaveAttribute("aria-pressed", "true");
    expect(rowNames()).toEqual(RECENT);
  });

  it("adds and removes favourites from the ⋯ menu", async () => {
    await renderLibrary();
    const menu = await openMenu("Flow Launcher");
    fireEvent.click(within(menu).getByRole("menuitem", { name: "Add to favorites" }));
    expect(screen.queryByRole("menu")).toBeNull();
    await waitFor(() =>
      expect(within(row("Flow Launcher")).getByRole("img", { name: "Favorites" })).toBeVisible(),
    );
    expect(tab(/^Favorites/)).toHaveTextContent("Favorites4");
    expect(within(aside()).getByRole("region", { name: "Library stats" })).toHaveTextContent(
      "4Favorites",
    );

    const again = await openMenu("Flow Launcher");
    fireEvent.click(within(again).getByRole("menuitem", { name: "Remove from favorites" }));
    await waitFor(() => expect(tab(/^Favorites/)).toHaveTextContent("Favorites3"));
    expect(within(row("Flow Launcher")).queryByRole("img", { name: "Favorites" })).toBeNull();
  });

  it("opens the app page and the install folder", async () => {
    const services = createTestServices();
    const openFolder = vi.spyOn(services.install, "openInstallFolder");
    const { router } = await renderLibrary(services);
    const menu = await openMenu("Krita");
    fireEvent.click(within(menu).getByRole("menuitem", { name: "Open install folder" }));
    expect(openFolder).toHaveBeenCalledWith("krita");

    fireEvent.click(within(row("Krita")).getByRole("button", { name: /^Krita/ }));
    expect(router.state.location.pathname).toBe("/app/krita");
  });

  it("uninstalls: the row goes, a toast confirms, counts and Updates drop, the marker clears", async () => {
    await renderLibrary();
    act(() => useDownloadsStore.setState({ justUpdated: { vscode: true, obsidian: true } }));
    const menu = await openMenu("Visual Studio Code");
    fireEvent.click(within(menu).getByRole("menuitem", { name: "Uninstall" }));

    await waitFor(() => expect(rowNames()).not.toContain("Visual Studio Code"));
    expect(toast()).toBe("Visual Studio Code uninstalled");
    expect(tab(/^Installed/)).toHaveTextContent("Installed13");
    expect(useDownloadsStore.getState().justUpdated).toEqual({ obsidian: true });
    expect(within(aside()).getByRole("region", { name: "Quick filters" })).toHaveTextContent(
      "All13Updates available5",
    );
    expect(useLibraryStore.getState().menuFor).toBeNull();
  });

  it("follows a download live: status lines, progress bar, Downloads filter, then Updated today", async () => {
    await renderLibrary();
    vi.useFakeTimers();
    try {
      fireEvent.click(within(row("Visual Studio Code")).getByRole("button", { name: "Update" }));
      await flush(3 * TICK);
      const code = row("Visual Studio Code");
      // 87 MB is the update's download size (its manifest), not the full 95 MB.
      expect(code).toHaveTextContent("Downloading… 30%26 MB of 87 MB");
      expect(within(code).getByRole("progressbar", { name: "Visual Studio Code" })).toHaveAttribute(
        "aria-valuenow",
        "30",
      );
      expect(within(aside()).getByRole("region", { name: "Quick filters" })).toHaveTextContent(
        "Downloads1",
      );

      fireEvent.click(within(code).getByRole("button", { name: "30% · Pause" }));
      await flush();
      expect(code).toHaveTextContent("Paused · 30%26 MB of 87 MB");
      fireEvent.click(within(code).getByRole("button", { name: "Resume" }));

      fireEvent.click(quickFilter(/^Downloads/));
      await flush();
      expect(rowNames()).toEqual(["Visual Studio Code"]);

      await flush(7 * TICK);
      expect(row("Visual Studio Code")).toHaveTextContent("Installing…");
      await flush(9 * TICK);
      expect(screen.getByText("No active downloads")).toBeInTheDocument();

      fireEvent.click(quickFilter(/^All/));
      await flush();
      const done = row("Visual Studio Code");
      expect(done).toHaveTextContent("1.93.0Updated today");
      expect(within(done).queryByRole("progressbar")).toBeNull();
      expect(within(done).getByRole("button", { name: "Open" })).toBeInTheDocument();
    } finally {
      vi.clearAllTimers();
      vi.useRealTimers();
    }
  });

  // The Updates list and the sidebar badge both come from `useUpdates()`.
  it("in the shell: an uninstalled update leaves the Updates count", async () => {
    const errors = vi.spyOn(console, "error");
    const warnings = vi.spyOn(console, "warn");
    try {
      const user = userEvent.setup();
      await renderApp({ route: "/library" });
      await act(async () => {
        await useSettingsStore.getState().update({ animations: false });
      });
      await screen.findByRole("heading", { level: 1, name: "Library" });
      const sidebar = screen.getByRole("navigation", { name: "Main" });
      const updates = () => within(sidebar).getByRole("button", { name: /^Updates/ });
      expect(updates()).toHaveTextContent("Updates6");

      await user.click(screen.getByRole("button", { name: "More actions for Obsidian" }));
      await user.click(await screen.findByRole("menuitem", { name: "Uninstall" }));
      await waitFor(() => expect(updates()).toHaveTextContent("Updates5"));
      expect(rowNames()).not.toContain("Obsidian");
      expect(screen.getByRole("status")).toHaveTextContent("Obsidian uninstalled");

      expect(errors).not.toHaveBeenCalled();
      expect(warnings).not.toHaveBeenCalled();
    } finally {
      vi.restoreAllMocks();
    }
  });

  describe("empty states", () => {
    it("empty library: Browse apps opens Browse", async () => {
      const services = createTestServices();
      const library = await services.install.getLibrary();
      for (const app of library.installed) await services.install.uninstall(app.appId);
      const { router } = await renderLibrary(services);
      expect(tab(/^Installed/)).toHaveTextContent("Installed0");
      expect(screen.getByText("Your library is empty")).toBeInTheDocument();
      expect(screen.getByText("Apps you install will show up here.")).toBeInTheDocument();
      fireEvent.click(screen.getByRole("button", { name: "Browse apps" }));
      expect(router.state.location.pathname).toBe("/browse");
    });

    it("no favorites (tab and quick filter)", async () => {
      const services = createTestServices();
      for (const id of ["obsidian", "everything", "vlc"]) {
        await services.install.setFavorite(id, false);
      }
      const user = userEvent.setup();
      await renderLibrary(services);
      await user.click(tab(/^Favorites/));
      expect(screen.getByText("No favorites yet")).toBeInTheDocument();
      expect(screen.getByText("Tap the star on any app to keep it here.")).toBeInTheDocument();
      expect(screen.queryByRole("button", { name: "Browse apps" })).toBeNull();
      await user.click(quickFilter(/^Favorites/));
      expect(screen.getByText("No favorites yet")).toBeInTheDocument();
    });

    it("everything up to date (Updates available filter)", async () => {
      const services = createTestServices();
      for (const id of ["vscode", "obsidian", "notepadpp", "shell", "sharex", "vlc"]) {
        await services.install.uninstall(id);
      }
      const user = userEvent.setup();
      await renderLibrary(services);
      await user.click(quickFilter(/^Updates available/));
      expect(screen.getByText("Everything is up to date")).toBeInTheDocument();
      expect(
        screen.getByText("Paparats checks for updates every hour in the background."),
      ).toBeInTheDocument();
    });

    it("a collection without installed apps: Nothing found", async () => {
      const services = createTestServices();
      for (const id of ["krita", "sharex", "vlc"]) await services.install.uninstall(id);
      const user = userEvent.setup();
      await renderLibrary(services);
      await user.click(within(aside()).getByRole("button", { name: /^Creative/ }));
      expect(screen.getByRole("navigation", { name: "Collections" })).toHaveTextContent(
        "All collections/Creative",
      );
      expect(screen.getByText("Nothing found")).toBeInTheDocument();
    });
  });
});
