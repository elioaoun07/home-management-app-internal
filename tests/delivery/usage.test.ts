import { describe, expect, it } from "vitest";
import {
  UsageError,
  computeOccupancy,
  emptyUsageV2,
  estimateCostUsd,
  normalizeUsageV2,
  reduceTurnUsage,
  reduceUsageByAgent,
  reduceUsageByModel,
  reduceUsageByPhase,
  reduceUsageByProvider,
  reduceUsageTotal,
} from "../../scripts/delivery/usage.mjs";

describe("normalizeUsageV2", () => {
  it("normalizes the codex shape incl. reasoning tokens", () => {
    const raw = { input_tokens: 100, cached_input_tokens: 20, output_tokens: 50, reasoning_output_tokens: 15, cost_usd: 0.01 };
    expect(normalizeUsageV2(raw, "codex")).toEqual({
      input: 100,
      cachedRead: 20,
      cacheCreation: 0,
      output: 50,
      reasoningOutput: 15,
      costUsd: 0.01,
    });
  });

  it("normalizes the claude shape incl. cache-creation tokens", () => {
    const raw = {
      input_tokens: 200,
      cache_read_input_tokens: 40,
      cache_creation_input_tokens: 30,
      output_tokens: 80,
      total_cost_usd: 0.02,
    };
    expect(normalizeUsageV2(raw, "claude")).toEqual({
      input: 200,
      cachedRead: 40,
      cacheCreation: 30,
      output: 80,
      reasoningOutput: 0,
      costUsd: 0.02,
    });
  });

  it("codex cacheCreation is always 0; claude reasoningOutput is always 0", () => {
    expect(normalizeUsageV2({ input_tokens: 1 }, "codex").cacheCreation).toBe(0);
    expect(normalizeUsageV2({ input_tokens: 1 }, "claude").reasoningOutput).toBe(0);
  });

  it("defaults costUsd to null when the provider omits it", () => {
    expect(normalizeUsageV2({ input_tokens: 1 }, "codex").costUsd).toBeNull();
    expect(normalizeUsageV2({ input_tokens: 1 }, "claude").costUsd).toBeNull();
  });

  it("returns empty usage for null/undefined raw", () => {
    expect(normalizeUsageV2(null, "codex")).toEqual({
      input: 0,
      cachedRead: 0,
      cacheCreation: 0,
      output: 0,
      reasoningOutput: 0,
      costUsd: null,
    });
  });

  it("throws for an unknown provider", () => {
    expect(() => normalizeUsageV2({}, "bogus" as unknown as "codex")).toThrow(UsageError);
  });
});

describe("estimateCostUsd", () => {
  const pricing = { inPerMTok: 1.0, cachedReadPerMTok: 0.1, cacheWritePerMTok: 1.25, outPerMTok: 5.0 };

  it("computes cost from all four token buckets", () => {
    const usage = { input: 1_000_000, cachedRead: 1_000_000, cacheCreation: 1_000_000, output: 1_000_000 };
    expect(estimateCostUsd(usage, pricing)).toBeCloseTo(1.0 + 0.1 + 1.25 + 5.0, 6);
  });

  it("returns null when no pricing is supplied", () => {
    expect(estimateCostUsd({ input: 100 }, null)).toBeNull();
    expect(estimateCostUsd({ input: 100 }, undefined)).toBeNull();
  });

  it("treats a missing usage as zero tokens", () => {
    expect(estimateCostUsd(undefined, pricing)).toBe(0);
  });
});

describe("computeOccupancy", () => {
  it("sums input + cachedRead + cacheCreation", () => {
    const { occupancyTokens } = computeOccupancy({ input: 10, cachedRead: 20, cacheCreation: 5, output: 100 });
    expect(occupancyTokens).toBe(35);
  });

  it("computes pctUsed when windowTokens is known", () => {
    const { pctUsed, windowTokens } = computeOccupancy({ input: 50, cachedRead: 0, cacheCreation: 0 }, 200);
    expect(windowTokens).toBe(200);
    expect(pctUsed).toBeCloseTo(0.25, 6);
  });

  it("returns pctUsed:null and windowTokens:null when the window is unknown", () => {
    const result = computeOccupancy({ input: 50 });
    expect(result.pctUsed).toBeNull();
    expect(result.windowTokens).toBeNull();
  });
});

describe("reduceTurnUsage / grouped reducers", () => {
  const turns = [
    { phase: "DISCOVERY", agent: "orchestrator", model: "claude-haiku-4-5", provider: "claude",
      usage: { input: 100, cachedRead: 10, cacheCreation: 0, output: 20, reasoningOutput: 0 }, costUsd: 0.01, costEstUsd: 0.02 },
    { phase: "DISCOVERY", agent: "orchestrator", model: "claude-haiku-4-5", provider: "claude",
      usage: { input: 50, cachedRead: 5, cacheCreation: 0, output: 10, reasoningOutput: 0 }, costUsd: null, costEstUsd: 0.01 },
    { phase: "PLAN", agent: "orchestrator", model: "gpt-5.2-codex", provider: "codex",
      usage: { input: 30, cachedRead: 0, cacheCreation: 0, output: 5, reasoningOutput: 8 }, costUsd: null, costEstUsd: null },
  ];

  it("groups by an arbitrary key function", () => {
    const { groups, total } = reduceTurnUsage(turns, (t) => t.phase);
    expect(groups.DISCOVERY).toEqual({ input: 150, cachedRead: 15, cacheCreation: 0, output: 30, reasoningOutput: 0, costUsd: 0.01, costEstUsd: 0.03 });
    expect(groups.PLAN).toEqual({ input: 30, cachedRead: 0, cacheCreation: 0, output: 5, reasoningOutput: 8, costUsd: null, costEstUsd: null });
    expect(total.input).toBe(180);
    expect(total.reasoningOutput).toBe(8);
    expect(total.costUsd).toBeCloseTo(0.01, 6);
    expect(total.costEstUsd).toBeCloseTo(0.03, 6);
  });

  it("requires a groupBy function", () => {
    expect(() => reduceTurnUsage(turns, undefined as unknown as (t: object) => string)).toThrow(UsageError);
  });

  it("groups null/undefined keys under 'unknown'", () => {
    const { groups } = reduceTurnUsage([{ usage: { input: 1, cachedRead: 0, cacheCreation: 0, output: 0, reasoningOutput: 0 } }], () => null);
    expect(groups.unknown).toBeDefined();
  });

  it("convenience reducers group by the expected field", () => {
    expect(Object.keys(reduceUsageByPhase(turns).groups).sort()).toEqual(["DISCOVERY", "PLAN"]);
    expect(Object.keys(reduceUsageByAgent(turns).groups)).toEqual(["orchestrator"]);
    expect(Object.keys(reduceUsageByModel(turns).groups).sort()).toEqual(["claude-haiku-4-5", "gpt-5.2-codex"]);
    expect(Object.keys(reduceUsageByProvider(turns).groups).sort()).toEqual(["claude", "codex"]);
  });

  it("reduceUsageTotal returns just the session total", () => {
    const total = reduceUsageTotal(turns);
    expect(total.input).toBe(180);
    expect(total.output).toBe(35);
  });

  it("returns zeroed totals for an empty turn list", () => {
    expect(reduceTurnUsage([], (t) => t)).toEqual({ groups: {}, total: emptyUsageV2() });
  });
});
