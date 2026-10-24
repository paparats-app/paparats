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
    expect(normaliseAddress("  HTTPS://www.Kvetka.Example/paparats/// ")).toBe(
      "kvetka.example/paparats",
    );
    expect(normaliseAddress("http://mpvbuilds.example")).toBe("mpvbuilds.example");
  });

  it.each([
    ["vitrazh.example/paparats", "vitrazh"],
    ["https://www.Vitrazh.Example/paparats/", "vitrazh"],
    ["vitrazh.example", "vitrazh"],
    ["@vitrazh", "vitrazh"],
    ["VITRAZH", "vitrazh"],
    ["mpvbuilds", "mpvbuilds"],
    ["http://mpvbuilds.example/paparats//", "mpvbuilds"],
    ["bysoft.by", "bysoft"],
  ])("finds %s → %s", (address, id) => {
    expect(findChannelByAddress(services.world.channels, address)?.id).toBe(id);
  });

  it.each(["", "   ", "example.org", "@nobody", "vitrazh.example/other"])(
    "does not match %j",
    (address) => {
      expect(findChannelByAddress(services.world.channels, address)).toBeUndefined();
    },
  );

  it("reports found / alreadySubscribed / notFound", async () => {
    const { channels } = services;
    expect(await channels.lookup("@vitrazh")).toMatchObject({
      kind: "found",
      channel: { id: "vitrazh" },
    });
    expect(await channels.lookup("https://kvetka.example/paparats/")).toMatchObject({
      kind: "alreadySubscribed",
      channel: { id: "kvetka" },
    });
    expect(await channels.lookup("nothing.here")).toEqual({ kind: "notFound" });
  });
});

describe("mock channels", () => {
  it("subscribe appends once; unknown channels reject notFound", async () => {
    const { channels } = services;
    const after = await channels.subscribe("vitrazh");
    expect(after.map((s) => s.channelId)).toEqual([
      "paparats",
      "kvetka",
      "fossfriends",
      "vitrazh",
    ]);
    expect(after.at(-1)).toEqual({ channelId: "vitrazh", paused: false, staleAcknowledged: false });
    expect(await channels.subscribe("vitrazh")).toHaveLength(4);
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
    const paused = await channels.setPaused("kvetka", true);
    expect(paused.find((s) => s.channelId === "kvetka")?.paused).toBe(true);

    const acknowledged = await channels.acknowledgeStale("fossfriends");
    expect(acknowledged.find((s) => s.channelId === "fossfriends")?.staleAcknowledged).toBe(true);

    const left = await channels.unsubscribe("kvetka");
    expect(left.map((s) => s.channelId)).toEqual(["paparats", "fossfriends"]);
    await expect(channels.setPaused("vitrazh", true)).rejects.toMatchObject({ kind: "notFound" });
  });

  it("sync reports an outage in days, otherwise stamps today", async () => {
    const { channels } = services;
    // fossfriends went down on 2026-08-30; today is 2026-09-15.
    expect(await channels.sync("fossfriends")).toEqual({ kind: "unreachable", days: 16 });
    expect(await channels.sync("kvetka")).toEqual({ kind: "synced", at: "2026-09-15" });
    const list = await channels.getChannels();
    expect(list.find((c) => c.id === "kvetka")?.synced).toBe("2026-09-15");
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
    expect(await channels.report({ appId: null, channelId: "vitrazh" }, "Broken")).toEqual({
      kind: "author",
      channelName: "Vitrazh",
      author: "Andrei V.",
    });
  });
});
