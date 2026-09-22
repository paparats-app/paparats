// In-memory services seeded from fixtures/*.json with the prototype's behaviour and timings.
// Used in a plain browser, in Vitest and with `PAPARATS_MOCK=1`.
import type { Services } from "../contracts";
import { createMockAccountService } from "./account";
import { createMockCatalogService } from "./catalog";
import { createMockChannelService } from "./channels";
import { createMockDownloadService } from "./downloads";
import { createMockIdeasService } from "./ideas";
import { createMockInstallService } from "./install";
import { createMockContext } from "./runtime";
import type { MockServiceOptions } from "./runtime";
import { createMockSettingsService, readStoredSettings } from "./settings";
import { createMockSystemService } from "./system";
import { createMockWorld } from "./world";
import type { MockWorld } from "./world";

export interface MockServices extends Services {
  /** The shared in-memory state (tests may inspect it). */
  readonly world: MockWorld;
  /** Stops the download timers. */
  dispose(): void;
}

/** One isolated mock world and the eight services over it. */
export function createMockServices(options: MockServiceOptions = {}): MockServices {
  const ctx = createMockContext(options);
  const world = createMockWorld();
  // The queue starts with the persisted "Parallel downloads"; the UI keeps it in sync after that.
  const downloads = createMockDownloadService(world, ctx, readStoredSettings(ctx.storage).parallel);
  return {
    world,
    catalog: createMockCatalogService(world, ctx),
    install: createMockInstallService(world, ctx),
    downloads,
    channels: createMockChannelService(world, ctx),
    ideas: createMockIdeasService(world, ctx),
    account: createMockAccountService(world, ctx),
    settings: createMockSettingsService(ctx),
    system: createMockSystemService(ctx),
    dispose: () => downloads.dispose(),
  };
}

export type { MockServiceOptions } from "./runtime";
export { createMemoryStorage } from "./runtime";
export type { MockWorld, FixtureMeta } from "./world";
export { FIXTURE_TODAY } from "./world";
export { INSTALL_HOLD_TICKS } from "./downloads";
export { SETTINGS_STORAGE_KEY } from "./settings";
export { SELF_UPDATE_CHECK_MS } from "./system";
