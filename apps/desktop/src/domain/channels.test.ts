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
    expect(isActive(subscriptions, "nilesoft")).toBe(true);
    expect(isActive(subscriptions, "winaero")).toBe(false);
    expect(isActive([sub("nilesoft", { paused: true })], "nilesoft")).toBe(false);
    expect(isFollowed([sub("nilesoft", { paused: true })], "nilesoft")).toBe(true);
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
    expect(candidates(appById("winaerotweaker"))).toEqual(["winaero", "paparats"]);
  });

  it("installs Nilesoft Shell from the Nilesoft channel", () => {
    expect(sourceOf(appById("shell"), channelCtx())).toBe("nilesoft");
  });

  it("installs Czkawka via FOSS Friends", () => {
    expect(sourceOf(appById("czkawka"), channelCtx())).toBe("fossfriends");
  });

  it("picks the most trusted active channel and lists the others as alternatives", () => {
    const tweaker = appById("winaerotweaker");
    const followingWinaero = channelCtx([...subscriptions, sub("winaero")]);
    expect(sourceOf(tweaker, followingWinaero)).toBe("paparats");
    expect(alternativesOf(tweaker, followingWinaero)).toEqual(["winaero"]);
    expect(sourceOf(tweaker, channelCtx())).toBe("paparats");
    expect(alternativesOf(tweaker, channelCtx())).toEqual([]);
  });

  it("falls back to the home channel when no candidate is active", () => {
    expect(sourceOf(appById("mpv"), channelCtx())).toBe("mpvbuilds");
    const pausedNilesoft = channelCtx([sub("paparats"), sub("nilesoft", { paused: true })]);
    expect(sourceOf(appById("shell"), pausedNilesoft)).toBe("nilesoft");
    expect(alternativesOf(appById("shell"), pausedNilesoft)).toEqual([]);
  });
});

describe("outages", () => {
  const foss = channelById("fossfriends");

  it("counts the days a channel has been down (FOSS Friends: 16 days on 2026-09-15)", () => {
    expect(downDays(foss, TODAY)).toBe(16);
    expect(downDays(channelById("nilesoft"), TODAY)).toBe(0);
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
    expect(ids).toContain("winaerotweaker");
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
    expect(channelApps(catalog.apps, "winaero").map((a) => a.id)).toEqual(["winaerotweaker"]);
  });
});

describe("channel lookup", () => {
  it("normalises addresses", () => {
    expect(normaliseAddress("  HTTPS://www.Nilesoft.org/paparats//  ")).toBe(
      "nilesoft.org/paparats",
    );
    expect(normaliseAddress("http://mpv.io/paparats")).toBe("mpv.io/paparats");
  });

  it("matches the address, host, @handle or handle", () => {
    expect(findChannelByAddress(channels, "https://nilesoft.org/paparats/")?.id).toBe("nilesoft");
    expect(findChannelByAddress(channels, "winaero.com")?.id).toBe("winaero");
    expect(findChannelByAddress(channels, "@MPV")?.id).toBe("mpvbuilds");
    expect(findChannelByAddress(channels, "fossfriends")?.id).toBe("fossfriends");
    expect(findChannelByAddress(channels, "example.com")).toBeUndefined();
    expect(findChannelByAddress(channels, "   ")).toBeUndefined();
  });

  it("reports found / already subscribed / not found", () => {
    expect(lookupChannel(channels, subscriptions, "@winaero")).toMatchObject({
      kind: "found",
      channel: { id: "winaero" },
    });
    expect(lookupChannel(channels, subscriptions, "nilesoft.org")).toMatchObject({
      kind: "alreadySubscribed",
      channel: { id: "nilesoft" },
    });
    expect(lookupChannel(channels, subscriptions, "nope")).toEqual({ kind: "notFound" });
  });
});
