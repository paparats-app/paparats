import { shouldUseMockServices } from "@/platform/runtime";
import { usePlatform } from "@/queries";
import type { Features } from "@/services/types";

/** Every storefront surface on: the demo world, whose platform file names no features. */
export const ALL_FEATURES: Features = {
  pro: true,
  account: true,
  ideas: true,
  channels: true,
  reviews: true,
};

/** Nothing that needs a server: shown while the real platform file loads, so nothing flashes. */
export const NO_FEATURES: Features = {
  pro: false,
  account: false,
  ideas: false,
  channels: false,
  reviews: false,
};

/**
 * Which storefront surfaces the catalog turns on (`platform.json › features`). The real catalog
 * turns off Pro, accounts, Ideas, channels and reviews: Paparats runs no server for them yet, so
 * the client shows no made-up numbers and no buttons that cannot work (D68).
 */
export function useFeatures(): Features {
  const platform = usePlatform();
  if (platform.data) return platform.data.features ?? ALL_FEATURES;
  // The mock world (a browser, tests) is the demo: everything on from the first frame.
  return platform.isError || MOCK ? ALL_FEATURES : NO_FEATURES;
}

const MOCK = shouldUseMockServices();
