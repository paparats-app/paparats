import { createMockServices } from "./index";
import type { MockServices } from "./index";
import { findChannelByAddress, normaliseAddress } from "@/domain/channels";
import { createMemoryStorage } from "./runtime";

let services: MockServices;

beforeEach(() => {
  services = createMockServices({ latencyMs: 0, storage: createMemoryStorage() });
});

afterEach(() => services.dispose());

// Matching lives in domain/channels.ts; these cases pin it against the mock world.
describe("channel lookup", () => {
  it("normalises like the prototype: trim, case, scheme, www., trailing slashes", () => {
    expect(normaliseAddress("  HTTPS://www.Nilesoft.org/paparats/// ")).toBe(
      "nilesoft.org/paparats",
    );
    expect(normaliseAddress("http://mpv.io")).toBe("mpv.io");
  });

  it.each([
    ["winaero.com/paparats", "winaero"],
    ["https://www.WinAero.com/paparats/", "winaero"],
    ["winaero.com", "winaero"],
    ["@winaero", "winaero"],
    ["WINAERO", "winaero"],
    ["mpv", "mpvbuilds"],
    ["http://mpv.io/paparats//", "mpvbuilds"],
    ["bysoft.by", "bysoft"],
  ])("finds %s → %s", (address, id) => {
    expect(findChannelByAddress(services.world.channels, address)?.id).toBe(id);
  });

  it.each(["", "   ", "example.org", "@nobody", "winaero.com/other"])(
    "does not match %j",
    (address) => {
      expect(findChannelByAddress(services.world.channels, address)).toBeUndefined();
    },
  );

  it("reports found / alreadySubscribed / notFound", async () => {
    const { channels } = services;
    expect(await channels.lookup("@winaero")).toMatchObject({
      kind: "found",
      channel: { id: "winaero" },
    });
    expect(await channels.lookup("https://nilesoft.org/paparats/")).toMatchObject({
      kind: "alreadySubscribed",
      channel: { id: "nilesoft" },
    });
    expect(await channels.lookup("nothing.here")).toEqual({ kind: "notFound" });
  });
});

describe("mock channels", () => {
  it("subscribe appends once; unknown channels reject notFound", async () => {
    const { channels } = services;
    const after = await channels.subscribe("winaero");
    expect(after.map((s) => s.channelId)).toEqual([
      "paparats",
      "nilesoft",
      "fossfriends",
      "winaero",
    ]);
    expect(after.at(-1)).toEqual({ channelId: "winaero", paused: false, staleAcknowledged: false });
    expect(await channels.subscribe("winaero")).toHaveLength(4);
    await expect(channels.subscribe("nope")).rejects.toMatchObject({ kind: "notFound" });
  });

  it("protects the official catalog from unsubscribe and pause", async () => {
    const { channels } = services;
    await expect(channels.unsubscribe("paparats")).rejects.toMatchObject({ kind: "invalid" });
    await expect(channels.setPaused("paparats", true)).rejects.toMatchObject({ kind: "invalid" });
    expect((await channels.getSubscriptions())[0]).toMatchObject({
      channelId: "paparats",
      paused: false,
    });
  });

  it("unsubscribes, pauses and acknowledges stale channels", async () => {
    const { channels } = services;
    const paused = await channels.setPaused("nilesoft", true);
    expect(paused.find((s) => s.channelId === "nilesoft")?.paused).toBe(true);

    const acknowledged = await channels.acknowledgeStale("fossfriends");
    expect(acknowledged.find((s) => s.channelId === "fossfriends")?.staleAcknowledged).toBe(true);

    const left = await channels.unsubscribe("nilesoft");
    expect(left.map((s) => s.channelId)).toEqual(["paparats", "fossfriends"]);
    await expect(channels.setPaused("winaero", true)).rejects.toMatchObject({ kind: "notFound" });
  });

  it("sync reports an outage in days, otherwise stamps today", async () => {
    const { channels } = services;
    // fossfriends went down on 2026-08-30; today is 2026-09-15.
    expect(await channels.sync("fossfriends")).toEqual({ kind: "unreachable", days: 16 });
    expect(await channels.sync("nilesoft")).toEqual({ kind: "synced", at: "2026-09-15" });
    const list = await channels.getChannels();
    expect(list.find((c) => c.id === "nilesoft")?.synced).toBe("2026-09-15");
  });

  it("sync counts at least one day for an outage that started today", async () => {
    const fresh = createMockServices({
      latencyMs: 0,
      today: "2026-08-30",
      storage: createMemoryStorage(),
    });
    expect(await fresh.channels.sync("fossfriends")).toEqual({ kind: "unreachable", days: 1 });
  });

  it("routes reports to Paparats for the official catalog, to the author otherwise", async () => {
    const { channels } = services;
    expect(await channels.report({ appId: "vlc", channelId: "paparats" }, "Crash")).toEqual({
      kind: "paparats",
    });
    expect(await channels.report({ appId: null, channelId: "winaero" }, "Broken")).toEqual({
      kind: "author",
      channelName: "Winaero",
      author: "Sergey Tkachenko",
    });
  });
});
