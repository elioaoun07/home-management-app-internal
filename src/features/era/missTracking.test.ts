// Behavior lock for HUB-28's miss classification — the cheap, deterministic
// (no AI call) signal that distinguishes "ERA has a capability for this, the
// phrasing just didn't parse" from "nothing in the registry covers this at
// all". See the module doc for why this is a heuristic, not an authority.
import { describe, expect, it } from "vitest";
import { classifyMiss } from "./missTracking";

describe("classifyMiss", () => {
  it("classifies a miss containing reminder vocabulary as a language gap", () => {
    expect(classifyMiss("remind me sometime about the thing")).toEqual({
      missKind: "language-gap",
      matchedEntity: "reminder",
    });
  });

  it("classifies a miss containing schedule vocabulary as a language gap", () => {
    expect(classifyMiss("what's my agenda looking like")).toEqual({
      missKind: "language-gap",
      matchedEntity: "schedule",
    });
  });

  it("classifies a miss with no matching vocabulary as a capability gap", () => {
    expect(classifyMiss("split this bill three ways")).toEqual({
      missKind: "capability-gap",
      matchedEntity: null,
    });
  });

  it("a learned word (Stage 5) can turn a capability gap into a language gap", () => {
    const withoutLearning = classifyMiss("nudge it to five");
    expect(withoutLearning.missKind).toBe("capability-gap");

    const withLearning = classifyMiss("nudge it to five", { reminder: new Set(["nudge"]) });
    expect(withLearning).toEqual({ missKind: "language-gap", matchedEntity: "reminder" });
  });
});
