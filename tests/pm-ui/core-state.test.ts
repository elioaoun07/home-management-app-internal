import { describe, expect, it } from "vitest";
import { coreSessionState } from "../../scripts/pm/app/coreState";
import type {
  RunSummary,
  StewardRequest,
  V2RunSummary,
} from "../../scripts/pm/app/types";

const base = { needs: 0, running: 0, uncertain: false, v1Runs: [], v2Runs: [] };
const v1 = (state: string, updatedAt = "2026-11-14T10:00:00Z"): RunSummary => ({
  sessionId: `v1-${state}`,
  item: {},
  state,
  agent: "claude",
  updatedAt,
});
const v2 = (
  closed_outcome: string | null,
  updated_at = "2026-11-14T11:00:00Z",
  application: V2RunSummary["application"] = null,
): V2RunSummary => ({
  run_id: "r-1",
  engine: "v2",
  title: "Test",
  alias: "R104",
  file: null,
  campaign: null,
  lifecycle: "CLOSED",
  closed_outcome,
  waiting_reason: null,
  executor: "claude",
  model: null,
  effort: null,
  stage: "closed",
  branch: null,
  active: false,
  ownerAction: "Review result",
  application,
  created_at: "2026-11-14T09:00:00Z",
  updated_at,
});

describe("ERA core delivery state", () => {
  it("keeps a new Local failure or blocked launch grey even with unrelated owner UAT", () => {
    const failed = { ...v2("failed"), lane: "local" as const };
    expect(
      coreSessionState({ ...base, needs: 20, v2Runs: [failed] }).state,
    ).toBe("failed");
    expect(
      coreSessionState({ ...base, needs: 20, running: 1, v2Runs: [failed] })
        .state,
    ).toBe("running");
    const interrupted = {
      ...failed,
      lifecycle: "ACTIVE",
      closed_outcome: null,
      stage: "building",
    };
    expect(
      coreSessionState({ ...base, needs: 20, v2Runs: [interrupted] }),
    ).toMatchObject({ state: "failed", label: "Session interrupted" });
    const request = {
      status: "blocked",
      run_id: null,
      lastConfirmedAt: "2026-11-14T12:00:00Z",
    } as StewardRequest;
    expect(
      coreSessionState({ ...base, needs: 20, requests: [request] }),
    ).toMatchObject({ state: "failed", label: "Launch blocked" });
    const newer = {
      ...failed,
      lifecycle: "ACTIVE",
      closed_outcome: null,
      stage: "uat-ready",
      updated_at: "2026-11-14T13:00:00Z",
    };
    expect(
      coreSessionState({
        ...base,
        needs: 1,
        v2Runs: [newer],
        requests: [request],
      }).state,
    ).toBe("attention");
    expect(
      coreSessionState({
        ...base,
        v2Runs: [{ ...failed, closed_outcome: "shipped" }],
      }),
    ).toMatchObject({ state: "success", label: "Shipped" });
  });
  it("prioritizes observed execution over unrelated attention and preserves uncertainty", () => {
    expect(
      coreSessionState({ ...base, needs: 26, running: 1, uncertain: true }),
    ).toMatchObject({
      state: "running",
      value: 1,
      detail: "Status incomplete",
    });
    expect(
      coreSessionState({ ...base, needs: 26, uncertain: true }),
    ).toMatchObject({ state: "attention", value: 26 });
    expect(
      coreSessionState({
        ...base,
        uncertain: true,
        v2Runs: [v2("verified_candidate")],
      }).state,
    ).toBe("unknown");
    expect(coreSessionState(base).state).toBe("idle");
  });

  it("only marks explicit successful terminal results green with honest labels", () => {
    expect(
      coreSessionState({ ...base, v1Runs: [v1("SHIPPED")] }),
    ).toMatchObject({ state: "success", label: "Shipped" });
    expect(
      coreSessionState({ ...base, v2Runs: [v2("verified_candidate")] }),
    ).toMatchObject({ state: "success", label: "Candidate verified" });
    expect(
      coreSessionState({
        ...base,
        v2Runs: [
          v2("verified_candidate", undefined, {
            application_id: "a",
            state: "applied",
          }),
        ],
      }),
    ).toMatchObject({ state: "success", label: "Applied" });
    expect(coreSessionState({ ...base, v1Runs: [v1("ACCEPTED")] }).state).toBe(
      "idle",
    );
  });

  it("latest cancellation, partial or unknown results suppress older successes", () => {
    for (const outcome of [
      "cancelled",
      "useful_partial",
      "unrecognized",
      null,
    ]) {
      expect(
        coreSessionState({
          ...base,
          v1Runs: [v1("SHIPPED")],
          v2Runs: [v2(outcome)],
        }).state,
      ).toBe("unknown");
    }
    expect(coreSessionState({ ...base, v1Runs: [v1("CANCELLED")] }).state).toBe(
      "unknown",
    );
  });

  it("uses the latest terminal update across engines and exposes explicit failed checks", () => {
    expect(
      coreSessionState({
        ...base,
        v1Runs: [v1("FAILED")],
        v2Runs: [v2("verified_candidate")],
      }).state,
    ).toBe("success");
    expect(
      coreSessionState({
        ...base,
        v1Runs: [v1("SHIPPED")],
        v2Runs: [v2("failed")],
      }).state,
    ).toBe("failed");
    expect(
      coreSessionState({
        ...base,
        v2Runs: [
          v2("verified_candidate", undefined, {
            application_id: "a",
            state: "checks-failed",
          }),
        ],
      }),
    ).toMatchObject({ state: "failed", label: "Checks failed" });
    for (const state of [
      "checks-pending",
      "checks-inconclusive",
      "rolled-back",
      "interrupted",
      "conflict",
    ]) {
      expect(
        coreSessionState({
          ...base,
          v2Runs: [
            v2("verified_candidate", undefined, { application_id: "a", state }),
          ],
        }).state,
      ).toBe("unknown");
    }
  });

  it("refuses an invented latest result when timestamps are missing, invalid or mixed ties", () => {
    for (const stamp of ["", "invalid"]) {
      expect(
        coreSessionState({
          ...base,
          v1Runs: [v1("FAILED", stamp)],
          v2Runs: [v2("verified_candidate")],
        }).state,
      ).toBe("unknown");
    }
    expect(
      coreSessionState({
        ...base,
        v1Runs: [v1("FAILED", "2026-11-14T11:00:00Z")],
        v2Runs: [v2("verified_candidate")],
      }).state,
    ).toBe("unknown");
    expect(
      coreSessionState({
        ...base,
        v1Runs: [v1("SHIPPED", "2026-11-14T11:00:00Z")],
        v2Runs: [v2("verified_candidate")],
      }),
    ).toMatchObject({ state: "success", label: "Completed" });
  });
});
