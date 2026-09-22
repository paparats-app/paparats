// The mock world: one in-memory copy of `fixtures/*.json` shared by every mock service of a
// `createMockServices()` set, so services that interact see each other's changes (a finished
// download lands in the library inventory and in the account's activity and usage).
import accountJson from "@fixtures/account.json";
import catalogJson from "@fixtures/catalog.json";
import channelsJson from "@fixtures/channels.json";
import ideasJson from "@fixtures/ideas.json";
import libraryJson from "@fixtures/library.json";
import metaJson from "@fixtures/meta.json";
import platformJson from "@fixtures/platform.json";
import type {
  Account,
  Catalog,
  ChannelId,
  ChannelInfo,
  ChannelSubscription,
  Idea,
  IsoDate,
  Library,
  PlatformInfo,
} from "../types";

/** `fixtures/meta.json`: the anchors of the mock world. */
export interface FixtureMeta {
  /** Mock "today" (2026-09-15). */
  today: IsoDate;
  /** Channel the developer view acts as (nilesoft). */
  developerChannel: ChannelId;
  /** End of the 3-month Pro thank-you for a released idea. */
  ideaBonusUntil: IsoDate;
}

export interface MockWorld {
  meta: FixtureMeta;
  catalog: Catalog;
  platform: PlatformInfo;
  library: Library;
  channels: ChannelInfo[];
  subscriptions: ChannelSubscription[];
  ideas: Idea[];
  account: Account;
}

// The JSON modules are typed structurally by TypeScript (string literals widen to `string`);
// `paparats-core/tests/fixtures.rs` keeps the files in sync with the domain model.
const seed = {
  meta: metaJson as FixtureMeta,
  catalog: catalogJson as Catalog,
  platform: platformJson as PlatformInfo,
  library: libraryJson as Library,
  channels: channelsJson.channels as ChannelInfo[],
  subscriptions: channelsJson.subscriptions as ChannelSubscription[],
  ideas: ideasJson.ideas as Idea[],
  account: accountJson as Account,
};

/** Fixture `today` (2026-09-15). */
export const FIXTURE_TODAY: IsoDate = seed.meta.today;

/** A fresh deep copy of the fixtures, so every world (and every test) is isolated. */
export function createMockWorld(): MockWorld {
  return structuredClone(seed);
}
