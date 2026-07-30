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
  addUsageV2,
  toUsageTotalsV2,
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
      // DLV-61: null, not {0,0} — this raw shape reported no TTL breakdown.
      cacheCreationTtl: null,
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

  // DLV-61 — cache writes were 87.4% of the s-20260730-104900-9mfu bill, and
  // whether that is priced right turns on the TTL (1h = 2x input, 5m = 1.25x).
  it("records the claude cache-creation TTL split when the provider reports it", () => {
    const raw = {
      input_tokens: 9,
      cache_read_input_tokens: 0,
      cache_creation_input_tokens: 5582,
      output_tokens: 423,
      cache_creation: { ephemeral_1h_input_tokens: 5582, ephemeral_5m_input_tokens: 0 },
    };
    // The real turn-0002 opening call: 100% 1-hour, which is what makes
    // `cacheWritePerMTok: 2` the correct rate rather than an over-estimate.
    expect(normalizeUsageV2(raw, "claude").cacheCreationTtl).toEqual({ ephemeral1h: 5582, ephemeral5m: 0 });
  });

  it("distinguishes 'no breakdown reported' (null) from 'reported, genuinely zero'", () => {
    expect(normalizeUsageV2({ input_tokens: 1 }, "claude").cacheCreationTtl).toBeNull();
    expect(normalizeUsageV2({ cache_creation: {} }, "claude").cacheCreationTtl).toBeNull();
    expect(
      normalizeUsageV2({ cache_creation: { ephemeral_1h_input_tokens: 0, ephemeral_5m_input_tokens: 0 } }, "claude")
        .cacheCreationTtl,
    ).toEqual({ ephemeral1h: 0, ephemeral5m: 0 });
  });

  it("keeps the TTL split out of budget math (diagnostic only)", () => {
    const raw = {
      input_tokens: 10,
      cache_creation_input_tokens: 100,
      cache_creation: { ephemeral_1h_input_tokens: 100, ephemeral_5m_input_tokens: 0 },
    };
    const usage = normalizeUsageV2(raw, "claude");
    // toUsageTotalsV2 builds named keys explicitly and never spreads, so the
    // diagnostic can never leak into a cap comparison (the DLV-43 NaN lesson).
    expect(toUsageTotalsV2(usage)).not.toHaveProperty("cacheCreationTtl");
    expect(computeOccupancy(usage).occupancyTokens).toBe(110);
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

// Regression for the NaN-poisoning found while wiring DLV-43: a running total
// created before DLV-37 (legacy `{input, cachedInput, output, costUsd}`) has no
// cachedRead/cacheCreation/reasoningOutput keys, so the old `{...prevTotals}`
// spread left them undefined and the next `+=` produced NaN — after which every
// budget comparison silently returns false and no cap can ever trip again.
describe("addUsageV2: legacy-shaped running totals (DLV-37 back-compat)", () => {
  it("carries a legacy total forward without producing NaN, mapping cachedInput -> cachedRead", () => {
    // Deliberately the pre-DLV-37 shape, which is exactly what makes this a
    // regression test — the cast is the point, not a workaround.
    const legacyTotal = { input: 100, cachedInput: 2000, output: 50, costUsd: 0.02 } as unknown as Parameters<
      typeof addUsageV2
    >[0];
    const next = addUsageV2(legacyTotal, { input: 10, cachedRead: 300, cacheCreation: 400, output: 5, reasoningOutput: 0 }, 0.01);

    expect(next).toEqual({
      input: 110,
      cachedRead: 2300,
      cacheCreation: 400,
      output: 55,
      reasoningOutput: 0,
      costUsd: 0.03,
      costEstUsd: null,
    });
    for (const value of Object.values(next)) {
      expect(Number.isNaN(value as number)).toBe(false);
    }
  });

  it("toUsageTotalsV2 zero-fills a totally absent total rather than throwing", () => {
    expect(toUsageTotalsV2(null)).toEqual(emptyUsageV2());
    expect(toUsageTotalsV2(undefined)).toEqual(emptyUsageV2());
  });
});
