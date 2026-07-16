import { describe, expect, it, vi } from "vitest";
import {
  ConfigError,
  DEFAULT_CONFIG,
  buildCapabilitiesPayload,
  getDefaultModel,
  getModelInfo,
  getModelPricing,
  getProviderConfig,
  getRoutingEffort,
  isKnownEffort,
  isKnownModel,
  loadConfig,
  translateEffort,
} from "../../scripts/delivery/config.mjs";

function fakeFsWith(json: object | null) {
  return {
    existsSync: vi.fn(() => json !== null),
    readFileSync: vi.fn(() => JSON.stringify(json)),
  };
}

// config.mjs deliberately leaves loadConfig's shape loosely typed (JSDoc
// `@returns {object}`, matching the house pattern noted in run-session.test.ts
// for buildPacket) since the owner-edited catalog is meant to stay fluid
// across DW-2+. Tests cast to a narrow local shape instead of tightening the
// source's inference.
type TestModelEntry = { id: string; label?: string; contextWindow?: number; pricing?: { inPerMTok: number; cachedReadPerMTok: number; cacheWritePerMTok: number; outPerMTok: number } };
type TestProviderConfig = { defaultModel: string | null; efforts: string[]; models: TestModelEntry[] };
type TestConfig = {
  schemaVersion: number;
  pricingVersion: string | null;
  providers: Record<string, TestProviderConfig>;
  effortMap: Record<string, Record<string, string>>;
  routing: Record<string, { effort: string }>;
  context: Record<string, unknown>;
  transcript: Record<string, unknown>;
  budgets: Record<string, unknown>;
};
function loadTestConfig(rootDir: string, options: object): TestConfig {
  return loadConfig(rootDir, options) as unknown as TestConfig;
}
type TestCapabilities = {
  providers: Record<string, { manifest: unknown; defaultModel: string | null; models: TestModelEntry[]; efforts: string[] }>;
  config: { routing: Record<string, { effort: string }>; pricingVersion: string | null };
};
function asCapabilities(payload: unknown): TestCapabilities {
  return payload as TestCapabilities;
}

describe("loadConfig", () => {
  it("returns DEFAULT_CONFIG unchanged when the file is absent", () => {
    const fs = fakeFsWith(null);
    expect(loadConfig("/root", { fs })).toBe(DEFAULT_CONFIG);
  });

  it("deep-merges owner overrides over defaults, filling gaps", () => {
    const fs = fakeFsWith({
      providers: { claude: { defaultModel: "claude-sonnet-5", models: [{ id: "claude-sonnet-5" }] } },
    });
    const config = loadTestConfig("/root", { fs });
    expect(config.providers.claude.defaultModel).toBe("claude-sonnet-5");
    expect(config.providers.claude.models).toEqual([{ id: "claude-sonnet-5" }]);
    // untouched sections keep defaults
    expect(config.providers.codex.efforts).toEqual(DEFAULT_CONFIG.providers.codex.efforts);
    expect(config.routing.plan.effort).toBe("high");
  });

  it("replaces arrays wholesale rather than merging element-wise", () => {
    const fs = fakeFsWith({ providers: { claude: { efforts: ["low"] } } });
    const config = loadTestConfig("/root", { fs });
    expect(config.providers.claude.efforts).toEqual(["low"]);
  });

  it("throws ConfigError on a schemaVersion mismatch", () => {
    const fs = fakeFsWith({ schemaVersion: 2 });
    expect(() => loadConfig("/root", { fs })).toThrow(ConfigError);
  });

  it("accepts a matching schemaVersion", () => {
    const fs = fakeFsWith({ schemaVersion: 1, pricingVersion: "2026-07-16" });
    const config = loadTestConfig("/root", { fs });
    expect(config.pricingVersion).toBe("2026-07-16");
  });

  it("uses configPath override when given", () => {
    const fs = fakeFsWith({ pricingVersion: "custom" });
    const config = loadTestConfig("/root", { fs, configPath: "/somewhere/else.json" });
    expect(config.pricingVersion).toBe("custom");
  });
});

describe("provider/model/effort lookups", () => {
  const config = loadTestConfig("/root", {
    fs: fakeFsWith({
      providers: {
        claude: {
          defaultModel: "claude-sonnet-5",
          models: [
            { id: "claude-haiku-4-5", label: "Haiku 4.5", contextWindow: 200000, pricing: { inPerMTok: 1, cachedReadPerMTok: 0.1, cacheWritePerMTok: 1.25, outPerMTok: 5 } },
            { id: "claude-sonnet-5", label: "Sonnet 5" },
          ],
        },
      },
    }),
  });

  it("getProviderConfig throws for an unknown provider", () => {
    expect(() => getProviderConfig(config, "bogus")).toThrow(ConfigError);
  });

  it("isKnownModel / isKnownEffort", () => {
    expect(isKnownModel(config, "claude", "claude-haiku-4-5")).toBe(true);
    expect(isKnownModel(config, "claude", "does-not-exist")).toBe(false);
    expect(isKnownEffort(config, "claude", "medium")).toBe(true);
    expect(isKnownEffort(config, "codex", "xhigh")).toBe(true);
    expect(isKnownEffort(config, "codex", "max")).toBe(false); // claude-only effort
  });

  it("getModelInfo / getModelPricing", () => {
    expect(getModelInfo(config, "claude", "claude-haiku-4-5")?.label).toBe("Haiku 4.5");
    expect(getModelInfo(config, "claude", "missing")).toBeNull();
    expect(getModelPricing(config, "claude", "claude-haiku-4-5")).toEqual({
      inPerMTok: 1, cachedReadPerMTok: 0.1, cacheWritePerMTok: 1.25, outPerMTok: 5,
    });
    expect(getModelPricing(config, "claude", "claude-sonnet-5")).toBeNull(); // no pricing entry
  });

  it("getDefaultModel", () => {
    expect(getDefaultModel(config, "claude")).toBe("claude-sonnet-5");
    expect(getDefaultModel(config, "codex")).toBeNull();
  });

  it("getRoutingEffort returns the configured per-phase default", () => {
    expect(getRoutingEffort(config, "plan")).toBe("high");
    expect(getRoutingEffort(config, "discovery")).toBe("medium");
    expect(getRoutingEffort(config, "bogus-phase")).toBeNull();
  });
});

describe("translateEffort", () => {
  it("is the identity when providers match", () => {
    expect(translateEffort(DEFAULT_CONFIG, "claude", "claude", "high")).toBe("high");
  });

  it("maps claude max -> codex xhigh (no direct codex 'max')", () => {
    expect(translateEffort(DEFAULT_CONFIG, "claude", "codex", "max")).toBe("xhigh");
  });

  it("maps codex minimal -> claude low", () => {
    expect(translateEffort(DEFAULT_CONFIG, "codex", "claude", "minimal")).toBe("low");
  });

  it("passes through an unmapped effort unchanged", () => {
    expect(translateEffort(DEFAULT_CONFIG, "claude", "codex", "unmapped-level")).toBe("unmapped-level");
  });
});

describe("buildCapabilitiesPayload", () => {
  it("merges driver manifests with the owner model/pricing catalog", () => {
    const config = loadTestConfig("/root", {
      fs: fakeFsWith({ providers: { claude: { defaultModel: "claude-sonnet-5", models: [{ id: "claude-sonnet-5" }] } } }),
    });
    const payload = asCapabilities(buildCapabilitiesPayload(config, { claude: { provider: "claude", supportsAbort: true } }));
    expect(payload.providers.claude.manifest).toEqual({ provider: "claude", supportsAbort: true });
    expect(payload.providers.claude.defaultModel).toBe("claude-sonnet-5");
    expect(payload.providers.codex.manifest).toBeNull();
    expect(payload.config.routing.plan.effort).toBe("high");
    expect(payload.config.pricingVersion).toBeNull();
  });
});
