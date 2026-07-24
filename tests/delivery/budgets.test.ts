import { describe, expect, it } from "vitest";
import {
  checkSessionBudget,
  createBudgetEnvelope,
  isDiscoveryTurnLimitReached,
  isPlanStepCountOverCap,
  raiseBudgetEnvelope,
  totalProcessedTokens,
} from "../../scripts/delivery/budgets.mjs";

describe("totalProcessedTokens", () => {
  it("sums input, cachedInput, and output", () => {
    expect(totalProcessedTokens({ input: 100, cachedInput: 2900, output: 50 })).toBe(3050);
  });

  it("treats missing fields as zero", () => {
    expect(totalProcessedTokens({})).toBe(0);
    expect(totalProcessedTokens(undefined)).toBe(0);
  });
});

describe("checkSessionBudget", () => {
  it("is ok when well under every configured threshold", () => {
    const verdict = checkSessionBudget(
      { input: 1000, cachedInput: 2000, output: 500, costUsd: 0.05 },
      { warnSessionTokens: 1_500_000, maxSessionTokens: 4_000_000, warnSessionUsd: 10, maxSessionUsd: 25 },
    );
    expect(verdict).toMatchObject({ status: "ok", totalTokens: 3500, costUsd: 0.05, reason: null });
  });

  it("warns once the token total crosses warnSessionTokens but stays under the hard cap", () => {
    const verdict = checkSessionBudget(
      { input: 100_000, cachedInput: 1_450_000, output: 50_000 },
      { warnSessionTokens: 1_500_000, maxSessionTokens: 4_000_000 },
    );
    expect(verdict.status).toBe("warn");
  });

  it("reports exceeded once total processed tokens reach the hard cap (BUD-11 counterfactual: ~3M cached tokens)", () => {
    const verdict = checkSessionBudget(
      { input: 1434, cachedInput: 2_991_876, output: 43_447 },
      { warnSessionTokens: 1_500_000, maxSessionTokens: 2_000_000 },
    );
    expect(verdict.status).toBe("exceeded");
    expect(verdict.totalTokens).toBe(1434 + 2_991_876 + 43_447);
    expect(verdict.reason).toMatch(/token budget exhausted/i);
  });

  it("reports exceeded on a cost cap even when the token cap isn't configured", () => {
    const verdict = checkSessionBudget({ input: 10, cachedInput: 10, output: 10, costUsd: 12.5 }, { maxSessionUsd: 10 });
    expect(verdict.status).toBe("exceeded");
    expect(verdict.reason).toMatch(/cost budget exhausted/i);
  });

  it("never reports exceeded/warn when no budgets are configured (default: unbounded)", () => {
    const verdict = checkSessionBudget({ input: 999_999_999, cachedInput: 999_999_999, output: 999_999_999 }, {});
    expect(verdict.status).toBe("ok");
  });

  it("ignores a null/missing costUsd for the cost thresholds without throwing", () => {
    const verdict = checkSessionBudget({ input: 1, cachedInput: 1, output: 1, costUsd: null }, { maxSessionUsd: 1 });
    expect(verdict.status).toBe("ok");
  });
});

describe("packet budget envelopes", () => {
  it("normalizes a capped envelope and derives the 80% warning threshold", () => {
    const envelope = createBudgetEnvelope(
      { maxTokens: 100_000, maxUsd: 2, warnPct: 0.8 },
      { authorizedAt: "2026-07-24T00:00:00.000Z" },
    );
    expect(envelope).toMatchObject({ maxTokens: 100_000, maxUsd: 2, warnPct: 0.8, authorization: "capped" });
    expect(checkSessionBudget({ input: 20_000, cachedInput: 59_999, output: 0, costUsd: 1.59 }, envelope).status).toBe("ok");
    expect(checkSessionBudget({ input: 20_000, cachedInput: 60_000, output: 0, costUsd: 1.59 }, envelope).status).toBe("warn");
    expect(checkSessionBudget({ input: 20_000, cachedInput: 80_000, output: 0, costUsd: 1.59 }, envelope).status).toBe("exceeded");
  });

  it("requires typed NO CAP and records that authorization", () => {
    expect(() => createBudgetEnvelope({ maxTokens: null, maxUsd: null, warnPct: 0.8 })).toThrow(/NO CAP/);
    expect(createBudgetEnvelope({ maxTokens: null, maxUsd: null, warnPct: 0.8, noCapConfirm: "NO CAP" })).toMatchObject({
      authorization: "no-cap",
      maxTokens: null,
      maxUsd: null,
    });
  });

  it("enforces optional per-phase caps and allows only reasoned raises", () => {
    const envelope = createBudgetEnvelope({
      maxTokens: 1_000_000,
      warnPct: 0.8,
      perPhase: { building: { maxTokens: 100_000 } },
    });
    expect(
      checkSessionBudget(
        { input: 10, cachedInput: 10, output: 10 },
        envelope,
        { phase: "BUILDING", phaseUsage: { input: 20_000, cachedInput: 80_000, output: 0 } },
      ),
    ).toMatchObject({ status: "exceeded", dimension: "building-tokens" });
    expect(() => raiseBudgetEnvelope(envelope, { maxTokens: 900_000, reason: "lower" })).toThrow(/only increase/);
    expect(raiseBudgetEnvelope(envelope, { maxTokens: 1_500_000, reason: "approved" }).maxTokens).toBe(1_500_000);
  });
});

describe("isDiscoveryTurnLimitReached", () => {
  it("is false when maxTurnsPerPhase.discovery is unset", () => {
    expect(isDiscoveryTurnLimitReached(50, {})).toBe(false);
  });

  it("is true once the count reaches the configured limit", () => {
    expect(isDiscoveryTurnLimitReached(6, { maxTurnsPerPhase: { discovery: 6 } })).toBe(true);
    expect(isDiscoveryTurnLimitReached(5, { maxTurnsPerPhase: { discovery: 6 } })).toBe(false);
  });
});

describe("isPlanStepCountOverCap", () => {
  it("is false when maxPlanSteps is unset", () => {
    expect(isPlanStepCountOverCap(10, {})).toBe(false);
  });

  it("is true only strictly over the cap (BUD-11: 10 steps for a 1-file test task)", () => {
    expect(isPlanStepCountOverCap(10, { maxPlanSteps: 5 })).toBe(true);
    expect(isPlanStepCountOverCap(5, { maxPlanSteps: 5 })).toBe(false);
  });
});
