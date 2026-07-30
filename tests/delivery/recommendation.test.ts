import { describe, expect, it } from "vitest";
import {
  assessRecommendationMismatch,
  effortForTier,
  forecastByPhase,
  laneForTier,
  recommendAgentConfig,
  resolveLanePolicy,
  scoreComplexity,
  tierForLane,
  tierForScore,
} from "../../scripts/delivery/recommendation.mjs";
import { DEFAULT_CONFIG } from "../../scripts/delivery/config.mjs";

const CATALOG_CONFIG = {
  ...DEFAULT_CONFIG,
  providers: {
    ...DEFAULT_CONFIG.providers,
    claude: {
      defaultModel: "claude-sonnet-5",
      efforts: DEFAULT_CONFIG.providers.claude.efforts,
      models: [
        {
          id: "claude-haiku-4-5",
          tier: "economy",
          pricing: { inPerMTok: 1, outPerMTok: 5, cachedReadPerMTok: 0.1, cacheWritePerMTok: 1.25 },
        },
        {
          id: "claude-sonnet-5",
          tier: "standard",
          pricing: { inPerMTok: 3, outPerMTok: 15, cachedReadPerMTok: 0.3, cacheWritePerMTok: 3.75 },
        },
        {
          id: "claude-opus-4-8",
          tier: "premium",
          pricing: { inPerMTok: 5, outPerMTok: 25, cachedReadPerMTok: 0.5, cacheWritePerMTok: 6.25 },
        },
      ],
    },
  },
};

describe("scoreComplexity", () => {
  it("scores an S-effort annoyance with no risk flags as 0", () => {
    const { score, rationale } = scoreComplexity({ item: { effort: "S", sev: "annoyance", campaign: "Budget" }, capabilities: [] });
    expect(score).toBe(0);
    expect(rationale).toEqual(["S-effort item (+0)"]);
  });

  it("scores an L-effort blocker with a money-domain capability and a junction campaign as 5", () => {
    const { score, rationale } = scoreComplexity({
      item: { effort: "L", sev: "blocker", campaign: "Hub & ERA" },
      capabilities: [{ name: "money-domain" }],
    });
    expect(score).toBe(5);
    expect(rationale).toEqual([
      "L-effort item (+2)",
      "blocker severity (+1)",
      "money-domain capability flagged (+1)",
      'junction-module campaign "Hub & ERA" (+1)',
    ]);
  });

  it("ignores an unrecognized effort letter", () => {
    const { score, rationale } = scoreComplexity({ item: { effort: "XL" }, capabilities: [] });
    expect(score).toBe(0);
    expect(rationale).toEqual([]);
  });

  it("raises an S-item that itself names a broad set of paths out of the economy tier", () => {
    const { score, rationale } = scoreComplexity({
      item: { effort: "S", sev: "annoyance", campaign: "Budget" },
      capabilities: [],
      scopeHints: { globs: ["one/a.ts", "two/b.ts", "three/c.ts", "four/d.ts"], scopeSource: "item-paths" },
    });
    expect(score).toBe(2);
    expect(rationale).toContain("broad launch scope (4 paths named in item, +2)");
    expect(tierForScore(score)).toBe("standard");
  });

  // DLV-42: without `scopeSource: "item-paths"` the glob list came from the
  // campaign constant table, so its length described the campaign's size and
  // not the item's. Budget's 6-entry table handed +2 to every Budget item ever
  // launched — a one-token chip edit scored 3 and drew a DEEP recommendation.
  it("ignores glob count when the scope is campaign-table boilerplate (DLV-42)", () => {
    const { score, rationale } = scoreComplexity({
      item: { effort: "S", sev: "annoyance", campaign: "Budget" },
      capabilities: [],
      scopeHints: {
        globs: [
          "src/features/accounts/**",
          "src/features/transactions/**",
          "src/features/categories/**",
          "src/features/recurring/**",
          "src/features/balance/**",
          "src/features/budget/**",
        ],
      },
    });
    expect(score).toBe(0);
    expect(rationale.join(" ")).not.toMatch(/broad launch scope/);
    expect(tierForScore(score)).toBe("economy");
  });
});

describe("tierForScore", () => {
  it("maps 0-1 to economy, 2 to standard, 3+ to premium", () => {
    expect(tierForScore(0)).toBe("economy");
    expect(tierForScore(1)).toBe("economy");
    expect(tierForScore(2)).toBe("standard");
    expect(tierForScore(3)).toBe("premium");
    expect(tierForScore(10)).toBe("premium");
  });
});

describe("effortForTier", () => {
  it("returns a fresh, independently mutable object per call", () => {
    const a = effortForTier("economy");
    a.discovery = "mutated";
    const b = effortForTier("economy");
    expect(b.discovery).toBe("low");
  });

  it("premium is high-effort across discovery/plan/building", () => {
    expect(effortForTier("premium")).toEqual({ discovery: "high", plan: "high", building: "high", review: "medium" });
  });
});

describe("Flight-Check recommendation fit", () => {
  it("maps recommendation tiers to the launch lanes", () => {
    expect(laneForTier("economy")).toBe("FAST");
    expect(laneForTier("standard")).toBe("STANDARD");
    expect(laneForTier("premium")).toBe("DEEP");
  });

  it("tierForLane is the exact reverse of laneForTier", () => {
    expect(tierForLane("FAST")).toBe("economy");
    expect(tierForLane("STANDARD")).toBe("standard");
    expect(tierForLane("DEEP")).toBe("premium");
    for (const tier of ["economy", "standard", "premium"]) {
      expect(tierForLane(laneForTier(tier))).toBe(tier);
    }
  });

  it("makes an economy-model + broad-scope mismatch explicit", () => {
    const recommendation = recommendAgentConfig({
      item: { effort: "S", sev: "annoyance", campaign: "Budget" },
      capabilities: [],
      scopeHints: { globs: ["one/a.ts", "two/b.ts", "three/c.ts", "four/d.ts"], scopeSource: "item-paths" },
      provider: "claude",
      config: CATALOG_CONFIG,
    });
    expect(recommendation!.tier).toBe("standard");
    expect(
      assessRecommendationMismatch({
        recommendation,
        selectedModel: "claude-haiku-4-5",
        selectedModelTier: "economy",
        selectedLane: "FAST",
      }).map((warning) => warning.code),
    ).toEqual(["model-below-recommended-tier", "lane-differs-from-recommendation"]);
  });
});

describe("resolveLanePolicy (D9/DLV-6 — lanes become real policy bundles)", () => {
  it("resolves FAST into economy effort, FAST's budget envelope, and its maxInternalTurns", () => {
    const policy = resolveLanePolicy("FAST", CATALOG_CONFIG);
    expect(policy.lane).toBe("FAST");
    expect(policy.tier).toBe("economy");
    expect(policy.effortByPhase).toEqual(effortForTier("economy"));
    expect(policy.budget).toEqual({ maxUsd: 0.5, maxTokens: 500_000, warnPct: 0.8 });
    // DLV-45: raised 8 -> 12. At 8, FAST could not complete DISCOVERY at all —
    // the phase's own mandated reading list cost ~8 internal turns before any
    // real work. Still meaningfully tighter than STANDARD's 20.
    expect(policy.maxInternalTurns).toBe(12);
    expect(policy.maxInternalTurns).toBeLessThan(Number(resolveLanePolicy("STANDARD", CATALOG_CONFIG)!.maxInternalTurns));
  });

  it("resolves DEEP into premium effort and DEEP's (larger) budget + turn cap", () => {
    const policy = resolveLanePolicy("DEEP", CATALOG_CONFIG);
    expect(policy.tier).toBe("premium");
    expect(policy.effortByPhase).toEqual(effortForTier("premium"));
    expect(policy.budget).toEqual({ maxUsd: 5, maxTokens: 5_000_000, warnPct: 0.8 });
    expect(policy.maxInternalTurns).toBe(40);
  });

  it("is deterministic and independent per call (safe to snapshot into a packet)", () => {
    const a = resolveLanePolicy("STANDARD", CATALOG_CONFIG);
    const b = resolveLanePolicy("STANDARD", CATALOG_CONFIG);
    expect(a).toEqual(b);
    a.effortByPhase.discovery = "mutated";
    expect(b.effortByPhase.discovery).not.toBe("mutated");
  });

  it("D10/DLV-11: FAST resolves a lighter validation ladder (typecheck + targeted test, lint skipped)", () => {
    const policy = resolveLanePolicy("FAST", CATALOG_CONFIG);
    expect(policy.validationLadder).toEqual({ rungs: ["typecheck", "test"], targetedTest: true });
  });

  it("D10/DLV-11: STANDARD/DEEP resolve the full ladder, untargeted", () => {
    expect(resolveLanePolicy("STANDARD", CATALOG_CONFIG).validationLadder).toEqual({
      rungs: ["typecheck", "lint", "test"],
      targetedTest: false,
    });
    expect(resolveLanePolicy("DEEP", CATALOG_CONFIG).validationLadder).toEqual({
      rungs: ["typecheck", "lint", "test"],
      targetedTest: false,
    });
  });

  it("D10/DLV-11: falls back to the full ladder when the config has no validation.laneLadder at all", () => {
    const policy = resolveLanePolicy("FAST", { budgets: {} });
    expect(policy.validationLadder).toEqual({ rungs: ["typecheck", "lint", "test"], targetedTest: false });
  });

  it("budget/maxInternalTurns are null when the config has no laneDefaults at all", () => {
    const policy = resolveLanePolicy("FAST", { budgets: {} });
    expect(policy.tier).toBe("economy");
    expect(policy.budget).toBeNull();
    expect(policy.maxInternalTurns).toBeNull();
  });
});

describe("recommendAgentConfig", () => {
  it("recommends economy/haiku for a trivial test-only task like BUD-11", () => {
    const rec = recommendAgentConfig({
      item: { effort: "S", sev: "annoyance", campaign: "Budget" },
      capabilities: [{ name: "automated-testing" }],
      provider: "claude",
      config: CATALOG_CONFIG,
    });
    expect(rec).not.toBeNull();
    expect(rec!.tier).toBe("economy");
    expect(rec!.model).toBe("claude-haiku-4-5");
    // DLV-57: `plan` was `medium` here. Measured on a one-line change, a medium
    // PLAN turn cost $0.1857 — more than the DISCOVERY turn that had to find the
    // code, and more than the whole session's forecast. `building` stays medium:
    // it writes the code, and reasoning there is worth paying for.
    expect(rec!.effortByPhase).toEqual({ discovery: "low", plan: "low", building: "medium", review: "low" });
    expect(rec!.estTokens).toBeGreaterThan(0);
    expect(rec!.estCostUsd).toBeGreaterThan(0);
  });

  it("recommends premium/opus for an L-effort blocker in a junction module with money-domain", () => {
    const rec = recommendAgentConfig({
      item: { effort: "L", sev: "blocker", campaign: "Hub & ERA" },
      capabilities: [{ name: "money-domain" }],
      provider: "claude",
      config: CATALOG_CONFIG,
    });
    expect(rec!.tier).toBe("premium");
    expect(rec!.model).toBe("claude-opus-4-8");
  });

  it("recommends standard/sonnet for a mid-complexity M-effort money-domain item", () => {
    const rec = recommendAgentConfig({
      item: { effort: "M", sev: "friction", campaign: "Budget" },
      capabilities: [{ name: "money-domain" }],
      provider: "claude",
      config: CATALOG_CONFIG,
    });
    expect(rec!.tier).toBe("standard");
    expect(rec!.model).toBe("claude-sonnet-5");
  });

  it("returns null when the provider catalog has no models (empty .delivery/config.json)", () => {
    const rec = recommendAgentConfig({
      item: { effort: "S" },
      capabilities: [],
      provider: "claude",
      config: DEFAULT_CONFIG,
    });
    expect(rec).toBeNull();
  });

  it("returns null estCostUsd when the matched tier's model has no pricing", () => {
    const noPricingConfig = {
      ...DEFAULT_CONFIG,
      providers: {
        ...DEFAULT_CONFIG.providers,
        claude: { defaultModel: null, efforts: DEFAULT_CONFIG.providers.claude.efforts, models: [{ id: "claude-haiku-4-5", tier: "economy" }] },
      },
    };
    const rec = recommendAgentConfig({ item: { effort: "S" }, capabilities: [], provider: "claude", config: noPricingConfig });
    expect(rec!.model).toBe("claude-haiku-4-5");
    expect(rec!.estCostUsd).toBeNull();
  });

  it("uses the median of >=3 same-tier history samples instead of the static fallback", () => {
    const history = [
      { tier: "economy", usage: { input: 10_000, cachedRead: 100_000, cacheCreation: 0, output: 10_000 } },
      { tier: "economy", usage: { input: 20_000, cachedRead: 200_000, cacheCreation: 0, output: 20_000 } },
      { tier: "economy", usage: { input: 30_000, cachedRead: 300_000, cacheCreation: 0, output: 30_000 } },
      { tier: "premium", usage: { input: 999_999, cachedRead: 999_999, cacheCreation: 0, output: 999_999 } },
    ];
    const rec = recommendAgentConfig({
      item: { effort: "S", sev: "annoyance" },
      capabilities: [],
      provider: "claude",
      config: CATALOG_CONFIG,
      history,
    });
    // DLV-56 moved the headline forecast to a per-phase-traversal sum, so the
    // per-session median now lives on `legacySessionEstimate`. Kept asserted
    // rather than deleted: every session already on disk was launched against
    // this number, and `computeForecastActual` still compares against it.
    // median of [10k,20k,30k] input + [100k,200k,300k] cachedRead + 0 + median output 20k
    expect(rec!.legacySessionEstimate.estTokens).toBe(20_000 + 200_000 + 0 + 20_000);
  });

  it("falls back to the static per-tier shape with fewer than 3 same-tier samples", () => {
    const rec = recommendAgentConfig({
      item: { effort: "S", sev: "annoyance" },
      capabilities: [],
      provider: "claude",
      config: CATALOG_CONFIG,
      history: [{ tier: "economy", usage: { input: 1, cachedRead: 1, cacheCreation: 0, output: 1 } }],
    });
    expect(rec!.legacySessionEstimate.estTokens).toBe(20_000 + 350_000 + 10_000 + 20_000);
  });
});

// DLV-56: the forecast's unit is a phase traversal, not a session.
describe("forecastByPhase", () => {
  it("forecasts every turn-producing phase and sums them", () => {
    const forecast = forecastByPhase({ tier: "economy", itemEffort: "S" });
    expect(forecast.phases.map((p) => p.phase)).toEqual(["discovery", "plan", "building", "reviewing", "uat"]);
    expect(forecast.estTokens).toBe(forecast.phases.reduce((sum, p) => sum + p.tokens, 0));
    expect(forecast.estTokens).toBeGreaterThan(0);
  });

  it("scales BUILDING by the number of plan steps the item's effort implies", () => {
    const small = forecastByPhase({ tier: "economy", itemEffort: "S" });
    const large = forecastByPhase({ tier: "economy", itemEffort: "L" });
    expect(small.assumptions.buildingSteps).toBe(1);
    expect(large.assumptions.buildingSteps).toBe(5);
    // An L item forecasts strictly more than an S one, and the difference is
    // entirely BUILDING — that is the per-traversal unit doing its job.
    expect(large.estTokens).toBeGreaterThan(small.estTokens);
    const buildingOf = (f: ReturnType<typeof forecastByPhase>) => f.phases.find((p) => p.phase === "building")!.tokens;
    expect(large.estTokens - small.estTokens).toBe(buildingOf(large) - buildingOf(small));
  });

  it("caps assumed plan steps at the configured step budget", () => {
    const forecast = forecastByPhase({ tier: "economy", itemEffort: "L", maxPlanSteps: 2 });
    expect(forecast.assumptions.buildingSteps).toBe(2);
    expect(forecast.assumptions.buildingStepsBasis).toContain("capped");
  });

  it("excludes fix loops from the headline and prices one separately", () => {
    // Their number is genuinely unknowable at launch; folding a guess in would
    // make the forecast wrong in the one direction that matters.
    const forecast = forecastByPhase({ tier: "economy", itemEffort: "M" });
    expect(forecast.assumptions.excludesFixLoops).toBe(true);
    expect(forecast.assumptions.perFixLoop.tokens).toBeGreaterThan(0);
  });

  it("prefers measured per-phase medians once three same-tier sessions exist", () => {
    const perPhase = (n: number) => ({
      discovery: { input: n, cachedRead: n, cacheCreation: 0, output: n },
      plan: { input: n, cachedRead: n, cacheCreation: 0, output: n },
      building: { input: n, cachedRead: n, cacheCreation: 0, output: n },
      reviewing: { input: n, cachedRead: n, cacheCreation: 0, output: n },
      uat: { input: n, cachedRead: n, cacheCreation: 0, output: n },
    });
    const history = [
      { tier: "economy", usage: {}, perPhase: perPhase(1_000) },
      { tier: "economy", usage: {}, perPhase: perPhase(2_000) },
      { tier: "economy", usage: {}, perPhase: perPhase(3_000) },
    ];
    const forecast = forecastByPhase({ tier: "economy", itemEffort: "S", history });
    expect(forecast.assumptions.priorSource).toBe("measured-median");
    // Median 2,000 across 3 buckets (cacheCreation is 0) x 5 single-traversal phases.
    expect(forecast.estTokens).toBe(2_000 * 3 * 5);
  });

  it("labels the prior as an estimate when there is not enough history", () => {
    expect(forecastByPhase({ tier: "economy", itemEffort: "S" }).assumptions.priorSource).toBe("static-estimate");
  });

  it("scales with tier", () => {
    const economy = forecastByPhase({ tier: "economy", itemEffort: "M" });
    const premium = forecastByPhase({ tier: "premium", itemEffort: "M" });
    expect(premium.estTokens).toBeGreaterThan(economy.estTokens);
  });
});
