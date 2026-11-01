// Service contracts — the only way screens and stores reach data and the Rust core.
//
// Two implementations exist for every service:
//   - `services/mock/*`  in-memory, seeded from `fixtures/*.json`, with the prototype's timings.
//                        Used in a plain browser, in Vitest, and with `PAPARATS_MOCK=1`.
//   - `services/tauri/*` thin adapters over the tauri-specta `commands` / `events` in
//                        `bindings.ts`. Errors come back as `ServiceError`.
// `createServices()` (services/registry.ts) picks one set at startup.
//
// Conventions:
//   - Every method is async and rejects with `ServiceError` (never a raw string).
//   - Mutations return the new authoritative state of what they changed, so TanStack Query can
//     write it into the cache without a refetch.
//   - Dates are `YYYY-MM-DD` strings; "today" comes from `SystemService.today()` (the mock world
//     is anchored at 2026-09-15, see fixtures/meta.json).

import type {
  Account,
  Catalog,
  ChannelInfo,
  ChannelLookup,
  ChannelSubscription,
  DownloadProgress,
  DownloadRequest,
  DownloadSnapshot,
  DownloadStateChange,
  Idea,
  IdeaActor,
  IdeaDraft,
  IsoDate,
  Library,
  PlanId,
  PlatformInfo,
  ProfilePatch,
  ReportReceipt,
  ReportTarget,
  SelfUpdateCheck,
  Settings,
  SyncOutcome,
} from "./types";

/** Unsubscribe function returned by every `subscribe`/`on*` method. */
export type Unsubscribe = () => void;

// ---------------------------------------------------------------------------------------------
// Catalog
// ---------------------------------------------------------------------------------------------

export interface CatalogService {
  /**
   * The full catalog: apps of every known channel (the UI hides apps whose channels are not
   * followed/enabled — see `domain/channels.ts`), categories, editorial content, update
   * manifests and the review pool.
   */
  getCatalog(): Promise<Catalog>;
  /** Plans, ecosystem numbers and the client build shown in Settings › About. */
  getPlatform(): Promise<PlatformInfo>;
  /**
   * A background refresh brought a newer catalog (the "Check for updates" schedule): reload
   * what depends on it. Never fires in the mock world.
   */
  onChanged(listener: () => void): Unsubscribe;
}

// ---------------------------------------------------------------------------------------------
// Install / library (inventory of this PC + the user's favorites and collections)
// ---------------------------------------------------------------------------------------------

export interface InstallService {
  getLibrary(): Promise<Library>;
  setFavorite(appId: string, favorite: boolean): Promise<Library>;
  /** Removes the app from this PC (and from the inventory). */
  uninstall(appId: string): Promise<Library>;
  /** Launches an installed app. */
  open(appId: string): Promise<void>;
  openInstallFolder(appId: string): Promise<void>;
}

// ---------------------------------------------------------------------------------------------
// Downloads (queue + installer; completion updates the library inventory)
// ---------------------------------------------------------------------------------------------

export type DownloadEvent =
  { type: "progress"; payload: DownloadProgress } | { type: "state"; payload: DownloadStateChange };

export interface DownloadService {
  getSnapshot(): Promise<DownloadSnapshot>;
  /**
   * Progress (≥ 10 Hz while downloading) and lifecycle events. When an item reaches
   * `installed`, the library inventory has already been updated — callers invalidate the
   * library query.
   */
  subscribe(listener: (event: DownloadEvent) => void): Unsubscribe;
  /** Adds requests to the queue (ids already queued/running are ignored). */
  enqueue(requests: DownloadRequest[]): Promise<void>;
  pause(appId: string): Promise<void>;
  resume(appId: string): Promise<void>;
  cancel(appId: string): Promise<void>;
  pauseAll(): Promise<void>;
  resumeAll(): Promise<void>;
  cancelAll(): Promise<void>;
  /** "Parallel downloads" (1, 2 or 4). Takes effect immediately. */
  setConcurrency(limit: number): Promise<void>;
  /** Offline pauses running downloads; back online resumes them and starts queued ones. */
  setOnline(online: boolean): Promise<void>;
}

// ---------------------------------------------------------------------------------------------
// Channels (Settings › Sources, channel page)
// ---------------------------------------------------------------------------------------------

export interface ChannelService {
  /** Every channel known to the client (followed or not). */
  getChannels(): Promise<ChannelInfo[]>;
  /** Followed channels, in the order they were added (the official catalog first). */
  getSubscriptions(): Promise<ChannelSubscription[]>;
  /**
   * Looks a channel up by address (`https://…`, `www.` and trailing `/` ignored), host or
   * `@handle` / `handle`, case-insensitively.
   */
  lookup(address: string): Promise<ChannelLookup>;
  /** Follows a channel. Community channels must be confirmed by the UI before calling this. */
  subscribe(channelId: string): Promise<ChannelSubscription[]>;
  /** Unfollows a channel. The official catalog cannot be removed (rejects `invalid`). */
  unsubscribe(channelId: string): Promise<ChannelSubscription[]>;
  /** Switches a followed channel off/on. The official catalog cannot be paused. */
  setPaused(channelId: string, paused: boolean): Promise<ChannelSubscription[]>;
  /** "Keep" on the stale callout. */
  acknowledgeStale(channelId: string): Promise<ChannelSubscription[]>;
  sync(channelId: string): Promise<SyncOutcome>;
  /** Sends a problem report to the channel author (copy to Paparats) or to Paparats only. */
  report(target: ReportTarget, text: string): Promise<ReportReceipt>;
}

// ---------------------------------------------------------------------------------------------
// Ideas board
// ---------------------------------------------------------------------------------------------

export interface IdeasService {
  getIdeas(): Promise<Idea[]>;
  /** Toggles the signed-in user's vote. */
  vote(ideaId: string): Promise<Idea>;
  /**
   * Publishes an idea as the signed-in user (`mine`, status open, 1 vote, voted). Rejects
   * `invalid` when the trimmed title is shorter than `IDEA_TITLE_MIN_CHARS`.
   */
  propose(draft: IdeaDraft): Promise<Idea>;
  comment(ideaId: string, text: string, actor: IdeaActor): Promise<Idea>;
  /** Developer view: pins an open idea to a channel (status → work). */
  take(ideaId: string, channelId: string): Promise<Idea>;
  /** Developer view: marks an idea released in `appId` at `version`. */
  release(ideaId: string, appId: string, version: string): Promise<Idea>;
  /** The author dismissed the "Your idea became an app" note. */
  dismissReleaseNote(ideaId: string): Promise<Idea>;
}

// ---------------------------------------------------------------------------------------------
// Account & subscription
// ---------------------------------------------------------------------------------------------

export interface AccountService {
  getAccount(): Promise<Account>;
  updateProfile(patch: ProfilePatch): Promise<Account>;
  removeDevice(deviceId: string): Promise<Account>;
  setTwoFactor(enabled: boolean): Promise<Account>;
  /** Buys (or switches to) a paid plan; sets `renewsOn`. */
  purchase(plan: Exclude<PlanId, "free">): Promise<Account>;
  /** Back to the free plan. */
  cancelPlan(): Promise<Account>;
  /** Activates the 3-month Pro thank-you for a released idea (`giftUntil`). */
  claimIdeaBonus(): Promise<Account>;
  signIn(email: string, password: string): Promise<Account>;
  signOut(): Promise<Account>;
}

// ---------------------------------------------------------------------------------------------
// Settings (persisted locally: tauri-plugin-store / localStorage in the mock)
// ---------------------------------------------------------------------------------------------

export interface SettingsService {
  /** Stored settings merged over the defaults (`domain/settings.ts` › `DEFAULT_SETTINGS`). */
  getSettings(): Promise<Settings>;
  updateSettings(patch: Partial<Settings>): Promise<Settings>;
  clearSearchHistory(): Promise<void>;
}

// ---------------------------------------------------------------------------------------------
// System (platform integration that is not a domain of its own)
// ---------------------------------------------------------------------------------------------

export interface SystemService {
  /** Today's date. The mock world is anchored at fixtures/meta.json › today. */
  today(): IsoDate;
  /** Real network connectivity (the "Simulate offline" developer tool is layered on top in the UI). */
  isOnline(): boolean;
  onConnectivityChange(listener: (online: boolean) => void): Unsubscribe;
  /** Settings › About › Check for updates (the Paparats client itself). */
  checkForAppUpdate(): Promise<SelfUpdateCheck>;
  /**
   * Downloads and installs the newer client version the last check found. On Windows the
   * installer takes over: the app exits and starts again on the new version. Resolves without
   * doing anything when there is no update.
   */
  installAppUpdate(): Promise<void>;
  /** Opens an https URL in the default browser (links in About, support addresses). */
  openExternal(url: string): Promise<void>;
  copyToClipboard(text: string): Promise<void>;
  /** Start on Windows login. */
  setAutostart(enabled: boolean): Promise<void>;
}

export interface Services {
  catalog: CatalogService;
  install: InstallService;
  downloads: DownloadService;
  channels: ChannelService;
  ideas: IdeasService;
  account: AccountService;
  settings: SettingsService;
  system: SystemService;
}
