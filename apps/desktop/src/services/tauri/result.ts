import type { AppError } from "@/bindings";
import { ServiceError } from "../errors";

/** What every tauri-specta command resolves with (`commands.*` in bindings.ts). */
export type CommandResult<T> = { status: "ok"; data: T } | { status: "error"; error: AppError };

const APP_ERROR_KINDS: ReadonlySet<string> = new Set<AppError["kind"]>([
  "notFound",
  "invalid",
  "internal",
]);

/** The Rust `AppError` wire shape (`{ kind, message }`). */
function isAppError(value: unknown): value is AppError {
  if (typeof value !== "object" || value === null) return false;
  const { kind, message } = value as Record<string, unknown>;
  return typeof kind === "string" && APP_ERROR_KINDS.has(kind) && typeof message === "string";
}

/**
 * Unwraps a command result: `{status:'error'}` becomes `ServiceError.from(error)`. Everything
 * else that fails — the invoke itself, or a rejection that is not an `AppError` (Tauri answers
 * arguments that do not deserialize, unknown commands and denied permissions with a plain
 * string) — becomes an `internal` error.
 */
export async function unwrap<T>(result: Promise<CommandResult<T>>): Promise<T> {
  let settled: CommandResult<T>;
  try {
    settled = await result;
  } catch (e) {
    throw toServiceError(e);
  }
  if (settled.status === "error") throw toServiceError(settled.error);
  return settled.data;
}

/** Unwraps a command that answers `null` (actions): resolves with nothing. */
export async function unwrapVoid(result: Promise<CommandResult<null>>): Promise<void> {
  await unwrap(result);
}

/** Any rejection as a `ServiceError`: `AppError`s keep their kind, the rest are `internal`. */
export function toServiceError(e: unknown): ServiceError {
  if (e instanceof ServiceError) return e;
  if (isAppError(e)) return ServiceError.from(e);
  return new ServiceError("internal", e instanceof Error ? e.message : String(e));
}
