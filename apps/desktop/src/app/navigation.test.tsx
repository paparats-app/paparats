import { screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { useLocation } from "react-router";
import { useBrowseStore } from "@/stores/useBrowseStore";
import { useIdeasStore } from "@/stores/useIdeasStore";
import { useLibraryStore } from "@/stores/useLibraryStore";
import { useUiStore } from "@/stores/useUiStore";
import { renderWithProviders } from "@/test/render";
import {
  activeSection,
  initialPathFromHash,
  parsePath,
  pathOf,
  resolveTarget,
  returnPath,
  sectionOfPath,
  useNav,
  type NavTarget,
} from "./navigation";
import { Sidebar } from "./Sidebar";

describe("paths", () => {
  const targets: NavTarget[] = [
    { to: "home" },
    { to: "browse" },
    { to: "categories" },
    { to: "updates" },
    { to: "library" },
    { to: "ideas" },
    { to: "idea", ideaId: "i3" },
    { to: "subscription" },
    { to: "settings" },
    { to: "settings", section: "sources" },
    { to: "profile" },
    { to: "app", appId: "obsidian" },
    { to: "channel", channelId: "foss-friends" },
    { to: "dev" },
  ];

  it("builds the architecture's paths and parses them back", () => {
    expect(targets.map(pathOf)).toEqual([
      "/home",
      "/browse",
      "/categories",
      "/updates",
      "/library",
      "/ideas",
      "/ideas/i3",
      "/subscription",
      "/settings",
      "/settings/sources",
      "/profile",
      "/app/obsidian",
      "/channel/foss-friends",
      "/dev",
    ]);
    for (const target of targets) expect(parsePath(pathOf(target))).toEqual(target);
  });

  it("rejects unknown paths and ignores unknown settings sections", () => {
    expect(parsePath("/nowhere")).toBeNull();
    expect(parsePath("/home/extra")).toBeNull();
    expect(parsePath("/app")).toBeNull();
    expect(parsePath("/settings/nope")).toEqual({ to: "settings" });
  });

  it("maps paths to sections; detail screens have none of their own", () => {
    expect(sectionOfPath("/settings/about")).toBe("settings");
    expect(sectionOfPath("/ideas")).toBe("ideas");
    expect(sectionOfPath("/ideas/i3")).toBeNull();
    expect(sectionOfPath("/app/obsidian")).toBeNull();
  });

  it("highlights the section a detail page was opened from", () => {
    expect(activeSection("/app/obsidian", { from: "/library" })).toBe("library");
    expect(activeSection("/channel/kvetka", { from: "/settings/sources" })).toBe("settings");
    expect(activeSection("/app/obsidian", null)).toBe("home");
    expect(activeSection("/app/obsidian", { from: "/bogus" })).toBe("home");
    expect(returnPath("/app/obsidian", { from: "/settings/sources" })).toBe("/settings/sources");
    expect(returnPath("/app/obsidian", undefined)).toBe("/home");
  });

  it("starts a browser session from the URL hash", () => {
    expect(initialPathFromHash("#/dev")).toBe("/dev");
    expect(initialPathFromHash("#/settings/about")).toBe("/settings/about");
    expect(initialPathFromHash("")).toBe("/home");
    expect(initialPathFromHash("#/nowhere")).toBe("/home");
  });
});

function Probe() {
  const { go, back, section } = useNav();
  const { pathname } = useLocation();
  return (
    <>
      <Sidebar />
      <output data-testid="where">{`${pathname} ${section}`}</output>
      <button onClick={() => go({ to: "app", appId: "obsidian" })}>app</button>
      <button onClick={() => go({ to: "channel", channelId: "kvetka" })}>channel</button>
      <button onClick={() => go({ to: "browse" })}>browse</button>
      <button onClick={() => go({ to: "browse", filters: { categories: ["media"] } })}>
        browse media
      </button>
      <button onClick={() => go({ to: "ideas", appFilter: "obsidian" })}>ideas for app</button>
      <button onClick={back}>back</button>
    </>
  );
}

describe("resolveTarget", () => {
  it("reopens the Settings section last shown when none is named (the prototype's `section`)", () => {
    expect(resolveTarget({ to: "settings" })).toEqual({ to: "settings" });
    useUiStore.getState().setSettingsSection("privacy");
    expect(resolveTarget({ to: "settings" })).toEqual({ to: "settings", section: "privacy" });
    expect(resolveTarget({ to: "settings", section: "about" })).toEqual({
      to: "settings",
      section: "about",
    });
    expect(resolveTarget({ to: "home" })).toEqual({ to: "home" });
    useUiStore.getState().setSettingsSection("general");
    expect(resolveTarget({ to: "settings" })).toEqual({ to: "settings" });
  });
});

describe("useNav", () => {
  const where = () => screen.getByTestId("where").textContent;
  const click = (name: string) => userEvent.click(screen.getByRole("button", { name }));

  it("returns from nested detail pages to the section they were opened from", async () => {
    await renderWithProviders(<Probe />, { route: "/library" });
    await click("app");
    expect(where()).toBe("/app/obsidian library");
    expect(screen.getByRole("button", { name: /^Library/ })).toHaveAttribute(
      "aria-current",
      "page",
    );
    await click("channel");
    expect(where()).toBe("/channel/kvetka library");
    await click("back");
    expect(where()).toBe("/library library");
  });

  it("returns to the settings section a channel was opened from", async () => {
    await renderWithProviders(<Probe />, { route: "/settings/sources" });
    await click("channel");
    expect(where()).toBe("/channel/kvetka settings");
    await click("back");
    expect(where()).toBe("/settings/sources settings");
  });

  it("presets Browse filters, or keeps them and drops the source filter", async () => {
    await renderWithProviders(<Probe />, { route: "/home" });
    useBrowseStore.setState({ pro: true, sources: ["kvetka"] });
    await click("browse media");
    expect(useBrowseStore.getState()).toMatchObject({ categories: ["media"], pro: false });

    useBrowseStore.setState({ sources: ["kvetka"] });
    await click("browse");
    expect(useBrowseStore.getState()).toMatchObject({ categories: ["media"], sources: [] });

    // The sidebar item resets every filter (the curated view).
    await userEvent.click(screen.getByRole("button", { name: /^Browse/ }));
    expect(useBrowseStore.getState().categories).toEqual([]);
  });

  it("focuses the ideas board on an app, closes menus and clears the search", async () => {
    await renderWithProviders(<Probe />, { route: "/home" });
    useIdeasStore.setState({ tab: "mine", statuses: ["open"] });
    useLibraryStore.setState({ menuFor: "obsidian" });
    useUiStore.getState().setQuery("obs");
    const before = useUiStore.getState().navCount;

    await click("ideas for app");
    expect(useIdeasStore.getState()).toMatchObject({
      appFilter: "obsidian",
      tab: "all",
      statuses: [],
    });
    expect(useLibraryStore.getState().menuFor).toBeNull();
    expect(useUiStore.getState()).toMatchObject({ query: "", navCount: before + 1 });
  });
});
