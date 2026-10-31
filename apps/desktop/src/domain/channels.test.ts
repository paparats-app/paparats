import {
  alternativesOf,
  candidates,
  channelApps,
  downDays,
  findChannelByAddress,
  isActive,
  isFollowed,
  isStale,
  lookupChannel,
  normaliseAddress,
  sourceOf,
  TRUST_RANK,
  visibleApps,
} from "./channels";
import {
  appById,
  catalog,
  channelById,
  channelCtx,
  channels,
  sub,
  subscriptions,
  TODAY,
} from "./testFixtures";

const none = new Set<string>();

describe("isActive / isFollowed", () => {
  it("is active while followed and switched on", () => {
    expect(isActive(subscriptions, "kvetka")).toBe(true);
    expect(isActive(subscriptions, "vitrazh")).toBe(false);
    expect(isActive([sub("kvetka", { paused: true })], "kvetka")).toBe(false);
    expect(isFollowed([sub("kvetka", { paused: true })], "kvetka")).toBe(true);
  });

  it("keeps the official catalog active while followed, even if flagged paused", () => {
    expect(isActive([sub("paparats", { paused: true })], "paparats")).toBe(true);
    expect(isActive([], "paparats")).toBe(false);
  });
});

describe("source rule", () => {
  it("orders trust official › verified › community", () => {
    expect(TRUST_RANK.official).toBeLessThan(TRUST_RANK.verified);
    expect(TRUST_RANK.verified).toBeLessThan(TRUST_RANK.community);
  });

  it("lists the home channel first, then alsoIn", () => {
    expect(candidates(appById("obsidian"))).toEqual(["paparats"]);
    expect(candidates(appById("vitrazhtweaker"))).toEqual(["vitrazh", "paparats"]);
  });

  it("installs Kvetka Shell from the Kvetka channel", () => {
    expect(sourceOf(appById("shell"), channelCtx())).toBe("kvetka");
  });

  it("installs Czkawka via FOSS Friends", () => {
    expect(sourceOf(appById("czkawka"), channelCtx())).toBe("fossfriends");
  });

  it("picks the most trusted active channel and lists the others as alternatives", () => {
    const tweaker = appById("vitrazhtweaker");
    const followingVitrazh = channelCtx([...subscriptions, sub("vitrazh")]);
    expect(sourceOf(tweaker, followingVitrazh)).toBe("paparats");
    expect(alternativesOf(tweaker, followingVitrazh)).toEqual(["vitrazh"]);
    expect(sourceOf(tweaker, channelCtx())).toBe("paparats");
    expect(alternativesOf(tweaker, channelCtx())).toEqual([]);
  });

  it("falls back to the home channel when no candidate is active", () => {
    expect(sourceOf(appById("mpv"), channelCtx())).toBe("mpvbuilds");
    const pausedKvetka = channelCtx([sub("paparats"), sub("kvetka", { paused: true })]);
    expect(sourceOf(appById("shell"), pausedKvetka)).toBe("kvetka");
    expect(alternativesOf(appById("shell"), pausedKvetka)).toEqual([]);
  });
});

describe("outages", () => {
  const foss = channelById("fossfriends");

  it("counts the days a channel has been down (FOSS Friends: 16 days on 2026-09-15)", () => {
    expect(downDays(foss, TODAY)).toBe(16);
    expect(downDays(channelById("kvetka"), TODAY)).toBe(0);
    expect(downDays(undefined, TODAY)).toBe(0);
    expect(downDays({ ...foss, outage: TODAY }, TODAY)).toBe(1);
  });

  it("is stale after 14 days unless the user kept the channel", () => {
    expect(isStale(foss, sub("fossfriends"), TODAY)).toBe(true);
    expect(isStale(foss, sub("fossfriends", { staleAcknowledged: true }), TODAY)).toBe(false);
    expect(isStale(foss, sub("fossfriends"), "2026-09-12")).toBe(false);
    expect(isStale(foss, sub("fossfriends"), "2026-09-13")).toBe(true);
    expect(isStale(foss, undefined, TODAY)).toBe(false);
  });
});

describe("visibleApps", () => {
  it("shows apps of active channels and hides the rest", () => {
    const ids = visibleApps(catalog.apps, channelCtx(), none).map((a) => a.id);
    expect(ids).toContain("shell");
    expect(ids).toContain("czkawka");
    expect(ids).toContain("vitrazhtweaker");
    expect(ids).not.toContain("mpv");
    expect(ids).not.toContain("slounik");
  });

  it("keeps installed apps visible and hides a paused channel's apps", () => {
    const pausedFoss = channelCtx([sub("paparats"), sub("fossfriends", { paused: true })]);
    const ids = visibleApps(catalog.apps, pausedFoss, new Set(["czkawka"])).map((a) => a.id);
    expect(ids).toContain("czkawka");
    expect(ids).not.toContain("rufus");
    expect(ids).not.toContain("shell");
  });

  it("lists every app a channel offers", () => {
    expect(channelApps(catalog.apps, "fossfriends").map((a) => a.id)).toEqual([
      "czkawka",
      "imageglass",
      "rufus",
    ]);
    expect(channelApps(catalog.apps, "vitrazh").map((a) => a.id)).toEqual(["vitrazhtweaker"]);
  });
});

describe("channel lookup", () => {
  it("normalises addresses", () => {
    expect(normaliseAddress("  HTTPS://www.Kvetka.Example/paparats//  ")).toBe(
      "kvetka.example/paparats",
    );
    expect(normaliseAddress("http://mpvbuilds.example/paparats")).toBe(
      "mpvbuilds.example/paparats",
    );
  });

  it("matches the address, host, @handle or handle", () => {
    expect(findChannelByAddress(channels, "https://kvetka.example/paparats/")?.id).toBe("kvetka");
    expect(findChannelByAddress(channels, "vitrazh.example")?.id).toBe("vitrazh");
    expect(findChannelByAddress(channels, "@MPVBUILDS")?.id).toBe("mpvbuilds");
    expect(findChannelByAddress(channels, "fossfriends")?.id).toBe("fossfriends");
    expect(findChannelByAddress(channels, "example.com")).toBeUndefined();
    expect(findChannelByAddress(channels, "   ")).toBeUndefined();
  });

  it("reports found / already subscribed / not found", () => {
    expect(lookupChannel(channels, subscriptions, "@vitrazh")).toMatchObject({
      kind: "found",
      channel: { id: "vitrazh" },
    });
    expect(lookupChannel(channels, subscriptions, "kvetka.example")).toMatchObject({
      kind: "alreadySubscribed",
      channel: { id: "kvetka" },
    });
    expect(lookupChannel(channels, subscriptions, "nope")).toEqual({ kind: "notFound" });
  });
});
