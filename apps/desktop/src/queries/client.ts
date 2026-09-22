import { QueryClient } from "@tanstack/react-query";

export interface QueryClientOptions {
  /** How long fetched data stays fresh. Mutations write their results into the cache, so ∞. */
  staleTime?: number;
  /** Retries of a failed query: 1 in the app, none in tests (errors surface immediately). */
  retry?: boolean | number;
}

export function createQueryClient({
  staleTime = Infinity,
  retry = import.meta.env.MODE === "test" ? false : 1,
}: QueryClientOptions = {}): QueryClient {
  return new QueryClient({
    defaultOptions: {
      queries: { staleTime, retry, refetchOnWindowFocus: false },
      mutations: { retry: false },
    },
  });
}
