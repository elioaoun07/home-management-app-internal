import { timingSafeEqual } from "node:crypto";

/**
 * The one gate for `src/app/api/cron/*` routes (Hard Rule 8). True only when
 * `CRON_SECRET` is set AND the request carries `Authorization: Bearer <it>`.
 * An unset or empty secret rejects every call — comparing against a template
 * literal of an unset variable would accept the literal `Bearer undefined`.
 * Read at call time so a missing variable can never be captured at import.
 */
export function isCronAuthorized(req: { headers: Headers }): boolean {
  const secret = process.env.CRON_SECRET;
  if (!secret) return false;
  const header = req.headers.get("authorization");
  if (!header) return false;
  const expected = Buffer.from(`Bearer ${secret}`);
  const actual = Buffer.from(header);
  return actual.length === expected.length && timingSafeEqual(actual, expected);
}
