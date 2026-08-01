// src/lib/errors.ts
// Typed narrowing helpers for values caught in `catch`.
//
// A caught value is `unknown` — it is whatever was thrown, which is not
// necessarily an Error. The repo previously wrote `catch (error: any)` and read
// `error.message` directly, which type-checks only because `any` disables the
// check: if a non-Error is ever thrown (a string, a rejected fetch value, a
// Supabase error object), `error.message` is silently `undefined` and the user
// sees an empty toast rather than a message. These helpers narrow honestly and
// always produce something displayable.

/** A Postgres/PostgREST-shaped error: Supabase surfaces `code` (e.g. "23505"). */
export type CodedError = { code: string };

/** True when `value` carries a string `code`, e.g. a Supabase/PostgREST error. */
export function isCodedError(value: unknown): value is CodedError {
  return (
    typeof value === "object" &&
    value !== null &&
    "code" in value &&
    typeof (value as { code: unknown }).code === "string"
  );
}

/**
 * The error code if the value carries one, else `undefined`.
 * Use for Supabase checks like `getErrorCode(error) === "23505"` (unique
 * violation → 409 per Hard Rule #9).
 */
export function getErrorCode(value: unknown): string | undefined {
  return isCodedError(value) ? value.code : undefined;
}

/**
 * A human-readable message for any caught value.
 * Falls back to `fallback` when the value carries no usable message, so callers
 * never render an empty string.
 */
export function getErrorMessage(value: unknown, fallback = "Something went wrong"): string {
  if (value instanceof Error && value.message) return value.message;
  if (typeof value === "string" && value.trim()) return value;
  if (typeof value === "object" && value !== null && "message" in value) {
    const message = (value as { message: unknown }).message;
    if (typeof message === "string" && message.trim()) return message;
  }
  return fallback;
}
