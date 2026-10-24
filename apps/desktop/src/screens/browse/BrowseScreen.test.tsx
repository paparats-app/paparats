import { screen, waitFor, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { useNav } from "@/app/navigation";
import type { MockServices } from "@/services";
import { useBrowseStore } from "@/stores/useBrowseStore";
import { useDownloadsStore } from "@/stores/useDownloadsStore";
import { createTestServices, renderWithProviders } from "@/test/render";
import { BrowseScreen } from "./BrowseScreen";

// The fixture world follows Paparats, Kvetka and FOSS Friends: 30 visible apps.
const VISIBLE = 30;

async function renderBrowse(services?: MockServices, ui = <BrowseScreen />) {
  const rendered = await renderWithProviders(ui, { route: "/browse", services });
  await screen.findByRole("heading", { name: "Featured apps" });
  await screen.findByRole("checkbox", { name: "Games" });
  return rendered;
}

/** The result grid (labelled by its "N apps" count). */
const results = () => screen.getByRole("list", { name: /\d+ apps?$/ });
const resultIds = () =>
  within(results())
    .getAllByRole("listitem")
    .map((item) => item.dataset.appId);
const count = () => results().getAttribute("aria-labelledby") ?? "";
const countText = () => document.getElementById(count())?.textContent;
const curated = () => screen.queryByRole("heading", { name: "Top categories" });
/** "Clear all" of the results header (the filter panel has its own). */
const headerClear = () => {
  const button = screen
    .getAllByRole("button", { name: "Clear all" })
    .find((b) => !b.closest("aside"));
  if (!button) throw new Error("no results header");
  return button;
};

describe("BrowseScreen", () => {
  it("renders the banner, the curated view and the filter panel", async () => {
    await renderBrowse();
    expect(screen.getByRole("heading", { level: 1, name: "Browse" })).toBeInTheDocument();
    expect(
      screen.getByText("Curated apps for work, creativity and everyday life."),
    ).toBeInTheDocument();
    expect(screen.getByText("Small apps. Big possibilities.")).toBeInTheDocument();

    // Hero: Obsidian first, three dots.
    expect(await screen.findByRole("button", { name: "Get Obsidian" })).toBeInTheDocument();
    expect(screen.getAllByRole("button", { name: /^Slide \d of 3$/ })).toHaveLength(3);

    // Featured apps: the first five featured ids.
    const featured = screen.getByRole("list", { name: "Featured apps" });
    expect(within(featured).getAllByRole("listitem")).toHaveLength(5);
    expect(within(featured).getByText("Notepad++")).toBeInTheDocument();
    expect(within(featured).queryByText("Everything")).toBeNull();

    // New and notable: 4 rows; Shell comes from Kvetka (channel chip).
    const notable = screen.getByRole("list", { name: "New and notable" });
    expect(within(notable).getAllByRole("listitem")).toHaveLength(4);
    expect(within(notable).getByText("Kvetka")).toBeInTheDocument();

    // Top categories: the first six, with the catalog counts.
    const top = screen.getByRole("list", { name: "Top categories" });
    expect(within(top).getAllByRole("button")).toHaveLength(6);
    expect(within(top).getByRole("button", { name: /Productivity\s*142 apps/ })).toBeVisible();
    expect(within(top).queryByText("Games")).toBeNull();

    // Filter panel: nine categories, the always-on rows, the sort radios.
    const panel = screen.getByRole("complementary", { name: "Filters" });
    expect(
      within(within(panel).getByRole("group", { name: "Category" })).getAllByRole("checkbox"),
    ).toHaveLength(9);
    expect(within(panel).getByRole("checkbox", { name: "Free" })).toBeDisabled();
    expect(within(panel).getByRole("checkbox", { name: "Windows" })).toBeChecked();
    expect(within(panel).getByRole("radio", { name: "Featured" })).toBeChecked();
    expect(screen.queryByRole("list", { name: /\d+ apps?$/ })).toBeNull();
  });

  it("narrows the results with each filter and combines them", async () => {
    const user = userEvent.setup();
    await renderBrowse();

    await user.click(screen.getByRole("checkbox", { name: "Games" }));
    expect(curated()).toBeNull();
    expect(countText()).toBe("2 apps");
    expect(resultIds()).toEqual(["mindustry", "supertuxkart"]);

    await user.click(screen.getByRole("checkbox", { name: "Education" }));
    expect(resultIds()).toEqual(["anki", "stellarium", "mindustry", "supertuxkart"]);

    await user.click(screen.getByRole("checkbox", { name: "Portable build" }));
    expect(resultIds()).toEqual(["stellarium", "mindustry"]);

    await user.click(screen.getByRole("checkbox", { name: "Games" }));
    await user.click(screen.getByRole("checkbox", { name: "Education" }));
    expect(countText()).toBe("23 apps");

    await user.click(screen.getByRole("checkbox", { name: "Pro features" }));
    expect(resultIds()).toEqual(["obsidian", "sharex", "flow", "krita", "rustdesk"]);

    await user.click(screen.getByRole("checkbox", { name: "Pro features" }));
    await user.click(screen.getByRole("checkbox", { name: "Portable build" }));
    await user.click(screen.getByRole("checkbox", { name: /FOSS Friends/ }));
    expect(resultIds()).toEqual(["czkawka", "imageglass", "rufus"]);
    await user.click(screen.getByRole("checkbox", { name: /Kvetka/ }));
    expect(resultIds()).toEqual(["shell", "czkawka", "imageglass", "rufus"]);
  });

  it("sorts by newest, name and size", async () => {
    const user = userEvent.setup();
    await renderBrowse();

    await user.click(screen.getByRole("radio", { name: "Newest" }));
    expect(countText()).toBe(`${VISIBLE} apps`);
    expect(resultIds().slice(0, 6)).toEqual([
      "shell",
      "vscode",
      "sharex",
      "notepadpp",
      "rustdesk",
      "vlc",
    ]);

    await user.click(screen.getByRole("radio", { name: "A–Z" }));
    expect(resultIds().slice(0, 4)).toEqual(["sevenzip", "anki", "audacity", "bitwarden"]);

    await user.click(screen.getByRole("radio", { name: "Size" }));
    expect(resultIds().slice(0, 4)).toEqual(["supertuxkart", "stellarium", "powertoys", "joplin"]);

    // Back to Featured with no other filter: the curated view.
    await user.click(screen.getByRole("radio", { name: "Featured" }));
    expect(curated()).toBeInTheDocument();
  });

  it("restores the curated view with either Clear all", async () => {
    const user = userEvent.setup();
    await renderBrowse();

    await user.click(screen.getByRole("checkbox", { name: "Media" }));
    await user.click(screen.getByRole("radio", { name: "Size" }));
    await user.click(headerClear());
    expect(curated()).toBeInTheDocument();
    expect(screen.getByRole("checkbox", { name: "Media" })).not.toBeChecked();
    expect(screen.getByRole("radio", { name: "Featured" })).toBeChecked();

    await user.click(screen.getByRole("checkbox", { name: "Pro features" }));
    const panel = screen.getByRole("complementary", { name: "Filters" });
    await user.click(within(panel).getByRole("button", { name: "Clear all" }));
    expect(curated()).toBeInTheDocument();
    expect(useBrowseStore.getState()).toMatchObject({ pro: false, sort: "featured" });
  });

  it("live-filters the category list with Search filters…", async () => {
    const user = userEvent.setup();
    await renderBrowse();
    const group = screen.getByRole("group", { name: "Category" });

    await user.type(screen.getByRole("searchbox", { name: "Search filters…" }), "  DE");
    expect(within(group).getAllByRole("checkbox")).toHaveLength(2);
    expect(within(group).getByRole("checkbox", { name: "Development" })).toBeInTheDocument();
    expect(within(group).getByRole("checkbox", { name: "Design" })).toBeInTheDocument();
    expect(within(group).queryByRole("checkbox", { name: "Games" })).toBeNull();
    // Only the list narrows: nothing is filtered yet.
    expect(curated()).toBeInTheDocument();
  });

  it("applies a category from Top categories and from a navigation preset", async () => {
    const user = userEvent.setup();
    function Preset() {
      const nav = useNav();
      return (
        <button
          type="button"
          onClick={() => nav.go({ to: "browse", filters: { categories: ["media"] } })}
        >
          preset
        </button>
      );
    }
    await renderBrowse(
      undefined,
      <>
        <Preset />
        <BrowseScreen />
      </>,
    );

    const top = screen.getByRole("list", { name: "Top categories" });
    await user.click(within(top).getByRole("button", { name: /^Design/ }));
    expect(screen.getByRole("checkbox", { name: "Design" })).toBeChecked();
    expect(resultIds()).toEqual(["krita", "inkscape"]);

    // Categories screen → Browse: every filter reset, then the category.
    await user.click(screen.getByRole("checkbox", { name: "Pro features" }));
    await user.click(screen.getByRole("button", { name: "preset" }));
    expect(screen.getByRole("checkbox", { name: "Media" })).toBeChecked();
    expect(screen.getByRole("checkbox", { name: "Design" })).not.toBeChecked();
    expect(screen.getByRole("checkbox", { name: "Pro features" })).not.toBeChecked();
    expect(resultIds()).toEqual(["vlc", "obs", "audacity", "imageglass"]);
  });

  it("shows the Source group only with more than one active channel", async () => {
    const one = createTestServices();
    one.world.subscriptions = one.world.subscriptions.map((s) => ({
      ...s,
      paused: s.channelId !== "paparats",
    }));
    const user = userEvent.setup();
    const { unmount } = await renderBrowse(one);
    // Subscriptions loaded: Paparats' apps plus the installed Shell and Czkawka.
    await user.click(screen.getByRole("radio", { name: "Newest" }));
    await waitFor(() => expect(countText()).toBe("28 apps"));
    expect(screen.queryByRole("group", { name: "Source" })).toBeNull();
    unmount();
    useBrowseStore.getState().clearAll();

    await renderBrowse();
    const group = await screen.findByRole("group", { name: "Source" });
    const options = within(group).getAllByRole("checkbox");
    expect(options.map((o) => o.closest("label")?.textContent)).toEqual([
      "Paparats26",
      "Kvetka1",
      "FOSS Friends3",
    ]);
  });

  it("opens a collection and leaves it when a filter changes", async () => {
    const user = userEvent.setup();
    useBrowseStore.getState().apply({ collection: "creators" });
    await renderWithProviders(<BrowseScreen />, { route: "/browse" });

    expect(await screen.findByRole("heading", { level: 1, name: "For Creators" })).toBeVisible();
    expect(screen.getByText("Design. Build. Create.")).toBeInTheDocument();
    await waitFor(() =>
      expect(resultIds()).toEqual(["krita", "inkscape", "obs", "audacity", "sharex"]),
    );

    await user.click(screen.getByRole("radio", { name: "A–Z" }));
    expect(screen.getByRole("heading", { level: 1, name: "Browse" })).toBeInTheDocument();
    expect(countText()).toBe(`${VISIBLE} apps`);
  });

  it("switches hero slides and opens the See all lists", async () => {
    const user = userEvent.setup();
    const { router } = await renderBrowse();

    await user.click(screen.getByRole("button", { name: "Slide 2 of 3" }));
    expect(screen.getByRole("button", { name: "Get Krita" })).toBeInTheDocument();
    expect(screen.getByText("Paint")).toBeInTheDocument();

    const seeAll = (section: string) =>
      within(screen.getByRole("heading", { name: section }).parentElement as HTMLElement).getByRole(
        "button",
        { name: "See all" },
      );

    await user.click(seeAll("Featured apps"));
    expect(screen.getByRole("radio", { name: "A–Z" })).toBeChecked();
    expect(curated()).toBeNull();
    expect(router.state.location.pathname).toBe("/browse");

    await user.click(headerClear());
    await user.click(seeAll("New and notable"));
    expect(screen.getByRole("radio", { name: "Newest" })).toBeChecked();
    expect(resultIds()[0]).toBe("shell");
  });

  it("Get <App> downloads an app that is not installed, else opens its page", async () => {
    const user = userEvent.setup();
    const services = createTestServices();
    services.world.library.installed = services.world.library.installed.filter(
      (i) => i.appId !== "obsidian",
    );
    const { router } = await renderBrowse(services);

    await user.click(await screen.findByRole("button", { name: "Get Obsidian" }));
    await waitFor(() => expect(useDownloadsStore.getState().items.obsidian).toBeDefined());
    expect(router.state.location.pathname).toBe("/browse");

    // Krita is installed: the CTA opens the app page.
    await user.click(screen.getByRole("button", { name: "Slide 2 of 3" }));
    await user.click(screen.getByRole("button", { name: "Get Krita" }));
    expect(router.state.location.pathname).toBe("/app/krita");
  });

  it("runs a card's action and opens the app page from it", async () => {
    const user = userEvent.setup();
    const { router } = await renderBrowse();
    await user.click(screen.getByRole("checkbox", { name: "Games" }));
    const card = () => results().querySelector<HTMLElement>('[data-app-id="mindustry"]');
    await user.click(within(card() as HTMLElement).getByRole("button", { name: "Get" }));
    await waitFor(() => expect(useDownloadsStore.getState().items.mindustry).toBeDefined());

    await user.click(within(card() as HTMLElement).getByRole("button", { name: "Details" }));
    expect(router.state.location.pathname).toBe("/app/mindustry");
  });
});
