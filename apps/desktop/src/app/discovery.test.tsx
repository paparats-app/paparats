// M2 "Discovery" end to end through the whole shell (renderApp): sidebar navigation from every
// discovery screen, detail pages returning to their section, Browse filters, Categories → Browse,
// global search (skeleton, results, empty, offline) and the app-page actions. No console errors.
import { act, screen, waitFor, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { vi } from "vitest";
import { useBrowseStore } from "@/stores/useBrowseStore";
import { useSettingsStore } from "@/stores/useSettingsStore";
import { useUiStore } from "@/stores/useUiStore";
import { renderApp } from "@/test/render";

const SECTIONS = [
  "Home",
  "Browse",
  "Categories",
  "Updates",
  "Library",
  "Ideas",
  "Subscription",
  "Settings",
] as const;

const sidebar = () => screen.getByRole("navigation", { name: "Main" });
const navItem = (name: string) =>
  within(sidebar()).getByRole("button", { name: new RegExp(`^${name}`) });
const current = () =>
  within(sidebar())
    .getAllByRole("button")
    .filter((b) => b.getAttribute("aria-current") === "page")
    .map((b) => SECTIONS.find((s) => b.textContent?.startsWith(s)));
const searchBox = () => screen.getByRole("searchbox", { name: "Search for apps, tools, ideas…" });
const h1 = (name: string) => screen.findByRole("heading", { level: 1, name });
/** The store card whose name is `name`, inside `scope`. */
function card(name: string, scope: HTMLElement = document.body): HTMLElement {
  const el = within(scope)
    .getAllByText(name, { selector: "span" })
    .map((span) => span.closest<HTMLElement>("[data-app-card]"))
    .find((c) => c !== null);
  if (!el) throw new Error(`no card for ${name}`);
  return el;
}
/** Opens a card's app page through its icon/text area. */
const openCard = (user: ReturnType<typeof userEvent.setup>, name: string, scope?: HTMLElement) =>
  user.click(within(card(name, scope)).getAllByRole("button")[0] as HTMLElement);
const back = (user: ReturnType<typeof userEvent.setup>) =>
  user.click(screen.getByRole("button", { name: "Back" }));

async function start(route = "/home") {
  const user = userEvent.setup();
  const rendered = await renderApp({ route });
  // Skip the 420 ms navigation skeleton; every flow below navigates a lot.
  await act(async () => {
    await useSettingsStore.getState().update({ animations: false });
  });
  return { user, ...rendered };
}

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

describe("Discovery (M2) end to end", () => {
  it("reaches every sidebar section from every discovery screen", async () => {
    const { user } = await start();
    const starts: Array<() => Promise<void>> = [
      () => user.click(navItem("Home")),
      () => user.click(navItem("Browse")),
      () => user.click(navItem("Categories")),
      async () => {
        await user.click(navItem("Home"));
        await openCard(
          user,
          "Obsidian",
          await screen.findByRole("region", { name: "Featured apps" }),
        );
        await h1("Obsidian");
      },
      async () => {
        await user.type(searchBox(), "vlc");
        await screen.findByRole("heading", { level: 1, name: "Results for “vlc”" });
      },
    ];
    for (const open of starts) {
      for (const section of SECTIONS) {
        await open();
        await user.click(navItem(section));
        expect(current()).toEqual([section]);
        expect(searchBox()).toHaveValue("");
        expect(screen.getByTestId("screen")).toBeVisible();
      }
    }
  }, 30_000);

  it("returns from app pages to the section they were opened from", async () => {
    const { user } = await start();

    // Home › Featured apps → Obsidian → Back.
    await openCard(user, "Obsidian", await screen.findByRole("region", { name: "Featured apps" }));
    await h1("Obsidian");
    expect(current()).toEqual(["Home"]);
    await back(user);
    expect(current()).toEqual(["Home"]);
    expect(await screen.findByRole("region", { name: "Featured apps" })).toBeVisible();

    // Browse with a filter → a result → More in → another app → Back: Browse, filter kept.
    await user.click(navItem("Browse"));
    await user.click(await screen.findByRole("checkbox", { name: "Pro features" }));
    const results = screen.getByRole("list", { name: /\d+ apps$/ });
    await openCard(user, "Obsidian", results);
    await h1("Obsidian");
    expect(current()).toEqual(["Browse"]);
    expect(screen.getByRole("heading", { name: "More in “For Developers”" })).toBeVisible();
    await openCard(user, "Flow Launcher");
    await h1("Flow Launcher");
    expect(current()).toEqual(["Browse"]);
    await back(user);
    await h1("Browse");
    expect(current()).toEqual(["Browse"]);
    expect(screen.getByRole("checkbox", { name: "Pro features" })).toBeChecked();

    // Categories › Featured in Productivity → an app → Back.
    await user.click(navItem("Categories"));
    await h1("Categories");
    await openCard(user, "Obsidian");
    await h1("Obsidian");
    expect(current()).toEqual(["Categories"]);
    await back(user);
    await h1("Categories");

    // Search from Library → a result → Back returns to Library (the search is cleared).
    await user.click(navItem("Library"));
    await user.type(searchBox(), "obs");
    await waitFor(() => expect(screen.queryByTestId("search-skeleton")).toBeNull());
    await openCard(user, "OBS Studio", screen.getByRole("region", { name: "Results for “obs”" }));
    await h1("OBS Studio");
    expect(searchBox()).toHaveValue("");
    expect(current()).toEqual(["Library"]);
    await back(user);
    expect(current()).toEqual(["Library"]);
  });

  it("opens a category from Categories as Browse results; Clear all brings back the curated view", async () => {
    const { user } = await start("/categories");
    await user.click(await screen.findByRole("button", { name: /^Media/ }));
    await h1("Browse");
    expect(current()).toEqual(["Browse"]);
    expect(screen.getByRole("checkbox", { name: "Media" })).toBeChecked();
    expect(screen.getByRole("checkbox", { name: "Productivity" })).not.toBeChecked();
    const results = screen.getByRole("list", { name: /\d+ apps$/ });
    expect(within(results).getByText("VLC media player")).toBeInTheDocument();
    expect(within(results).queryByText("Obsidian")).toBeNull();

    // Filter search narrows the category list; sort and portable reorder and narrow the results.
    await user.type(screen.getByRole("searchbox", { name: "Search filters…" }), "gam");
    const group = screen.getByRole("group", { name: "Category" });
    expect(within(group).getAllByRole("checkbox")).toHaveLength(1);
    expect(within(group).getByRole("checkbox", { name: "Games" })).toBeInTheDocument();
    await user.clear(screen.getByRole("searchbox", { name: "Search filters…" }));
    await user.click(screen.getByRole("radio", { name: "Size" }));
    await user.click(screen.getByRole("checkbox", { name: "Portable build" }));
    expect(useBrowseStore.getState()).toMatchObject({
      categories: ["media"],
      sort: "size",
      portable: true,
    });
    const ids = within(screen.getByRole("list", { name: /\d+ apps$/ }))
      .getAllByRole("listitem")
      .map((item) => item.dataset.appId);
    // mpv is from mpv builds, which is not followed; OBS Studio has no portable build.
    expect(ids).toEqual(["audacity", "vlc", "imageglass"]);

    const clear = screen
      .getAllByRole("button", { name: "Clear all" })
      .find((b) => !b.closest("aside"));
    await user.click(clear as HTMLElement);
    expect(await screen.findByRole("heading", { name: "Top categories" })).toBeVisible();
    expect(screen.getByRole("checkbox", { name: "Media" })).not.toBeChecked();
    expect(screen.getByRole("radio", { name: "Featured" })).toBeChecked();
  });

  it("searches with the skeleton, then shows results, the empty state and the offline state", async () => {
    const { user } = await start();
    await user.type(searchBox(), "zzz");
    const region = await screen.findByRole("region", { name: "Results for “zzz”" });
    expect(within(region).getByRole("status")).toHaveTextContent("Searching…");
    expect(screen.getByTestId("search-skeleton").children).toHaveLength(6);

    expect(await within(region).findByText("Nothing found")).toBeVisible();
    const suggestions = within(region).getByRole("group", { name: "Try one of these" });
    await user.click(within(suggestions).getByRole("button", { name: "Obsidian" }));
    expect(searchBox()).toHaveValue("Obsidian");
    expect(screen.queryByTestId("search-skeleton")).toBeNull();
    expect(
      within(screen.getByRole("region", { name: "Results for “Obsidian”" })).getByRole("status"),
    ).toHaveTextContent("1 app");

    await act(async () => {
      await useSettingsStore.getState().update({ simulateOffline: true });
    });
    const offline = screen.getByRole("region", { name: "Results for “Obsidian”" });
    expect(within(offline).getByText("Search needs a connection")).toBeVisible();
    await user.click(within(offline).getByRole("button", { name: "Library" }));
    expect(current()).toEqual(["Library"]);
    expect(useUiStore.getState().query).toBe("");
  });

  it("installs from a Browse card and follows the download on the app page", async () => {
    const { user } = await start("/categories");
    await user.click(await screen.findByRole("button", { name: /^Media/ }));
    const obs = card("OBS Studio", screen.getByRole("list", { name: /\d+ apps$/ }));
    await user.click(within(obs).getByRole("button", { name: "Get" }));
    await waitFor(() =>
      expect(within(obs).getByRole("button", { name: /^\d+% · Pause$/ })).toBeInTheDocument(),
    );

    await openCard(user, "OBS Studio");
    await h1("OBS Studio");
    const header = screen.getByRole("heading", { level: 1, name: "OBS Studio" }).closest("header");
    expect(header).not.toBeNull();
    const top = within(header as HTMLElement);
    expect(await top.findByText(/^Downloading… \d+% · /)).toBeInTheDocument();
    await user.click(top.getByRole("button", { name: "Cancel" }));
    expect(await top.findByRole("button", { name: "Get" })).toBeInTheDocument();

    // The favourite star toggles.
    const star = top.getByRole("button", { name: "Add to favorites" });
    await user.click(star);
    expect(await top.findByRole("button", { name: "Remove from favorites" })).toHaveAttribute(
      "aria-pressed",
      "true",
    );
  });
});
