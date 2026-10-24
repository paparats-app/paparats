import type { IdeaDraft } from "../types";
import { createMockServices } from "./index";
import type { MockServices } from "./index";
import { createMemoryStorage } from "./runtime";

let services: MockServices;

beforeEach(() => {
  services = createMockServices({ latencyMs: 0, storage: createMemoryStorage() });
});

afterEach(() => services.dispose());

const draft = (patch: Partial<IdeaDraft> = {}): IdeaDraft => ({
  kind: "new",
  appId: null,
  category: "utilities",
  title: "  Window snapping presets  ",
  body: "  Save layouts per monitor.  ",
  ...patch,
});

describe("mock ideas", () => {
  it("vote toggles the user's vote", async () => {
    const { ideas } = services;
    expect(await ideas.vote("clip")).toMatchObject({ votes: 215, voted: true });
    expect(await ideas.vote("clip")).toMatchObject({ votes: 214, voted: false });
  });

  it("propose rejects a title shorter than the minimum after trimming", async () => {
    await expect(services.ideas.propose(draft({ title: "  Short  " }))).rejects.toMatchObject({
      kind: "invalid",
    });
    expect(services.world.ideas).toHaveLength(9);
  });

  it("propose puts the user's idea at the top of the board", async () => {
    const { ideas } = services;
    const created = await ideas.propose(draft());
    expect(created).toMatchObject({
      id: "u1",
      kind: "new",
      category: "utilities",
      appId: null,
      author: null,
      mine: true,
      votes: 1,
      voted: true,
      status: "open",
      date: "2026-09-15",
      title: "Window snapping presets",
      body: "Save layouts per monitor.",
      comments: [],
      releaseNoteDismissed: false,
    });
    const second = await ideas.propose(
      draft({ kind: "app", appId: "vlc", category: "media", title: "Better subtitles" }),
    );
    expect(second).toMatchObject({ id: "u2", kind: "app", appId: "vlc", category: null });
    expect((await ideas.getIdeas()).slice(0, 2).map((i) => i.id)).toEqual(["u2", "u1"]);
  });

  it("comments as the user or as a channel developer", async () => {
    const { ideas } = services;
    const byUser = await ideas.comment("pomodoro", "  Yes please  ", { kind: "user" });
    expect(byUser.comments.at(-1)).toEqual({
      author: null,
      dev: null,
      mine: true,
      date: "2026-09-15",
      text: "Yes please",
    });
    const byDev = await ideas.comment("pomodoro", "On it", {
      kind: "developer",
      channelId: "kvetka",
    });
    expect(byDev.comments.at(-1)).toEqual({
      author: "Kvetka",
      dev: "kvetka",
      mine: false,
      date: "2026-09-15",
      text: "On it",
    });
    await expect(ideas.comment("pomodoro", "   ", { kind: "user" })).rejects.toMatchObject({
      kind: "invalid",
    });
  });

  it("take pins an open idea to the channel; only open ideas can be taken", async () => {
    const { ideas } = services;
    expect(await ideas.take("pomodoro", "kvetka")).toMatchObject({
      status: "work",
      dev: "kvetka",
      devName: null,
      takenAt: "2026-09-15",
    });
    await expect(ideas.take("battery", "kvetka")).rejects.toMatchObject({ kind: "invalid" });
  });

  it("release marks the idea shipped in an app version", async () => {
    const { ideas } = services;
    await ideas.take("pomodoro", "kvetka");
    expect(await ideas.release("pomodoro", "shell", " 1.9.16 ")).toMatchObject({
      status: "released",
      releasedAt: "2026-09-15",
      releasedAppId: "shell",
      releasedVersion: "1.9.16",
    });
  });

  it("dismisses the release note and rejects unknown ideas", async () => {
    const { ideas } = services;
    expect(await ideas.dismissReleaseNote("slounik")).toMatchObject({
      releaseNoteDismissed: true,
    });
    await expect(ideas.vote("missing")).rejects.toMatchObject({ kind: "notFound" });
  });
});
