import { describe, expect, it } from "vitest";
import type { Cockpit, Entity, Setup } from "../../scripts/pm/app/cockpitTypes";
import { setupAttention } from "../../scripts/pm/app/setupAttention";
import {
  conflictPresentation,
  groupSetupConflicts,
  ruleCoverage,
  ruleTitle,
  setupCoverage,
} from "../../scripts/pm/app/setupModel";

function setup(entities: Entity[]): Setup {
  return {
    schema: "os/setup@1",
    generatedAt: "2026-11-14T10:00:00Z",
    fingerprint: "test",
    entities,
    relations: [],
    sources: [],
  };
}

const checkedRule: Entity = {
  id: "HR-22",
  kind: "rule",
  level: "checked",
  enforcedBy: ["detector:console"],
};
const detector: Entity = {
  id: "detector:console",
  kind: "detector",
  rule: "HR-22",
  enforces: ["HR-22"],
  type: "diff",
  level: "checked",
  fixtures: ["tests/os/fixtures/console.json"],
};

describe("Setup coverage", () => {
  it.each<[string, Entity | undefined]>([
    ["absent", undefined],
    ["disabled", { ...detector, disabled: true }],
    ["retired", { ...detector, retired: true }],
    ["unrecognized mechanism", { ...detector, kind: "skill" }],
    ["wrong declaration", { ...detector, enforces: ["HR-6"] }],
    ["unknown declaration", { ...detector, enforces: "unknown" }],
    ["wrong detector rule", { ...detector, rule: "HR-6" }],
    ["unrecognized detector type", { ...detector, type: "unknown" }],
    ["unknown detector level", { ...detector, level: "unknown" }],
    ["missing fixtures", { ...detector, fixtures: [] }],
  ])("flags a %s guard without counting it as automated", (_, guard) => {
    const current = setup([checkedRule, ...(guard ? [guard] : [])]);
    expect(ruleCoverage(checkedRule, current)).toBe("missing");
    expect(setupCoverage(current).automated).toBe(0);
    expect(setupAttention({ setup: current, conflicts: [] }).missingGuards)
      .toEqual([checkedRule]);
  });

  it("requires every declared mechanism to be present", () => {
    const rule = { ...checkedRule, enforcedBy: [detector.id, "hook:absent"] };
    expect(ruleCoverage(rule, setup([rule, detector]))).toBe("missing");
  });

  it("counts advisory detector checks while retaining their advisory metadata", () => {
    const advisory = { ...detector, level: "advisory" };
    const rule = { ...checkedRule, level: "reminded" };
    const current = setup([rule, advisory]);
    expect(ruleCoverage(rule, current)).toBe("checked");
    expect(setupCoverage(current).automated).toBe(1);
    expect(advisory.level).toBe("advisory");
  });

  it("keeps manual judgment and reminder coverage visible without a broken-guard alert", () => {
    const manual: Entity = {
      id: "HR-2", kind: "rule", level: "documented", enforcedBy: [],
      review: { required: true, reason: "Interaction judgment", verify: "Check single and double click", source: "CLAUDE.md" },
    };
    const reminded: Entity = {
      id: "HR-24", kind: "rule", level: "reminded", enforcedBy: ["hook:reminder"],
    };
    const current = setup([
      manual,
      reminded,
      { id: "hook:reminder", kind: "hook", blocking: false, enforces: ["HR-24"] },
    ]);
    expect(ruleCoverage(manual, current)).toBe("documented");
    expect(ruleCoverage(reminded, current)).toBe("reminded");
    expect(setupCoverage(current)).toMatchObject({ manual: 2, automated: 0 });
    expect(setupAttention({ setup: current, conflicts: [] }).needsAttention)
      .toBe(false);
  });

  it("requires a mechanism for claimed automated protection and excludes inactive rules", () => {
    const current = setup([
      { id: "HR-1", kind: "rule", level: "checked" },
      { id: "HR-2", kind: "rule", level: "blocked", retired: true },
      { id: "HR-3", kind: "rule", level: "blocked", disabled: true },
      { id: "MR-example-1", kind: "rule", level: "documented" },
    ]);
    expect(setupCoverage(current)).toMatchObject({ missing: 1, automated: 0 });
    expect(setupCoverage(current).rules).toHaveLength(1);
  });

  it("recognizes blocking hooks and retains declared links in older snapshots", () => {
    const rule: Entity = { id: "HR-11", kind: "rule", level: "blocked", enforcedBy: ["hook:protected"] };
    expect(ruleCoverage(rule, setup([
      rule, { id: "hook:protected", kind: "hook", blocking: true },
    ]))).toBe("blocked");
  });

  it("uses the detector when a stop guard can only block once", () => {
    const rule = { ...checkedRule, enforcedBy: [detector.id, "hook:stop"] };
    const current = setup([
      rule, detector,
      { id: "hook:stop", kind: "hook", blocking: true, conditional: true },
    ]);
    expect(ruleCoverage(rule, current)).toBe("checked");
  });

  it("recognizes a configured check's explicit verification level", () => {
    const rule = { ...checkedRule, enforcedBy: ["check:console"] };
    const current = setup([
      rule,
      { id: "check:console", kind: "check", level: "checked", enforces: [rule.id] },
    ]);
    expect(ruleCoverage(rule, current)).toBe("checked");
    expect(setupAttention({ setup: current, conflicts: [] }).missingGuards).toEqual([]);
  });

  it("makes rule titles readable while preserving code identifiers", () => {
    expect(ruleTitle({ id: "MR-example-1", kind: "rule", title: "Use `get_schedule_bundle()` and [shared helpers](src/lib/helper.ts)" }))
      .toBe("Use get_schedule_bundle() and shared helpers");
    expect(ruleTitle({ id: "HR-99", kind: "rule" })).toBe("HR-99");
    expect(ruleTitle({ id: "MR-example-2", kind: "rule", title: "**Keep source identity** — Detailed instructions remain in evidence." }))
      .toBe("Keep source identity");
    expect(ruleTitle({ id: "MR-nfc-1", kind: "rule", title: "**Hard Rule:** Use readable slugs for tag URLs." }))
      .toBe("Use readable slugs for tag URLs.");
    expect(ruleTitle({ id: "HR-1", kind: "rule", title: "ALL toasts must have an Undo button. A long example follows." }))
      .toBe("Undo on toasts");
  });
});

describe("Setup conflict presentation", () => {
  const conflicts: Cockpit["conflicts"] = [
    { code: "MIRROR", severity: "error", source: "AGENTS.md", message: "Differs" },
    { code: "PARITY", severity: "warning", source: "guard", message: "Missing" },
    { code: "FORM-MISSING", severity: "info", source: "skill", message: "Optional form" },
    { code: "FUTURE", severity: "unknown", source: "guard", message: "New finding" },
  ];

  it("keeps information outside the attention count and retains unknown findings for review", () => {
    expect(groupSetupConflicts(conflicts)).toEqual({
      errors: [conflicts[0]], warnings: [conflicts[1], conflicts[3]], info: [conflicts[2]],
    });
    expect(setupAttention({ setup: setup([]), conflicts }).conflicts).toHaveLength(3);
  });

  it("provides the real recovery command for stale and generated setup", () => {
    expect(conflictPresentation(conflicts[0]).command).toBe("pnpm sync:ai");
    expect(conflictPresentation({ ...conflicts[0], code: "DRIFT" }).command)
      .toBe("pnpm os:scan");
    expect(conflictPresentation(conflicts[3]).title).toBe("Setup needs review");
  });

  it("uses the scanner's specific resolution when it is available", () => {
    expect(conflictPresentation({ ...conflicts[0], resolution: "Restore the canonical source first" }).action)
      .toBe("Restore the canonical source first");
  });
});
