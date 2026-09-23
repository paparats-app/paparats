// Services over the Rust core: tauri-specta `commands` / `events` from bindings.ts (one command per
// contract method, docs/decisions.md D18), settings through tauri-plugin-store, and the WebView's
// own connectivity and clipboard. Errors reach callers as `ServiceError` (./result.ts).
import type { Services } from "../contracts";
import type { MockServiceOptions } from "../mock";
import { createTauriAccountService } from "./account";
import { createTauriCatalogService } from "./catalog";
import { createTauriChannelService } from "./channels";
import { createTauriDownloadService } from "./downloads";
import { createTauriIdeasService } from "./ideas";
import { createTauriInstallService } from "./install";
import { createTauriSettingsService } from "./settings";
import { createTauriSystemService } from "./system";

/**
 * The Rust-backed service set. `_options` exists only so `createServices(mode, options)` can pass
 * the same argument to either set: the core owns its timings, dates and storage.
 */
export function createTauriServices(_options?: MockServiceOptions): Services {
  return {
    catalog: createTauriCatalogService(),
    install: createTauriInstallService(),
    downloads: createTauriDownloadService(),
    channels: createTauriChannelService(),
    ideas: createTauriIdeasService(),
    account: createTauriAccountService(),
    settings: createTauriSettingsService(),
    system: createTauriSystemService(),
  };
}

export { localToday } from "./system";
export { SETTINGS_STORE_FILE } from "./settings";
export { unwrap, unwrapVoid, toServiceError } from "./result";
export type { CommandResult } from "./result";
