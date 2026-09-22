// No catalog commands in bindings.ts yet: every method delegates to the mock. To switch one,
// replace its body with `unwrap(commands.<name>())` (see ./result.ts).
import type { CatalogService } from "../contracts";

export function createTauriCatalogService(mock: CatalogService): CatalogService {
  return {
    getCatalog: () => mock.getCatalog(),
    getPlatform: () => mock.getPlatform(),
  };
}
