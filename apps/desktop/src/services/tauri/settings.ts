// No settings commands in bindings.ts yet: settings persist through the mock (WebView2
// localStorage). To switch, replace the bodies with `unwrap(commands.<name>(…))` over
// tauri-plugin-store (see ./result.ts).
import type { SettingsService } from "../contracts";

export function createTauriSettingsService(mock: SettingsService): SettingsService {
  return {
    getSettings: () => mock.getSettings(),
    updateSettings: (patch) => mock.updateSettings(patch),
    clearSearchHistory: () => mock.clearSearchHistory(),
  };
}
