import { commands } from "@/bindings";
import type { InstallService } from "../contracts";
import { unwrap, unwrapVoid } from "./result";

export function createTauriInstallService(): InstallService {
  return {
    getLibrary: () => unwrap(commands.installGetLibrary()),
    setFavorite: (appId, favorite) => unwrap(commands.installSetFavorite(appId, favorite)),
    uninstall: (appId) => unwrap(commands.installUninstall(appId)),
    open: (appId) => unwrapVoid(commands.installOpen(appId)),
    openInstallFolder: (appId) => unwrapVoid(commands.installOpenFolder(appId)),
  };
}
