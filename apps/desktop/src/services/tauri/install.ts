// No install/inventory commands in bindings.ts yet: every method delegates to the mock. To switch
// one, replace its body with `unwrap(commands.<name>(…))` (see ./result.ts).
import type { InstallService } from "../contracts";

export function createTauriInstallService(mock: InstallService): InstallService {
  return {
    getLibrary: () => mock.getLibrary(),
    setFavorite: (appId, favorite) => mock.setFavorite(appId, favorite),
    uninstall: (appId) => mock.uninstall(appId),
    open: (appId) => mock.open(appId),
    openInstallFolder: (appId) => mock.openInstallFolder(appId),
  };
}
