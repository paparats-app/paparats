import { commands, events } from "@/bindings";
import type { CatalogService } from "../contracts";
import { unwrap } from "./result";

export function createTauriCatalogService(): CatalogService {
  return {
    getCatalog: () => unwrap(commands.catalogGetCatalog()),
    getPlatform: () => unwrap(commands.catalogGetPlatform()),
    onChanged(listener) {
      let active = true;
      const registration = events.catalogChanged.listen(() => {
        if (active) listener();
      });
      registration.catch((e: unknown) =>
        console.error("Paparats: cannot listen to catalog changes", e),
      );
      return () => {
        active = false;
        registration.then(
          (unlisten) => unlisten(),
          () => undefined,
        );
      };
    },
  };
}
