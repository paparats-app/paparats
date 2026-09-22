// Services over the Rust core (tauri-specta `commands` / events in bindings.ts).
//
// Only `app_info` exists on the Rust side today, so every service delegates to an in-memory mock
// instance except `system` (real date, opener, connectivity). Each service has its own file: switch
// a method to `unwrap(commands.<name>(…))` (./result.ts) as its command lands, and drop the note in
// docs/decisions.md when the last delegate is gone.
import type { Services } from "../contracts";
import { createMockServices } from "../mock";
import type { MockServiceOptions } from "../mock";
import { createTauriAccountService } from "./account";
import { createTauriCatalogService } from "./catalog";
import { createTauriChannelService } from "./channels";
import { createTauriDownloadService } from "./downloads";
import { createTauriIdeasService } from "./ideas";
import { createTauriInstallService } from "./install";
import { createTauriSettingsService } from "./settings";
import { createTauriSystemService, localToday } from "./system";

export function createTauriServices(options: MockServiceOptions = {}): Services {
  // The delegates stamp dates (installs, ideas, renewals) with the same real "today".
  const mock = createMockServices({ today: localToday(), ...options });
  return {
    catalog: createTauriCatalogService(mock.catalog),
    install: createTauriInstallService(mock.install),
    downloads: createTauriDownloadService(mock.downloads),
    channels: createTauriChannelService(mock.channels),
    ideas: createTauriIdeasService(mock.ideas),
    account: createTauriAccountService(mock.account),
    settings: createTauriSettingsService(mock.settings),
    system: createTauriSystemService(mock.system),
  };
}

export { localToday } from "./system";
export { unwrap, toServiceError } from "./result";
export type { CommandResult } from "./result";
