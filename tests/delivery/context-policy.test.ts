import { describe, expect, it } from "vitest";
import { CONTEXT_STRATEGIES, decideContextStrategy } from "../../scripts/delivery/context-policy.mjs";

describe("decideContextStrategy: priority order", () => {
  it("defaults to resume-native with no triggers", () => {
    const result = decideContextStrategy({});
    expect(result.strategy).toBe("resume-native");
    expect(result.reasons.length).toBeGreaterThan(0);
  });

  it("resume-after-crash with an established ref wins over everything else", () => {
    const result = decideContextStrategy({
      resumeAfterCrash: true, hasEstablishedRef: true, pendingModelChange: true, ownerRotateRequested: true,
    });
    expect(result.strategy).toBe("resume-native");
  });

  it("resume-after-crash without an established ref falls through to later checks", () => {
    const result = decideContextStrategy({ resumeAfterCrash: true, hasEstablishedRef: false, pendingModelChange: true });
    expect(result.strategy).toBe("resume-with-overrides");
  });

  it("provider switch beats fork/model/effort/rotate", () => {
    const result = decideContextStrategy({
      pendingProviderSwitch: true, pendingFork: true, pendingModelChange: true, ownerRotateRequested: true,
    });
    expect(result.strategy).toBe("handoff");
  });

  it("fork beats model/effort/rotate", () => {
    const result = decideContextStrategy({ pendingFork: true, pendingModelChange: true, ownerRotateRequested: true });
    expect(result.strategy).toBe("fork");
  });

  it("model change beats effort change and owner rotate", () => {
    const result = decideContextStrategy({ pendingModelChange: true, pendingEffortChange: true, ownerRotateRequested: true });
    expect(result.strategy).toBe("resume-with-overrides");
    expect(result.reasons[0]).toMatch(/model/);
  });

  it("effort-only change also resolves to resume-with-overrides", () => {
    const result = decideContextStrategy({ pendingEffortChange: true });
    expect(result.strategy).toBe("resume-with-overrides");
  });

  it("owner rotate beats threshold-based rotation checks", () => {
    const result = decideContextStrategy({ ownerRotateRequested: true, isPhaseBoundary: true, occupancyTokens: 1, rotateAtTokens: 999999 });
    expect(result.strategy).toBe("rotate-fresh");
    expect(result.reasons[0]).toMatch(/explicitly requested/);
  });
});

describe("decideContextStrategy: threshold-based rotation", () => {
  it("rotates at a phase boundary once occupancy reaches rotateAtTokens", () => {
    const result = decideContextStrategy({ isPhaseBoundary: true, occupancyTokens: 150000, rotateAtTokens: 150000 });
    expect(result.strategy).toBe("rotate-fresh");
    expect(result.reasons[0]).toMatch(/occupancy 150000/);
  });

  it("does not rotate at a phase boundary below the threshold", () => {
    const result = decideContextStrategy({ isPhaseBoundary: true, occupancyTokens: 100000, rotateAtTokens: 150000 });
    expect(result.strategy).toBe("resume-native");
  });

  it("rotates mid-phase once projected occupancy crosses the hard ceiling fraction of the window", () => {
    const result = decideContextStrategy({ isPhaseBoundary: false, occupancyTokens: 180000, windowTokens: 200000, hardCeilingPct: 0.85 });
    expect(result.strategy).toBe("rotate-fresh");
    expect(result.partialPhaseDigest).toBe(true);
  });

  it("does not apply the mid-phase ceiling check at a phase boundary (that path uses rotateAtTokens instead)", () => {
    const result = decideContextStrategy({ isPhaseBoundary: true, occupancyTokens: 180000, windowTokens: 200000, hardCeilingPct: 0.85, rotateAtTokens: null });
    expect(result.strategy).toBe("resume-native");
  });

  it("ignores the mid-phase check when windowTokens or hardCeilingPct is unknown", () => {
    const result = decideContextStrategy({ isPhaseBoundary: false, occupancyTokens: 999999, windowTokens: null, hardCeilingPct: 0.85 });
    expect(result.strategy).toBe("resume-native");
  });
});

describe("decideContextStrategy: repeated phase re-entry suggests (not forces) rotation", () => {
  it("suggests rotate-fresh with suggested:true once the retry count reaches the threshold", () => {
    const result = decideContextStrategy({ sameStateReentryCount: 2, forkAfterPhaseRetries: 2 });
    expect(result.strategy).toBe("rotate-fresh");
    expect(result.suggested).toBe(true);
  });

  it("does not trigger below the retry threshold", () => {
    const result = decideContextStrategy({ sameStateReentryCount: 1, forkAfterPhaseRetries: 2 });
    expect(result.strategy).toBe("resume-native");
  });

  it("is inactive when forkAfterPhaseRetries is null", () => {
    const result = decideContextStrategy({ sameStateReentryCount: 100, forkAfterPhaseRetries: null });
    expect(result.strategy).toBe("resume-native");
  });
});

describe("CONTEXT_STRATEGIES", () => {
  it("lists all five strategies", () => {
    expect(CONTEXT_STRATEGIES).toEqual(["resume-native", "resume-with-overrides", "rotate-fresh", "handoff", "fork"]);
  });
});
