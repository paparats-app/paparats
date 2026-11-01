import type { CatalogService } from "../contracts";
import type { MockContext } from "./runtime";
import type { MockWorld } from "./world";

export function createMockCatalogService(world: MockWorld, ctx: MockContext): CatalogService {
  return {
    getCatalog: () => ctx.respond(() => world.catalog),
    getPlatform: () => ctx.respond(() => world.platform),
    onChanged: () => () => undefined,
  };
}
