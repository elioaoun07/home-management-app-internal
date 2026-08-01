import { describe, expect, it } from "vitest";
import { getErrorCode, getErrorMessage, isCodedError } from "./errors";

describe("getErrorMessage", () => {
  it("reads the message off a real Error", () => {
    expect(getErrorMessage(new Error("boom"))).toBe("boom");
  });

  it("reads the message off an Error-shaped object (Supabase/PostgREST)", () => {
    expect(getErrorMessage({ message: "duplicate key value" })).toBe("duplicate key value");
  });

  it("passes a thrown string straight through", () => {
    expect(getErrorMessage("plain string throw")).toBe("plain string throw");
  });

  it("falls back when the value carries no usable message", () => {
    // These are the cases the old `catch (error: any)` rendered as an empty
    // toast: `error.message` was `undefined` and `|| fallback` only saved it
    // when the caller remembered to write one.
    expect(getErrorMessage(undefined, "Failed to save")).toBe("Failed to save");
    expect(getErrorMessage(null, "Failed to save")).toBe("Failed to save");
    expect(getErrorMessage({}, "Failed to save")).toBe("Failed to save");
    expect(getErrorMessage(42, "Failed to save")).toBe("Failed to save");
  });

  it("falls back on a blank or whitespace-only message", () => {
    expect(getErrorMessage(new Error(""), "Failed")).toBe("Failed");
    expect(getErrorMessage({ message: "   " }, "Failed")).toBe("Failed");
    expect(getErrorMessage("  ", "Failed")).toBe("Failed");
  });

  it("uses a generic fallback when none is supplied", () => {
    expect(getErrorMessage({})).toBe("Something went wrong");
  });

  it("ignores a non-string message", () => {
    expect(getErrorMessage({ message: { nested: true } }, "Failed")).toBe("Failed");
  });
});

describe("getErrorCode / isCodedError", () => {
  it("extracts a Postgres unique-violation code (Hard Rule #9 → 409)", () => {
    expect(getErrorCode({ code: "23505", message: "duplicate key" })).toBe("23505");
  });

  it("extracts a PostgREST not-found code", () => {
    expect(getErrorCode({ code: "PGRST116" })).toBe("PGRST116");
  });

  it("returns undefined for values with no code", () => {
    expect(getErrorCode(new Error("boom"))).toBeUndefined();
    expect(getErrorCode(null)).toBeUndefined();
    expect(getErrorCode(undefined)).toBeUndefined();
    expect(getErrorCode("23505")).toBeUndefined();
  });

  it("does not treat a non-string code as a code", () => {
    expect(getErrorCode({ code: 23505 })).toBeUndefined();
    expect(isCodedError({ code: 23505 })).toBe(false);
  });

  it("narrows correctly", () => {
    expect(isCodedError({ code: "23505" })).toBe(true);
    expect(isCodedError({})).toBe(false);
  });
});
