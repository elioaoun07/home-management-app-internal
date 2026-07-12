import { describe, expect, it } from "vitest";
import { getAgent } from "../../scripts/delivery/agent-registry.mjs";
import {
  ALWAYS_ON_CAPABILITIES,
  CLASSIFIER_CAPABILITY_KEYS,
  ClassifyError,
  applyCapabilityDrops,
  assertClassifierKeysInRegistry,
  classify,
} from "../../scripts/delivery/classify.mjs";

type PacketOverrides = {
  item?: { text?: string; campaign?: string | null };
  scopeHints?: { keywords?: string[]; globs?: string[]; modules?: string[] };
};

function packet(overrides: PacketOverrides = {}) {
  return {
    item: { text: "x", campaign: null, ...overrides.item },
    scopeHints: { keywords: [], globs: [], modules: [], ...overrides.scopeHints },
  };
}

describe("assertClassifierKeysInRegistry", () => {
  it("passes for the real rule table (also runs once at module load)", () => {
    expect(assertClassifierKeysInRegistry()).toBe(true);
  });

  it("has no duplicate keys", () => {
    expect(new Set(CLASSIFIER_CAPABILITY_KEYS).size).toBe(CLASSIFIER_CAPABILITY_KEYS.length);
  });

  it("every classifier key resolves to an enabled Phase-1 registry row", () => {
    for (const key of CLASSIFIER_CAPABILITY_KEYS) {
      const agent = getAgent(key);
      expect(agent).not.toBeNull();
      expect(agent!.status).toBe("enabled");
      expect(agent!.phase).toBe("phase1");
    }
  });
});

describe("classify: always-on rows are always present", () => {
  it("includes automated-testing, code-review, uat-generation for any packet", () => {
    const caps = classify(packet({ item: { text: "totally unrelated filler text here" } }));
    const names = caps.map((c) => c.name);
    expect(names).toEqual(expect.arrayContaining(ALWAYS_ON_CAPABILITIES as unknown as string[]));
  });

  it("always-on rows carry blocking:true (registry blocking = blocking)", () => {
    const caps = classify(packet());
    for (const name of ALWAYS_ON_CAPABILITIES) {
      const cap = caps.find((c) => c.name === name);
      expect(cap?.blocking).toBe(true);
      expect(cap?.reason).toBe("always-on");
      expect(cap?.source).toBe("rule");
    }
  });

  it("minimal packet yields exactly the three always-on rows plus the vague-item rule", () => {
    // "x" is a single word — also triggers product-ba-refinement.
    const caps = classify(packet());
    expect(caps.map((c) => c.name).sort()).toEqual(
      ["automated-testing", "code-review", "product-ba-refinement", "uat-generation"].sort(),
    );
  });
});

describe("classify: product-ba-refinement (vague item)", () => {
  it("triggers under 8 words", () => {
    const caps = classify(packet({ item: { text: "Fix rounding drift" } }));
    expect(caps.map((c) => c.name)).toContain("product-ba-refinement");
  });

  it("does not trigger at exactly 8 words (the boundary)", () => {
    const caps = classify(
      packet({ item: { text: "This item has exactly eight distinct words total" } }),
    );
    expect(caps.map((c) => c.name)).not.toContain("product-ba-refinement");
  });

  it("does not trigger on empty text", () => {
    const caps = classify(packet({ item: { text: "" } }));
    expect(caps.map((c) => c.name)).not.toContain("product-ba-refinement");
  });

  it("is advisory, not blocking", () => {
    const caps = classify(packet({ item: { text: "Fix rounding drift" } }));
    expect(caps.find((c) => c.name === "product-ba-refinement")?.blocking).toBe(false);
  });
});

describe("classify: backend-impl", () => {
  it("triggers on an api glob", () => {
    const caps = classify(
      packet({
        item: { text: "long enough item text to skip the vague rule entirely here" },
        scopeHints: { globs: ["src/app/api/budget/**"] },
      }),
    );
    const cap = caps.find((c) => c.name === "backend-impl");
    expect(cap?.reason).toBe("api glob");
    expect(cap?.blocking).toBe(false);
  });

  it("triggers on an api keyword without an api glob", () => {
    const caps = classify(
      packet({
        item: { text: "long enough item text to skip the vague rule entirely here" },
        scopeHints: { keywords: ["cron job"] },
      }),
    );
    expect(caps.find((c) => c.name === "backend-impl")?.reason).toBe("api keyword");
  });

  it("does not trigger without a glob or keyword match", () => {
    const caps = classify(
      packet({ item: { text: "long enough item text to skip the vague rule entirely here" } }),
    );
    expect(caps.map((c) => c.name)).not.toContain("backend-impl");
  });
});

describe("classify: frontend-impl", () => {
  it("triggers on a features/components/app glob that isn't under api", () => {
    const caps = classify(
      packet({
        item: { text: "long enough item text to skip the vague rule entirely here" },
        scopeHints: { globs: ["src/features/budget/**"] },
      }),
    );
    expect(caps.map((c) => c.name)).toContain("frontend-impl");
  });

  it("does not treat an api glob as a frontend glob", () => {
    const caps = classify(
      packet({
        item: { text: "long enough item text to skip the vague rule entirely here" },
        scopeHints: { globs: ["src/app/api/budget/**"] },
      }),
    );
    expect(caps.map((c) => c.name)).not.toContain("frontend-impl");
  });

  it("can trigger both frontend-impl and backend-impl for a mixed-scope item", () => {
    const caps = classify(
      packet({
        item: { text: "long enough item text to skip the vague rule entirely here" },
        scopeHints: { globs: ["src/features/budget/**", "src/app/api/budget/**"] },
      }),
    );
    const names = caps.map((c) => c.name);
    expect(names).toContain("frontend-impl");
    expect(names).toContain("backend-impl");
  });
});

describe("classify: money-domain", () => {
  it("triggers for a Budget-campaign item with a money keyword", () => {
    const caps = classify(
      packet({
        item: {
          text: "long enough item text to skip the vague rule entirely here",
          campaign: "Budget",
        },
        scopeHints: { keywords: ["transfer"] },
      }),
    );
    const cap = caps.find((c) => c.name === "money-domain");
    expect(cap?.blocking).toBe(true);
  });

  it("does not trigger for a Budget item with no money keyword", () => {
    const caps = classify(
      packet({
        item: {
          text: "long enough item text to skip the vague rule entirely here",
          campaign: "Budget",
        },
      }),
    );
    expect(caps.map((c) => c.name)).not.toContain("money-domain");
  });

  it("does not trigger outside the Budget campaign even with a money keyword", () => {
    const caps = classify(
      packet({
        item: {
          text: "long enough item text to skip the vague rule entirely here transaction",
          campaign: "Schedule",
        },
      }),
    );
    expect(caps.map((c) => c.name)).not.toContain("money-domain");
  });
});

describe("applyCapabilityDrops", () => {
  const caps = classify(
    packet({
      item: { text: "long enough item text to skip the vague rule entirely here" },
      scopeHints: { globs: ["src/features/budget/**"] },
    }),
  );

  it("drops an optional row", () => {
    const dropped = applyCapabilityDrops(caps, ["frontend-impl"]);
    expect(dropped.map((c) => c.name)).not.toContain("frontend-impl");
  });

  it("rejects dropping any locked always-on row", () => {
    for (const name of ALWAYS_ON_CAPABILITIES) {
      expect(() => applyCapabilityDrops(caps, [name])).toThrow(ClassifyError);
    }
  });

  it("is a no-op with an empty drop list", () => {
    expect(applyCapabilityDrops(caps, [])).toEqual(caps);
  });
});
