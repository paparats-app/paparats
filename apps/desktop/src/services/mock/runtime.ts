// Shared plumbing of the mock services: options, simulated latency, lookups.
import { ServiceError } from "../errors";
import type { IsoDate } from "../types";
import { FIXTURE_TODAY } from "./world";

export interface MockServiceOptions {
  /** Simulated round-trip of every call, in ms (40; use 0 in tests). */
  latencyMs?: number;
  /** Download tick, in ms (the prototype's 110). */
  tickMs?: number;
  /** Source of the per-tick download increment (`3 + random·7` %). */
  random?: () => number;
  /** Mock "today" (fixtures/meta.json › today). */
  today?: IsoDate;
  /** Where settings persist (`localStorage` when available, else in memory). */
  storage?: Storage;
}

export interface MockContext {
  latencyMs: number;
  tickMs: number;
  random: () => number;
  today: IsoDate;
  storage: Storage | null;
  /**
   * Runs `fn` after the simulated latency and resolves with a deep copy of its result (callers
   * never share objects with the world). A throw inside `fn` becomes the rejection.
   */
  respond<T>(fn: () => T): Promise<T>;
}

export const DEFAULT_LATENCY_MS = 40;
export const DEFAULT_TICK_MS = 110;

export function createMockContext(options: MockServiceOptions = {}): MockContext {
  const latencyMs = options.latencyMs ?? DEFAULT_LATENCY_MS;
  return {
    latencyMs,
    tickMs: options.tickMs ?? DEFAULT_TICK_MS,
    random: options.random ?? Math.random,
    today: options.today ?? FIXTURE_TODAY,
    storage: options.storage ?? defaultStorage(),
    async respond<T>(fn: () => T): Promise<T> {
      if (latencyMs > 0) await delay(latencyMs);
      return clone(fn());
    },
  };
}

export function delay(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

export function clone<T>(value: T): T {
  return structuredClone(value);
}

function defaultStorage(): Storage | null {
  try {
    return typeof localStorage === "undefined" ? null : localStorage;
  } catch {
    // Access can throw when storage is disabled.
    return null;
  }
}

/** A `Storage` kept in memory: isolated settings for tests and previews. */
export function createMemoryStorage(): Storage {
  const data = new Map<string, string>();
  return {
    get length() {
      return data.size;
    },
    clear: () => data.clear(),
    getItem: (key: string) => data.get(key) ?? null,
    key: (index: number) => [...data.keys()][index] ?? null,
    removeItem: (key: string) => void data.delete(key),
    setItem: (key: string, value: string) => void data.set(key, String(value)),
  };
}

/** Finds an item or rejects the call with `notFound`. */
export function mustFind<T>(items: readonly T[], match: (item: T) => boolean, what: string): T {
  const item = items.find(match);
  if (item === undefined) throw new ServiceError("notFound", `${what} not found`);
  return item;
}

/** The trimmed text, or rejects the call with `invalid` when it is empty. */
export function requireText(value: string, what: string): string {
  const text = value.trim();
  if (!text) throw new ServiceError("invalid", `${what} is empty`);
  return text;
}
