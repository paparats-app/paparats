// Behaviour of the small view-state stores: Browse, Library, Updates, Ideas, Home, Dialog.
import { useShallow } from "zustand/react/shallow";
import { renderHook } from "@testing-library/react";
import { resetStores } from "@/hooks/testing";
import { selectBrowseFilters, useBrowseStore } from "./useBrowseStore";
import { useDialogStore } from "./useDialogStore";
import { useHomeStore } from "./useHomeStore";
import { useIdeasStore } from "./useIdeasStore";
import { useLibraryStore } from "./useLibraryStore";
import { useUpdatesStore } from "./useUpdatesStore";

beforeEach(resetStores);

describe("useBrowseStore", () => {
  const browse = () => useBrowseStore.getState();
  const defaults = {
    categories: [],
    pro: false,
    portable: false,
    sort: "featured",
    collection: null,
    sources: [],
  };

  it("starts unfiltered", () => {
    expect(selectBrowseFilters(browse())).toEqual(defaults);
  });

  it("apply() resets every filter, then applies the preset", () => {
    browse().toggleCategory("media");
    browse().togglePro();
    browse().toggleSource("kvetka");
    browse().setFilterQuery("med");
    browse().apply({ categories: ["productivity"] });
    expect(selectBrowseFilters(browse())).toEqual({ ...defaults, categories: ["productivity"] });
    expect(browse().filterQuery).toBe("med");

    browse().apply({ collection: "essential" });
    expect(selectBrowseFilters(browse())).toEqual({ ...defaults, collection: "essential" });
    browse().apply();
    expect(selectBrowseFilters(browse())).toEqual(defaults);
  });

  it("closes an open collection when a filter changes", () => {
    for (const change of [
      () => browse().toggleCategory("design"),
      () => browse().togglePro(),
      () => browse().togglePortable(),
      () => browse().setSort("newest"),
      () => browse().toggleSource("fossfriends"),
    ]) {
      browse().apply({ collection: "creators" });
      change();
      expect(browse().collection).toBeNull();
    }
  });

  it("toggles categories and sources as multi-select", () => {
    browse().toggleCategory("design");
    browse().toggleCategory("media");
    browse().toggleCategory("design");
    expect(browse().categories).toEqual(["media"]);
    browse().toggleSource("kvetka");
    browse().toggleSource("fossfriends");
    browse().dropSource("kvetka");
    expect(browse().sources).toEqual(["fossfriends"]);
  });

  it("clearAll() restores the curated view", () => {
    browse().apply({ pro: true, sort: "size", sources: ["kvetka"] });
    browse().setHeroIndex(2);
    browse().clearAll();
    expect(selectBrowseFilters(browse())).toEqual(defaults);
    expect(browse().heroIndex).toBe(2);
  });

  it("selects the filters with a stable shallow selector", () => {
    const { result, rerender } = renderHook(() => useBrowseStore(useShallow(selectBrowseFilters)));
    const first = result.current;
    rerender();
    expect(result.current).toBe(first);
  });
});

describe("useLibraryStore", () => {
  const library = () => useLibraryStore.getState();

  it("starts on Installed, recently used, list view", () => {
    expect(library()).toMatchObject({
      tab: "installed",
      sort: "recent",
      view: "list",
      filter: "all",
      collection: null,
      menuFor: null,
    });
  });

  it("resets the quick filter and collection when switching tabs", () => {
    library().setFilter("updates");
    library().toggleMenu("vscode");
    library().setTab("favorites");
    expect(library()).toMatchObject({ tab: "favorites", filter: "all", menuFor: null });
  });

  it("jumps to the Installed tab for a quick filter", () => {
    library().openCollection("work");
    library().setFilter("downloads");
    expect(library()).toMatchObject({ tab: "installed", filter: "downloads", collection: null });
  });

  it("opens and closes collections", () => {
    library().openCollection("creative");
    expect(library()).toMatchObject({ tab: "collections", collection: "creative" });
    library().closeCollection();
    expect(library()).toMatchObject({ tab: "collections", collection: null });
  });

  it("toggles one overflow menu at a time", () => {
    library().toggleMenu("vscode");
    library().toggleMenu("vlc");
    expect(library().menuFor).toBe("vlc");
    library().toggleMenu("vlc");
    expect(library().menuFor).toBeNull();
    library().toggleMenu("vlc");
    library().closeMenu();
    expect(library().menuFor).toBeNull();
    library().setSort("size");
    library().setView("grid");
    expect(library()).toMatchObject({ sort: "size", view: "grid" });
  });
});

describe("useUpdatesStore", () => {
  it("starts with VS Code and Obsidian expanded", () => {
    expect(useUpdatesStore.getState().expanded).toEqual({ vscode: true, obsidian: true });
  });

  it("toggles rows and the history card", () => {
    const updates = () => useUpdatesStore.getState();
    updates().toggleExpanded("vscode");
    updates().toggleExpanded("sharex");
    expect(updates().expanded).toEqual({ vscode: false, obsidian: true, sharex: true });
    updates().toggleHistory();
    expect(updates().historyOpen).toBe(true);
  });
});

describe("useIdeasStore", () => {
  const ideas = () => useIdeasStore.getState();

  it("starts on All, top voted, no filters", () => {
    expect(ideas()).toMatchObject({ tab: "all", statuses: [], sort: "top", appFilter: null });
  });

  it("toggles status chips and sets tab, sort and app filter", () => {
    ideas().toggleStatus("open");
    ideas().toggleStatus("work");
    ideas().toggleStatus("open");
    expect(ideas().statuses).toEqual(["work"]);
    ideas().setTab("mine");
    ideas().setSort("new");
    ideas().setAppFilter("obsidian");
    expect(ideas()).toMatchObject({ tab: "mine", sort: "new", appFilter: "obsidian" });
  });

  it("focusApp() shows every idea about one app", () => {
    ideas().setTab("new");
    ideas().toggleStatus("released");
    ideas().focusApp("shell");
    expect(ideas()).toMatchObject({ tab: "all", statuses: [], appFilter: "shell" });
  });
});

describe("useHomeStore", () => {
  it("steps through the hero slides, wrapping around", () => {
    const home = () => useHomeStore.getState();
    home().step(-1, 3);
    expect(home().heroIndex).toBe(2);
    home().step(1, 3);
    expect(home().heroIndex).toBe(0);
    home().setHeroIndex(1);
    home().step(1, 0);
    expect(home().heroIndex).toBe(1);
  });

  it("switches the first-launch hero glow and resets it with the other stores", () => {
    const home = () => useHomeStore.getState();
    expect(home().heroGlow).toBe(false);
    home().setHeroGlow(true);
    expect(home().heroGlow).toBe(true);
    resetStores();
    expect(home().heroGlow).toBe(false);
  });
});

describe("useDialogStore", () => {
  it("opens one dialog at a time and closes it", () => {
    const dialogs = () => useDialogStore.getState();
    dialogs().open({ kind: "addChannel" });
    dialogs().open({ kind: "trustConfirm", channelId: "vitrazh" });
    expect(dialogs().dialog).toEqual({ kind: "trustConfirm", channelId: "vitrazh" });
    dialogs().close();
    expect(dialogs().dialog).toBeNull();
  });
});
