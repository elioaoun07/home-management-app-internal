import { describe, expect, it } from "vitest";
import { sdkStatus } from "../../scripts/pm/app/ProviderStatus";
import { setupAttention } from "../../scripts/pm/app/setupAttention";
import type { Cockpit, Entity } from "../../scripts/pm/app/cockpitTypes";

describe("passive SDK status", () => {
  const fresh = { observedAt: 100_000, now: 100_100 };
  it("requires a measured boolean before showing installed or missing", () => {
    expect(sdkStatus(true, fresh)).toBe("installed");
    expect(sdkStatus(false, fresh)).toBe("missing");
    expect(sdkStatus(null, fresh)).toBe("unknown");
    expect(sdkStatus(undefined, fresh)).toBe("unknown");
    expect(sdkStatus(true, { ...fresh, observedAt: 0 })).toBe("unknown");
  });
  it("never retains green after failed, disconnected or expired observations", () => {
    expect(sdkStatus(true, { ...fresh, failed: true })).toBe("stale");
    expect(sdkStatus(true, { ...fresh, stale: true })).toBe("stale");
    expect(sdkStatus(true, { ...fresh, now: 145_001 })).toBe("stale");
    expect(sdkStatus(null, { ...fresh, stale: true })).toBe("unknown");
  });
});

function cockpit(entities: Entity[], conflicts: Cockpit["conflicts"] = []) {
  return {
    setup: { schema: "os/setup@1", fingerprint: "test", generatedAt: "2026-11-14T10:00:00Z", entities, relations: [], sources: [] },
    conflicts,
  };
}

describe("Setup attention", () => {
  it("does not treat judgment-only rules or informational baselines as missing guards", () => {
    const result = setupAttention(cockpit([
      { id: "HR-28", kind: "rule", level: "documented", enforcedBy: [] },
    ], [{ code: "BASELINE", severity: "info", source: "guard", message: "recorded count" }]));
    expect(result.needsAttention).toBe(false);
    expect(setupAttention(null).needsAttention).toBe(false);
  });
  it("signals actionable setup conflicts", () => {
    const result = setupAttention(cockpit([], [
      { code: "PARITY", severity: "warning", source: "guard", message: "Missing Codex guard" },
    ]));
    expect(result.needsAttention).toBe(true);
    expect(result.conflicts).toHaveLength(1);
  });
  it("finds missing intended guards and ignores retired rules", () => {
    const result = setupAttention(cockpit([
      { id: "HR-1", kind: "rule", level: "checked", enforcedBy: ["detector:missing"] },
      { id: "HR-2", kind: "rule", level: "blocked", enforcedBy: [] },
      { id: "HR-3", kind: "rule", level: "checked", enforcedBy: ["detector:disabled"] },
      { id: "HR-4", kind: "rule", level: "checked", enforcedBy: ["detector:active"] },
      { id: "HR-5", kind: "rule", level: "blocked", retired: true },
      { id: "detector:disabled", kind: "detector", disabled: true },
      { id: "detector:active", kind: "detector", level: "checked", fixtures: ["pass.json", "fail.json"] },
    ]));
    expect(result.missingGuards.map((rule) => rule.id)).toEqual(["HR-1", "HR-2", "HR-3"]);
    expect(result.needsAttention).toBe(true);
  });
});
