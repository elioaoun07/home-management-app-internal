import { afterEach, describe, expect, it } from "vitest";
import { isCronAuthorized } from "./cronAuth";

const original = process.env.CRON_SECRET;
afterEach(() => {
  if (original === undefined) delete process.env.CRON_SECRET;
  else process.env.CRON_SECRET = original;
});

const withHeader = (authorization?: string) => ({
  headers: new Headers(authorization ? { authorization } : {}),
});

describe("isCronAuthorized", () => {
  it("rejects everything, including `Bearer undefined`, when the secret is unset", () => {
    delete process.env.CRON_SECRET;
    expect(isCronAuthorized(withHeader("Bearer undefined"))).toBe(false);
    expect(isCronAuthorized(withHeader("Bearer "))).toBe(false);
    expect(isCronAuthorized(withHeader())).toBe(false);
  });

  it("rejects everything when the secret is an empty string", () => {
    process.env.CRON_SECRET = "";
    expect(isCronAuthorized(withHeader("Bearer "))).toBe(false);
    expect(isCronAuthorized(withHeader("Bearer"))).toBe(false);
  });

  it("accepts exactly `Bearer <secret>`", () => {
    process.env.CRON_SECRET = "s3cret-value";
    expect(isCronAuthorized(withHeader("Bearer s3cret-value"))).toBe(true);
  });

  it.each([
    undefined,
    "",
    "s3cret-value",
    "bearer s3cret-value",
    "Bearer s3cret-valu",
    "Bearer s3cret-valuf",
    "Bearer undefined",
    "Basic s3cret-value",
  ])("rejects %j when a secret is configured", (header) => {
    process.env.CRON_SECRET = "s3cret-value";
    expect(isCronAuthorized(withHeader(header))).toBe(false);
  });

  it("reads the secret at call time", () => {
    delete process.env.CRON_SECRET;
    expect(isCronAuthorized(withHeader("Bearer later"))).toBe(false);
    process.env.CRON_SECRET = "later";
    expect(isCronAuthorized(withHeader("Bearer later"))).toBe(true);
  });
});
