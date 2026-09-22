import type { InstallService } from "../contracts";
import type { MockContext } from "./runtime";
import type { MockWorld } from "./world";

export function createMockInstallService(world: MockWorld, ctx: MockContext): InstallService {
  const library = world.library;
  return {
    getLibrary: () => ctx.respond(() => library),

    setFavorite: (appId, favorite) =>
      ctx.respond(() => {
        const has = library.favorites.includes(appId);
        if (favorite && !has) library.favorites.push(appId);
        if (!favorite && has) library.favorites = library.favorites.filter((id) => id !== appId);
        return library;
      }),

    // Favorites survive an uninstall (the prototype only hides the app from the inventory).
    uninstall: (appId) =>
      ctx.respond(() => {
        library.installed = library.installed.filter((app) => app.appId !== appId);
        return library;
      }),

    open: () => ctx.respond(() => undefined),
    openInstallFolder: () => ctx.respond(() => undefined),
  };
}
