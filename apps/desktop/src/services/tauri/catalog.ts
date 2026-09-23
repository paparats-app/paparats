import { commands } from "@/bindings";
import type { CatalogService } from "../contracts";
import { unwrap } from "./result";

export function createTauriCatalogService(): CatalogService {
  return {
    getCatalog: () => unwrap(commands.catalogGetCatalog()),
    getPlatform: () => unwrap(commands.catalogGetPlatform()),
  };
}
