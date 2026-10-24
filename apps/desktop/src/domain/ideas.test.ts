import type { Idea } from "@/services/types";
import {
  canTake,
  effectiveIdeaTab,
  excerpt,
  filterIdeas,
  IDEA_TABS,
  ideasForApp,
  ideaTabPredicate,
  myApps,
  nextVersion,
  releaseNotes,
  sortIdeas,
  statusFilter,
  type IdeaListOptions,
} from "./ideas";
import { pickText } from "./text";
import { catalog, channelById, ideaById, ideas } from "./testFixtures";

const kvetkaApps = myApps(catalog.apps, channelById("kvetka"));
const ids = (list: readonly Idea[]) => list.map((i) => i.id);
const tabCtx = { myApps: kvetkaApps, devChannel: "kvetka" };

describe("myApps / canTake", () => {
  it("finds the apps the developer channel publishes", () => {
    expect(kvetkaApps.map((a) => a.id)).toEqual(["shell"]);
  });

  it("lets the developer view take open ideas for new apps or its own apps", () => {
    expect(canTake(ideaById("clip"), "developer", kvetkaApps)).toBe(true);
    expect(canTake(ideaById("iconpacks"), "developer", kvetkaApps)).toBe(true);
    expect(canTake(ideaById("scrollcap"), "developer", kvetkaApps)).toBe(false);
    expect(canTake(ideaById("battery"), "developer", kvetkaApps)).toBe(false);
    expect(canTake(ideaById("clip"), "user", kvetkaApps)).toBe(false);
  });
});

describe("tabs", () => {
  it("has four tabs per view", () => {
    expect(IDEA_TABS.user).toEqual(["all", "new", "app", "mine"]);
    expect(IDEA_TABS.developer).toEqual(["all", "new", "myapps", "mywork"]);
  });

  it("falls back to All when the view lacks the stored tab", () => {
    expect(effectiveIdeaTab("mine", "developer")).toBe("all");
    expect(effectiveIdeaTab("mywork", "user")).toBe("all");
    expect(effectiveIdeaTab("new", "developer")).toBe("new");
  });

  it("filters by tab", () => {
    const by = (tab: Parameters<typeof ideaTabPredicate>[0]) =>
      ids(ideas.filter(ideaTabPredicate(tab, tabCtx)));
    expect(by("all")).toHaveLength(ideas.length);
    expect(by("new")).toEqual(["clip", "battery", "ctxmenu", "pomodoro", "slounik"]);
    expect(by("app")).toEqual(["iconpacks", "multisend", "graphdark", "scrollcap"]);
    expect(by("mine")).toEqual(["battery", "slounik"]);
    expect(by("myapps")).toEqual(["iconpacks"]);
    expect(by("mywork")).toEqual(["ctxmenu"]);
  });
});

describe("status, sort, app filter", () => {
  it("filters by status (none selected = all)", () => {
    expect(statusFilter(ideas, [])).toHaveLength(ideas.length);
    expect(ids(statusFilter(ideas, ["work"]))).toEqual(["battery", "multisend"]);
    expect(ids(statusFilter(ideas, ["released", "work"]))).toEqual([
      "battery",
      "multisend",
      "ctxmenu",
      "graphdark",
      "slounik",
    ]);
  });

  it("sorts by votes or by date", () => {
    expect(ids(sortIdeas(ideas, "top")).slice(0, 3)).toEqual(["ctxmenu", "battery", "slounik"]);
    expect(ids(sortIdeas(ideas, "new")).slice(0, 3)).toEqual(["pomodoro", "iconpacks", "clip"]);
  });

  it("composes app filter → tab → statuses → sort", () => {
    const options: IdeaListOptions = {
      ...tabCtx,
      view: "user",
      tab: "new",
      statuses: ["open", "released"],
      sort: "top",
      appFilter: null,
    };
    expect(ids(filterIdeas(ideas, options))).toEqual(["ctxmenu", "slounik", "clip", "pomodoro"]);
    expect(
      ids(filterIdeas(ideas, { ...options, tab: "all", statuses: [], appFilter: "sharex" })),
    ).toEqual(["scrollcap"]);
    expect(
      ids(filterIdeas(ideas, { ...options, view: "developer", tab: "mine", statuses: [] })),
    ).toHaveLength(ideas.length);
    expect(ids(ideasForApp(ideas, "obsidian"))).toEqual(["graphdark"]);
  });
});

describe("releaseNotes", () => {
  const released = (patch: Partial<Idea>): Idea => ({
    ...(ideas[0] as Idea),
    mine: true,
    status: "released",
    releaseNoteDismissed: false,
    ...patch,
  });

  it("lists the user's own released ideas until the note is dismissed", () => {
    const list = [
      released({ id: "a" }),
      released({ id: "b", releaseNoteDismissed: true }),
      released({ id: "c", mine: false }),
      released({ id: "d", status: "work" }),
    ];
    expect(ids(releaseNotes(list, "user"))).toEqual(["a"]);
  });

  it("is empty in the developer view", () => {
    expect(releaseNotes([released({ id: "a" })], "developer")).toEqual([]);
  });
});

describe("nextVersion", () => {
  it("increments the last numeric segment", () => {
    expect(nextVersion("1.9.15")).toBe("1.9.16");
    expect(nextVersion("25.01")).toBe("25.2");
    expect(nextVersion("146")).toBe("147");
    expect(nextVersion("2.0.0-beta")).toBe("2.0.1");
    expect(nextVersion("1.x")).toBe("1.1");
  });
});

describe("excerpt", () => {
  it("keeps short bodies whole", () => {
    expect(excerpt("Short idea.")).toBe("Short idea.");
    expect(excerpt("x".repeat(150))).toBe("x".repeat(150));
  });

  it("cuts long bodies at a word boundary before 147 characters and adds an ellipsis", () => {
    const body = pickText(ideaById("clip").body, "en");
    expect(body.length).toBeGreaterThan(150);
    expect(excerpt(body)).toBe(
      "A tray app that remembers everything I copy — text, images, files — with search and a handful of pinned snippets that never expire. Windows’ own…",
    );
    expect(excerpt(pickText(ideaById("clip").body, "ru")).length).toBeLessThanOrEqual(148);
  });
});
