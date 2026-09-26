// Command Center Phase 5 — queue and verdict labels (DLV-106). Pure: the server
// decides verdicts and reasons; these helpers only word them, in short clauses.
import { describe, expect, it } from "vitest";
import { applicationLabel, applyControls, coordinationStatus, queueSlots, reasonLabel, runningLabel, verdictLabel } from "../../scripts/pm/app/v2model";
import type { V2RunDetail } from "../../scripts/pm/app/types";

describe("coordination labels", () => {
  it("names the three verdicts and nothing else", () => {
    expect([verdictLabel("together"), verdictLabel("follow"), verdictLabel("scope"), verdictLabel(null)]).toEqual([
      "Ready",
      "Waiting",
      "Scope required",
      null,
    ]);
  });

  it("does not call a capacity-blocked run ready", () => {
    expect(
      coordinationStatus("together", [{ code: "fleet-resources", with: null }]),
    ).toBe("Allowance used");
    expect(
      coordinationStatus("together", [{ code: "writer-slots-full", with: null }, { code: "fleet-resources", with: null }]),
    ).toBe("Capacity full");
  });

  it("words each reason as one short clause naming the other item", () => {
    expect(reasonLabel({ code: "shared-contract", with: "BUD-16", paths: ["src/lib/money.ts"] })).toBe("Uses src/lib/money.ts · BUD-16");
    expect(reasonLabel({ code: "path-overlap", with: "BUD-15", paths: ["a.ts", "b.ts", "c.ts"] })).toBe("a.ts, b.ts +1 · BUD-15");
    expect(reasonLabel({ code: "dependency-open", with: "BUD-14" })).toBe("After BUD-14");
    expect(reasonLabel({ code: "dependency-cancelled", with: "BUD-8" })).toBe("BUD-8 cancelled");
    expect(reasonLabel({ code: "lockfile", with: "BUD-18", paths: ["package.json"] })).toBe("Dependencies · BUD-18");
    expect(reasonLabel({ code: "scope-unknown", with: "BUD-14", unknown: ["BUD-20"] })).toBe("Add file scope");
    expect(reasonLabel({ code: "writer-slots-full", with: null, used: 2, max: 2 })).toBe("Writers 2/2");
    expect(reasonLabel({ code: "check-resource", with: "BUD-1", resources: ["db:test"] })).toBe("Checks share db:test");
    expect(reasonLabel({ code: "future-reason", with: null })).toBe("future reason");
    for (const code of ["same-item", "held", "shared-schema", "generated-output", "source-moved", "job-slots-full", "fleet-resources"]) {
      expect(reasonLabel({ code, with: "X", paths: ["p"], used: 1, max: 1 }).length).toBeLessThan(40);
    }
  });

  it("shows writer and job slots always, unknown jobs and subagents only when present", () => {
    const base = { writers: { used: 2, max: 2 }, jobs: { used: 1, max: 3 }, unknown: { jobs: [], reservationsWithoutAmount: 0 }, nativeAgents: 0 };
    expect(queueSlots(base)).toEqual([
      { key: "writers", label: "Writers", value: "2/2", full: true },
      { key: "jobs", label: "Jobs", value: "1/3", full: false },
    ]);
    expect(queueSlots({ ...base, unknown: { jobs: [{ run_id: "r", job_id: "j" }], reservationsWithoutAmount: 0 }, nativeAgents: 2 }).map((slot) => slot.key)).toEqual([
      "writers",
      "jobs",
      "unknown",
      "subagents",
    ]);
  });

  it("labels what a running row is doing from the server's job", () => {
    expect(runningLabel({ writer: true, job_id: "j", access: "write", status: "active" })).toBe("Writing");
    expect(runningLabel({ writer: true, job_id: null, access: "write", status: "checking" })).toBe("Checking");
    expect(runningLabel({ writer: false, job_id: "j", access: "read-only", status: "active" })).toBe("Planning");
    expect(runningLabel({ writer: true, job_id: "j", access: "write", status: "unknown" })).toBe("Outcome unknown");
  });

  it("offers Apply again after a recheck on current source fails", () => {
    expect(applicationLabel("reassessment-failed")).toBe("Fails on current source");
    const detail = {
      run: { run_id: "r", lifecycle: "CLOSED", closed_outcome: "verified_candidate", waiting_reason: null, created_at: "", updated_at: "" },
      result: { result_id: "res", result_version: 1, candidateVerified: true } as V2RunDetail["result"],
      candidate: { candidate_id: "c", generation: "C1", changed: [], refusals: [] },
      applications: [{ application_id: "a", candidate_id: "c", state: "reassessment-failed" }] as V2RunDetail["applications"],
      ownerAction: { kind: "apply", label: "Apply" },
    } as Pick<V2RunDetail, "run" | "result" | "candidate" | "applications" | "ownerAction">;
    expect(applyControls(detail).canApply).toBe(true);
    expect(applyControls(detail).applyPrimary).toBe(true);
  });

  it("keeps a conflicted candidate retryable without making Apply the primary action", () => {
    // DLV-123 (4): DLV-107's conflicted candidate still led with a primary Apply.
    const detail = {
      run: { run_id: "r", lifecycle: "CLOSED", closed_outcome: "verified_candidate", waiting_reason: null, created_at: "", updated_at: "" },
      result: { result_id: "res", result_version: 1, candidateVerified: true } as V2RunDetail["result"],
      candidate: { candidate_id: "c", generation: "C1", changed: [], refusals: [] },
      applications: [{ application_id: "a", candidate_id: "c", state: "conflict" }] as V2RunDetail["applications"],
      ownerAction: { kind: "apply", label: "Apply" },
    } as Pick<V2RunDetail, "run" | "result" | "candidate" | "applications" | "ownerAction">;
    expect(applyControls(detail).canApply).toBe(true);
    expect(applyControls(detail).applyPrimary).toBe(false);
    expect(applyControls({ ...detail, applications: [] }).applyPrimary).toBe(true);
  });
});
