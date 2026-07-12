import { describe, expect, it } from "vitest";
import {
  AGENT_REGISTRY,
  AgentRegistryError,
  PHASE1_STANDARD_KEYS,
  REQUIRED_FIELDS,
  assertRegistryIntegrity,
  getAgent,
  isEnabledForPhase1,
  listByPhase,
  listByStatus,
} from "../../scripts/delivery/agent-registry.mjs";

describe("registry completeness", () => {
  it("has 15 rows, one per roster agent", () => {
    expect(AGENT_REGISTRY.length).toBe(15);
  });

  it("every row has every required field, non-empty", () => {
    for (const agent of AGENT_REGISTRY) {
      const record = agent as unknown as Record<string, unknown>;
      for (const field of REQUIRED_FIELDS) {
        expect(agent).toHaveProperty(field);
        expect(record[field]).not.toBe("");
        expect(record[field]).not.toBeUndefined();
        expect(record[field]).not.toBeNull();
      }
    }
  });

  it("has no duplicate keys", () => {
    const keys = AGENT_REGISTRY.map((a) => a.key);
    expect(new Set(keys).size).toBe(keys.length);
  });

  it("assertRegistryIntegrity passes for the real roster", () => {
    expect(assertRegistryIntegrity()).toBe(true);
  });
});

describe("Phase 1 standard set (rows 1-8) is enabled; every later specialist is planned", () => {
  it("PHASE1_STANDARD_KEYS is exactly the rows-1-8 capability keys", () => {
    expect(PHASE1_STANDARD_KEYS).toEqual([
      "delivery-orchestrator",
      "product-ba-refinement",
      "frontend-impl",
      "backend-impl",
      "automated-testing",
      "code-review",
      "uat-generation",
      "money-domain",
    ]);
  });

  it("every phase1 row has status enabled", () => {
    for (const agent of listByPhase("phase1")) {
      expect(agent.status).toBe("enabled");
    }
  });

  it("every S5 and S6 row has status planned", () => {
    for (const agent of [...listByPhase("S5"), ...listByPhase("S6")]) {
      expect(agent.status).toBe("planned");
    }
  });

  it("listByStatus partitions the roster exactly (8 enabled, 7 planned)", () => {
    expect(listByStatus("enabled").length).toBe(8);
    expect(listByStatus("planned").length).toBe(7);
  });

  it("listByPhase counts: phase1=8, S5=6, S6=1", () => {
    expect(listByPhase("phase1").length).toBe(8);
    expect(listByPhase("S5").length).toBe(6);
    expect(listByPhase("S6").length).toBe(1);
  });
});

describe("getAgent / isEnabledForPhase1", () => {
  it("getAgent finds a row by key", () => {
    expect(getAgent("code-review")?.name).toBe("Code Reviewer (lite)");
  });

  it("getAgent returns null for an unknown key", () => {
    expect(getAgent("does-not-exist")).toBeNull();
  });

  it("isEnabledForPhase1 is true only for the standard set", () => {
    expect(isEnabledForPhase1("code-review")).toBe(true);
    expect(isEnabledForPhase1("delivery-orchestrator")).toBe(true);
    expect(isEnabledForPhase1("security-review")).toBe(false);
    expect(isEnabledForPhase1("release-rollback-prep")).toBe(false);
    expect(isEnabledForPhase1("does-not-exist")).toBe(false);
  });
});

describe("assertRegistryIntegrity catches synthetic breakage (injectable registry)", () => {
  const goodRow = AGENT_REGISTRY[0];

  it("throws on a missing required field", () => {
    const broken = [{ ...goodRow, purpose: undefined }];
    expect(() => assertRegistryIntegrity(broken as unknown as object[])).toThrow(AgentRegistryError);
  });

  it("throws on an empty-string required field", () => {
    const broken = [{ ...goodRow, name: "" }];
    expect(() => assertRegistryIntegrity(broken as unknown as object[])).toThrow(AgentRegistryError);
  });

  it("throws on a duplicate key", () => {
    const broken = [goodRow, { ...goodRow }];
    expect(() => assertRegistryIntegrity(broken as unknown as object[])).toThrow(/duplicate/);
  });

  it("throws when a phase1 row is not enabled", () => {
    const broken = [{ ...goodRow, phase: "phase1", status: "planned" }];
    expect(() => assertRegistryIntegrity(broken as unknown as object[])).toThrow(/must have status "enabled"/);
  });

  it("throws when a non-phase1 row is not planned", () => {
    const broken = [{ ...goodRow, phase: "S5", status: "enabled" }];
    expect(() => assertRegistryIntegrity(broken as unknown as object[])).toThrow(/must have status "planned"/);
  });
});
