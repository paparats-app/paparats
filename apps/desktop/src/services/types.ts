// Domain types. The Rust core (`crates/paparats-core`) is the single source of truth; this module
// re-exports the generated bindings so screens never import `@/bindings` directly.
export type {
  AboutInfo,
  Account,
  Activity,
  ActivityKind,
  App,
  BrowseHero,
  Catalog,
  Category,
  CategoryId,
  ChannelInfo,
  ChannelKind,
  ChannelLookup,
  ChannelSubscription,
  Collection,
  Device,
  DownloadItem,
  DownloadKind,
  DownloadPhase,
  DownloadProgress,
  DownloadRequest,
  DownloadSnapshot,
  DownloadState,
  DownloadStateChange,
  FileHost,
  HeroSlide,
  HeroTarget,
  Idea,
  IdeaActor,
  IdeaComment,
  IdeaDraft,
  IdeaKind,
  IdeaStatus,
  InstalledApp,
  Library,
  LibraryCollection,
  Locale,
  Localized,
  Plan,
  PlanBadge,
  PlanId,
  PlanPeriod,
  PlatformInfo,
  PlatformStats,
  Profile,
  ProfilePatch,
  ReportReceipt,
  ReportTarget,
  Review,
  SelfUpdateCheck,
  Settings,
  Subscription,
  SyncOutcome,
  Text,
  ThemePreference,
  TrustLevel,
  UpdateManifest,
  UpdateSchedule,
  UsageStats,
} from "@/bindings";

/** `YYYY-MM-DD`. */
export type IsoDate = string;
export type AppId = string;
export type ChannelId = string;

/** Id of the official Paparats catalog channel (mirrors `paparats_core::OFFICIAL_CHANNEL`). */
export const OFFICIAL_CHANNEL: ChannelId = "paparats";

/** Minimum idea title length (mirrors `paparats_core::IDEA_TITLE_MIN_CHARS`). */
export const IDEA_TITLE_MIN_CHARS = 6;
