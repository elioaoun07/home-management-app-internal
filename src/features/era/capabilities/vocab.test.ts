import { describe, expect, it } from "vitest";
import { classifyMissEntity, matchesEntityVocab } from "./vocab";

describe("matchesEntityVocab", () => {
  it("matches base reminder vocabulary", () => {
    expect(matchesEntityVocab("remind me to call the bank", "reminder")).toBe(true);
  });

  it("matches base schedule vocabulary", () => {
    expect(matchesEntityVocab("what's on my calendar today", "schedule")).toBe(true);
  });

  it("does not match unrelated text", () => {
    expect(matchesEntityVocab("split the bill with roommates", "reminder")).toBe(false);
    expect(matchesEntityVocab("split the bill with roommates", "schedule")).toBe(false);
  });

  it("matches a learned word when the caller supplies it for that entity", () => {
    const learned = new Set(["nudge"]);
    expect(matchesEntityVocab("nudge it to 5", "reminder", learned)).toBe(true);
    // Entity scoping itself is classifyMissEntity's job (it looks up the
    // learned set per-entity) — see the describe block below.
    expect(matchesEntityVocab("nudge it to 5", "schedule")).toBe(false);
  });
});

describe("classifyMissEntity", () => {
  it("returns the first matching entity", () => {
    expect(classifyMissEntity("remind me tomorrow")).toBe("reminder");
  });

  it("returns null when nothing matches — a genuine capability gap", () => {
    expect(classifyMissEntity("split this bill three ways")).toBeNull();
  });

  it("uses learned vocab, scoped per entity, to widen a match", () => {
    const learned = { reminder: new Set(["nudge"]) };
    expect(classifyMissEntity("nudge it to five", undefined)).toBeNull();
    expect(classifyMissEntity("nudge it to five", learned)).toBe("reminder");
  });
});
