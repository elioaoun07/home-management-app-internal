import { describe, expect, it } from "vitest";
import {
  effortForTier,
  recommendAgentConfig,
  scoreComplexity,
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
    expect(rec!.effortByPhase).toEqual({ discovery: "low", plan: "medium", building: "medium", review: "low" });
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
    // median of [10k,20k,30k] input + [100k,200k,300k] cachedRead + 0 + median output 20k
    expect(rec!.estTokens).toBe(20_000 + 200_000 + 0 + 20_000);
  });

  it("falls back to the static per-tier shape with fewer than 3 same-tier samples", () => {
    const rec = recommendAgentConfig({
      item: { effort: "S", sev: "annoyance" },
      capabilities: [],
      provider: "claude",
      config: CATALOG_CONFIG,
      history: [{ tier: "economy", usage: { input: 1, cachedRead: 1, cacheCreation: 0, output: 1 } }],
    });
    expect(rec!.estTokens).toBe(20_000 + 350_000 + 10_000 + 20_000);
  });
});
