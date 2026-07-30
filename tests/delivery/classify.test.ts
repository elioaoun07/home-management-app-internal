import { describe, expect, it } from "vitest";
import { getAgent } from "../../scripts/delivery/agent-registry.mjs";
import {
  ALWAYS_ON_CAPABILITIES,
  CLASSIFIER_CAPABILITY_KEYS,
  ClassifyError,
  applyCapabilityDrops,
  assertClassifierKeysInRegistry,
  classify,
  isTrivialLaunchCandidate,
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
  it("triggers when a money-logic path is actually in scope", () => {
    const caps = classify(
      packet({
        item: {
          text: "long enough item text to skip the vague rule entirely here",
          campaign: "Budget",
        },
        scopeHints: { globs: ["src/features/transfers/useTransfer.ts"] },
      }),
    );
    const cap = caps.find((c) => c.name === "money-domain");
    expect(cap?.blocking).toBe(true);
    expect(cap?.reason).toMatch(/money-logic path in scope/);
  });

  it("triggers when the item names a money operation", () => {
    const caps = classify(
      packet({
        item: {
          text: "Partner transfer posts the wrong balance on the receiving account after a rounding fix",
          campaign: "Budget",
        },
        scopeHints: { globs: ["src/components/expense/MobileExpenseForm.tsx"] },
      }),
    );
    expect(caps.find((c) => c.name === "money-domain")?.reason).toMatch(/money operation named in item/);
  });

  // DLV-42: the exact false positive that defeated the DLV-39 triage gate.
  // "quick-amount chip" is a UI noun; changing which preset a chip offers
  // touches no money math, and flagging it blocked the one gate built to keep
  // work this trivial out of the pipeline entirely.
  it("does NOT trigger on a money word embedded in a UI noun (DLV-42)", () => {
    const caps = classify(
      packet({
        item: {
          text: "[TEST] Mobile expense form quick-amount chip: replace the $25 preset with $20 → src/components/expense/MobileExpenseForm.tsx:1144",
          campaign: "Budget",
        },
        scopeHints: {
          keywords: ["mobile", "expense", "form", "quick-amount", "chip", "preset"],
          globs: ["src/components/expense/MobileExpenseForm.tsx"],
        },
      }),
    );
    expect(caps.map((c) => c.name)).not.toContain("money-domain");
  });

  it("does not let scope-hint keywords re-admit a prose-only match (DLV-42)", () => {
    // keywords are a mechanical split of the item's own words, so folding them
    // into the haystack would resurrect the substring rule this replaced.
    const caps = classify(
      packet({
        item: { text: "Tighten the amount input padding on small screens for the entry form", campaign: "Budget" },
        scopeHints: { keywords: ["amount", "transaction"], globs: ["src/components/expense/AmountInput.tsx"] },
      }),
    );
    expect(caps.map((c) => c.name)).not.toContain("money-domain");
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

describe("isTrivialLaunchCandidate (D11/DLV-39 hard triage gate)", () => {
  it("fires for an S-effort item with zero risk flags -- the DLV-28 smoke-test profile", () => {
    expect(isTrivialLaunchCandidate({ effort: "S" }, [])).toBe(true);
  });

  it("never fires for M/L-effort items, regardless of risk flags", () => {
    expect(isTrivialLaunchCandidate({ effort: "M" }, [])).toBe(false);
    expect(isTrivialLaunchCandidate({ effort: "L" }, [])).toBe(false);
  });

  it("never fires when a veto flag is present, even at S-effort", () => {
    // money-domain (registry `blocking`) and product-ba-refinement (fires
    // *because* the item is too vague to act on) both veto a refusal outright.
    const oneFile = { globs: ["src/a.tsx"], scopeSource: "item-paths" };
    expect(isTrivialLaunchCandidate({ effort: "S" }, [{ name: "money-domain" }], oneFile)).toBe(false);
    expect(isTrivialLaunchCandidate({ effort: "S" }, [{ name: "product-ba-refinement" }], oneFile)).toBe(false);
  });

  // DLV-59. The old rule was `riskFlags.length === 0`, which could never be true
  // for a UI item: every S-effort UI tweak in this repo carries `frontend-impl`.
  // BUD-14 (a one-character preset change) therefore launched and spent $0.5317
  // without writing a line of code. `frontend-impl`/`backend-impl` are routing
  // signals — the registry declares neither blocking nor advisory, and their
  // reasons are literally "frontend glob"/"api glob", i.e. where a file lives.
  describe("routing-only flags no longer defeat the gate (DLV-59)", () => {
    const bud14Scope = { globs: ["src/components/expense/MobileExpenseForm.tsx"], scopeSource: "item-paths" };

    it("fires for BUD-14's real profile: S-effort, one named file, only frontend-impl", () => {
      expect(isTrivialLaunchCandidate({ effort: "S" }, [{ name: "frontend-impl" }], bud14Scope)).toBe(true);
    });

    it("fires for a backend-impl-only item that names one file", () => {
      expect(
        isTrivialLaunchCandidate({ effort: "S" }, [{ name: "backend-impl" }], { globs: ["src/app/api/x/route.ts"], scopeSource: "item-paths" }),
      ).toBe(true);
    });

    it("does NOT fire when the item names several files — not knowably single-file", () => {
      expect(
        isTrivialLaunchCandidate({ effort: "S" }, [{ name: "frontend-impl" }], { globs: ["src/a.tsx", "src/b.tsx"], scopeSource: "item-paths" }),
      ).toBe(false);
    });

    it("does NOT fire when scope came from the campaign glob table, not the item", () => {
      // Silence is not evidence: campaign-table scope says nothing about this
      // item, so a flagged item with no named path is never refused.
      expect(
        isTrivialLaunchCandidate({ effort: "S" }, [{ name: "frontend-impl" }], { globs: ["src/features/budget/**"] }),
      ).toBe(false);
    });

    it("keeps the original zero-flag rule, which one-named-file cannot replace", () => {
      // The DLV-28 profile: a campaign with no glob table, so no optional
      // capability fires at all and no path is named. Narrowing the gate to
      // "exactly one named file" alone silently stopped refusing this.
      expect(isTrivialLaunchCandidate({ effort: "S" }, [], { globs: [], modules: ["Delivery 10x"] })).toBe(true);
    });
  });

  it("handles missing/malformed input without throwing", () => {
    expect(isTrivialLaunchCandidate(null, [])).toBe(false);
    expect(isTrivialLaunchCandidate({}, [])).toBe(false);
    expect(isTrivialLaunchCandidate({ effort: "S" })).toBe(true); // riskFlags defaults to []
  });
});
