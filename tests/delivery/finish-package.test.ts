// DLV-12 unit tests: the finish package's pure half — ownership classification,
// remaining-work extraction, the risk register, and the display-only recovery text.
import { describe, expect, it } from "vitest";

import {
  buildFinishPackage,
  buildOwnershipManifest,
  buildRemainingWork,
  buildRiskRegister,
  renderRecoveryMd,
} from "../../scripts/delivery/finish-package.mjs";
import { initAcceptance, waiveAcceptance } from "../../scripts/delivery/acceptance.mjs";

const PACKET = {
  sessionId: "s-20260101-000000-test",
  item: { id: "BUD-11", text: "Convert the remaining occurrences", effort: "S" },
};

const PLAN = {
  steps: [
    { id: "S1", description: "one", paths: ["a.ts"], validationHint: "test" },
    { id: "S2", description: "two", paths: ["b.ts"], validationHint: "test" },
    { id: "S3", description: "three", paths: ["c.ts"], validationHint: "test" },
  ],
  riskFlags: ["db-migration"],
};

function stateWith(extra: Record<string, unknown> = {}) {
  return {
    state: "BLOCKED",
    workspace: { baseHead: "abc123", dirtyAtStart: false, changedFiles: [], preExistingChanges: [] },
    usage: { perPhase: {}, total: { costUsd: 0.53 } },
    acceptance: [],
    ...extra,
  };
}

describe("buildOwnershipManifest", () => {
  it("marks a file that was already dirty at launch as shared, not own", () => {
    // Reverting a shared file would destroy the owner's own uncommitted work —
    // this distinction is the entire reason the manifest exists.
    const manifest = buildOwnershipManifest(
      stateWith({
        workspace: {
          baseHead: "abc123", dirtyAtStart: true,
          changedFiles: ["src/a.ts", "src/b.ts"],
          preExistingChanges: [{ path: "src/b.ts", ownership: "not-session-owned" }],
        },
      }),
    );
    expect(manifest.files).toEqual([
      { path: "src/a.ts", ownership: "own" },
      { path: "src/b.ts", ownership: "shared" },
    ]);
    expect(manifest.dirtyAtStart).toBe(true);
  });

  it("handles a session that changed nothing", () => {
    expect(buildOwnershipManifest(stateWith()).files).toEqual([]);
  });
});

describe("buildRemainingWork", () => {
  it("reports the plan steps that never ran", () => {
    const remaining = buildRemainingWork(stateWith({ build: { mode: "plan", stepIndex: 1, totalSteps: 3 } }), PLAN);
    expect(remaining.planSteps.map((s: { id: string }) => s.id)).toEqual(["S2", "S3"]);
  });

  it("reports every step when the session never entered BUILDING", () => {
    expect(buildRemainingWork(stateWith(), PLAN).planSteps).toHaveLength(3);
  });

  it("reports no steps once BUILDING completed", () => {
    // `build` is nulled by the build.complete transition.
    expect(buildRemainingWork(stateWith({ build: null, state: "SHIPPED" }), PLAN).planSteps).toHaveLength(0);
  });

  it("lists unmet and failed criteria, and excludes met and waived ones", () => {
    const matrix = waiveAcceptance(
      initAcceptance([{ id: "AC1", text: "one" }, { id: "AC2", text: "two" }, { id: "AC3", text: "three" }]),
      ["AC1"],
    );
    matrix[1].status = "met";
    const remaining = buildRemainingWork(stateWith({ acceptance: matrix }), PLAN);
    expect(remaining.acceptanceCriteria.map((a: { id: string }) => a.id)).toEqual(["AC3"]);
  });

  it("says so plainly when nothing is left", () => {
    expect(buildRemainingWork(stateWith({ build: null, state: "SHIPPED" }), { steps: [] }).summary).toMatch(/Nothing recorded/);
  });
});

describe("buildRiskRegister", () => {
  it("flags an incomplete exit, shared ownership, red validation and unmet criteria together", () => {
    const risks = buildRiskRegister({
      state: stateWith({
        workspace: {
          baseHead: "abc", dirtyAtStart: true,
          changedFiles: ["src/b.ts"], preExistingChanges: [{ path: "src/b.ts" }],
        },
        acceptance: initAcceptance([{ id: "AC1", text: "one" }]),
      }),
      packet: PACKET,
      spec: null,
      plan: PLAN,
      validation: { passes: false, results: { typecheck: { ok: false } } },
      review: null,
      reason: "blocked",
    });
    const codes = risks.map((r) => r.code);
    expect(codes).toContain("incomplete-exit");
    expect(codes).toContain("shared-ownership");
    expect(codes).toContain("validation-red");
    expect(codes).toContain("acceptance-incomplete");
    expect(codes).toContain("risk-flag:db-migration");
  });

  it("records a governed validation skip with its reason", () => {
    const risks = buildRiskRegister({
      state: stateWith(),
      packet: PACKET, spec: null, plan: null, review: null, reason: "shipped",
      validation: { passes: true, results: { lint: { ok: true, skipped: true, reason: "not in this lane's validation ladder" } } },
    });
    expect(risks.find((r) => r.code === "validation-skipped")?.detail).toContain("lane's validation ladder");
  });

  it("does not cry incomplete-exit on a shipped session", () => {
    const risks = buildRiskRegister({
      state: stateWith({ state: "SHIPPED" }), packet: PACKET, spec: null, plan: null, validation: null, review: null, reason: "shipped",
    });
    expect(risks.map((r) => r.code)).not.toContain("incomplete-exit");
  });
});

describe("renderRecoveryMd", () => {
  it("is explicit that nothing runs these commands", () => {
    const state = stateWith({ workspace: { baseHead: "abc", dirtyAtStart: false, changedFiles: ["src/a.ts"], preExistingChanges: [] } });
    const md = renderRecoveryMd({ state, packet: PACKET, manifest: buildOwnershipManifest(state), reason: "blocked" });
    expect(md).toContain("never performs a git write");
    expect(md).toContain("git checkout -- src/a.ts");
  });

  it("warns against blind reverts of shared files and offers a diff instead", () => {
    const state = stateWith({
      workspace: { baseHead: "abc", dirtyAtStart: true, changedFiles: ["src/b.ts"], preExistingChanges: [{ path: "src/b.ts" }] },
    });
    const md = renderRecoveryMd({ state, packet: PACKET, manifest: buildOwnershipManifest(state), reason: "blocked" });
    expect(md).toContain("Do not blindly revert");
    expect(md).toContain("git diff -- src/b.ts");
    expect(md).not.toContain("git checkout -- src/b.ts");
  });

  it("says there is nothing to revert when nothing changed", () => {
    const state = stateWith();
    const md = renderRecoveryMd({ state, packet: PACKET, manifest: buildOwnershipManifest(state), reason: "cancelled" });
    expect(md).toContain("changed no files");
  });
});

describe("buildFinishPackage", () => {
  it("emits every documented file", () => {
    const pkg = buildFinishPackage({ state: stateWith(), packet: PACKET, reason: "blocked", plan: PLAN });
    expect(pkg.files.map((f) => f.name).sort()).toEqual([
      "acceptance.json", "manifest.json", "recovery.md", "remaining-work.json", "risks.json", "risks.md", "summary.md",
    ]);
  });

  it("summarizes the exit for the owner without needing any other file", () => {
    const pkg = buildFinishPackage({ state: stateWith(), packet: PACKET, reason: "budget-exhausted", plan: PLAN });
    const summary = pkg.files.find((f) => f.name === "summary.md")?.text || "";
    expect(summary).toContain("Session paused — budget exhausted");
    expect(summary).toContain("BUD-11");
    expect(summary).toContain("$0.5300");
    expect(pkg.summary).toMatchObject({ reason: "budget-exhausted", finalState: "BLOCKED" });
  });
});
