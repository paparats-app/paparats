import type { AppError } from "@/bindings";
import { ServiceError } from "../errors";

/** What every tauri-specta command resolves with (`commands.*` in bindings.ts). */
export type CommandResult<T> = { status: "ok"; data: T } | { status: "error"; error: AppError };

/**
 * Unwraps a command result: `{status:'error'}` becomes `ServiceError.from(error)`, and IPC
 * failures (thrown by the invoke itself) become `internal` errors.
 */
export async function unwrap<T>(result: Promise<CommandResult<T>>): Promise<T> {
  let settled: CommandResult<T>;
  try {
    settled = await result;
  } catch (e) {
    throw toServiceError(e);
  }
  if (settled.status === "error") throw ServiceError.from(settled.error);
  return settled.data;
}

export function toServiceError(e: unknown): ServiceError {
  if (e instanceof ServiceError) return e;
  return new ServiceError("internal", e instanceof Error ? e.message : String(e));
}
