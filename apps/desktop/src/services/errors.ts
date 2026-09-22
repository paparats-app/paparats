import type { AppError } from "@/bindings";

/** Error thrown by every service method. Mirrors the Rust `AppError` (`{ kind, message }`). */
export class ServiceError extends Error {
  readonly kind: AppError["kind"];

  constructor(kind: AppError["kind"], message: string) {
    super(message);
    this.name = "ServiceError";
    this.kind = kind;
  }

  static from(error: AppError): ServiceError {
    return new ServiceError(error.kind, error.message);
  }
}

export function isServiceError(e: unknown): e is ServiceError {
  return e instanceof ServiceError;
}
