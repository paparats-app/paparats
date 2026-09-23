import ideasJson from "@fixtures/ideas.json";
import type { AppIndex } from "@/hooks";
import type { App, ChannelInfo, Idea } from "@/services/types";
import { developerAction, developerTint, reachedStep } from "./ideaDetail";

const ideas = ideasJson.ideas as Idea[];
const idea = (id: string): Idea => {
  const found = ideas.find((i) => i.id === id);
  if (!found) throw new Error(`no idea ${id}`);
  return found;
};

const shell = { id: "shell", tint: "#3b6fd1" } as App;
const localsend = { id: "localsend", tint: "#2fa48a" } as App;
const apps: AppIndex = {
  byId: { shell, localsend },
  get: (id) => (id === "shell" ? shell : id === "localsend" ? localsend : undefined),
};
const channels = { winaero: { id: "winaero", tint: "#c27a2f" } as ChannelInfo };

describe("idea detail helpers", () => {
  it("reaches one timeline step per status", () => {
    expect(reachedStep("open")).toBe(0);
    expect(reachedStep("work")).toBe(1);
    expect(reachedStep("released")).toBe(2);
  });

  it("tints the developer dot with the channel, else the improved app", () => {
    expect(developerTint(idea("battery"), channels, apps)).toBe("#c27a2f");
    expect(developerTint(idea("multisend"), channels, apps)).toBe("#2fa48a");
    // An unknown channel falls back to the muted text colour, as in the prototype.
    expect(developerTint(idea("slounik"), channels, apps)).toBe("var(--text3)");
  });

  it("gives the developer view Take, Mark as released or the other developer", () => {
    const mine = [shell];
    expect(developerAction(idea("clip"), "developer", "nilesoft", mine, "")).toEqual({
      type: "take",
    });
    expect(developerAction(idea("iconpacks"), "developer", "nilesoft", mine, "")).toEqual({
      type: "take",
    });
    expect(developerAction(idea("scrollcap"), "developer", "nilesoft", mine, "")).toBeNull();
    expect(developerAction(idea("battery"), "developer", "nilesoft", mine, "Winaero")).toEqual({
      type: "takenByOther",
      developer: "Winaero",
    });
    const ours = { ...idea("battery"), dev: "nilesoft" };
    expect(developerAction(ours, "developer", "nilesoft", mine, "Nilesoft")).toEqual({
      type: "release",
    });
    expect(developerAction(idea("ctxmenu"), "developer", "nilesoft", mine, "Nilesoft")).toBeNull();
    // The user view never acts.
    expect(developerAction(idea("clip"), "user", "nilesoft", mine, "")).toBeNull();
    expect(developerAction(ours, "user", "nilesoft", mine, "Nilesoft")).toBeNull();
  });
});
