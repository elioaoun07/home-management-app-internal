import { describe, expect, it } from "vitest";
import {
  bareTitle,
  deliveredIds,
  groupDelivery,
  historyCounts,
} from "../../scripts/pm/app/deliveryHomeModel";
import type {
  RunSummary,
  StewardRequest,
  V2Queue,
  V2RunSummary,
} from "../../scripts/pm/app/types";

const at = "2026-10-24T13:00:00.000Z";
const run = (run_id: string, extra: Partial<V2RunSummary> = {}): V2RunSummary =>
  ({
    run_id,
    engine: "v2",
    title: `${run_id} Title`,
    alias: run_id,
    file: null,
    campaign: "Budget",
    lifecycle: "RUNNING",
    closed_outcome: null,
    waiting_reason: null,
    executor: "codex",
    model: null,
    effort: null,
    stage: "x",
    branch: null,
    active: false,
    ownerAction: "Working",
    ownerActionKind: "none",
    ...extra,
  }) as V2RunSummary;
const request = (
  command_id: string,
  extra: Partial<StewardRequest> = {},
): StewardRequest => ({
  command_id,
  initiatedBy: "Owner",
  actor: "owner",
  file: "Delivery/4 - Checklist.md",
  workId: "DLV-1",
  acceptedAt: at,
  startedAt: at,
  lastConfirmedAt: at,
  staleAfterMs: 180000,
  stage: "readiness",
  status: "pending",
  terminal: false,
  run_id: null,
  jobUpdatedAt: null,
  blocker: null,
  evidence: [],
  result: null,
  runEvidence: null,
  ...extra,
});
const queue = (extra: Partial<V2Queue> = {}): V2Queue => ({
  limits: { maxWriters: 1, maxJobs: 1, fleetAllowance: null, unit: "usd" },
  writers: { used: 0, max: 1 },
  jobs: { used: 0, max: 1 },
  running: [],
  waiting: [],
  decisions: [],
  candidates: [],
  applying: null,
  pairs: [],
  unknown: { jobs: [], reservationsWithoutAmount: 0 },
  nativeAgents: 0,
  ...extra,
});
const item = (run_id: string) => ({
  run_id,
  alias: run_id,
  title: run_id + " Title",
  campaign: "Budget",
  executor: "codex",
  model: null,
  effort: null,
});
const keys = (rows: { key: string }[]) => rows.map((row) => row.key);

describe("Delivery home grouping", () => {
  it("lists a closed run awaiting Apply once, under Needs you, not in history", () => {
    const groups = groupDelivery({
      v2Runs: [run("BUD-83", { lifecycle: "CLOSED", closed_outcome: "verified_candidate" })],
      queue: queue({ decisions: [{ ...item("BUD-83"), kind: "apply", label: "Apply" }] }),
      requests: [],
      v1Runs: [],
    });
    expect(keys(groups.needs)).toEqual(["d:BUD-83"]);
    expect(groups.past).toEqual([]);
  });

  it("falls back to history when the queue is not loaded", () => {
    const groups = groupDelivery({
      v2Runs: [run("BUD-83", { lifecycle: "CLOSED", closed_outcome: "verified_candidate" })],
      requests: [],
      v1Runs: [],
    });
    expect(groups.needs).toEqual([]);
    expect(groups.past.map((entry) => entry.outcome)).toEqual(["apply"]);
  });

  it("splits open runs into progress and waiting, once each", () => {
    const groups = groupDelivery({
      v2Runs: [
        run("A-1"),
        run("B-2", { ownerActionKind: "waiting", ownerAction: "Waiting" }),
        run("C-3"),
      ],
      queue: queue({
        waiting: [{ ...item("C-3"), state: "queued", verdict: null, label: null, reasons: [], since: null, grew: [], released: false, sourceChanged: null }],
      }),
      requests: [],
      v1Runs: [],
    });
    expect(keys(groups.progress)).toEqual(["r:A-1"]);
    expect(keys(groups.waiting)).toEqual(["r:B-2", "r:C-3"]);
  });

  it("folds a launch receipt into its run row instead of a card", () => {
    const groups = groupDelivery({
      v2Runs: [run("R44", { lifecycle: "CLOSED", closed_outcome: "cancelled" })],
      requests: [
        request("c1", { run_id: "R44", terminal: true, status: "cancelled", initiatedBy: "ERA Steward" }),
        request("c2", { run_id: "R44", terminal: true, status: "completed" }),
      ],
      v1Runs: [],
    });
    expect(groups.past).toHaveLength(1);
    const row = groups.past[0].row;
    expect(row.kind === "v2" && row.request?.initiatedBy).toBe("ERA Steward");
    expect(keys(groups.progress)).toEqual([]);
  });

  it("keeps a receipt with no run visible: blocked needs the owner, pending is in progress", () => {
    const groups = groupDelivery({
      v2Runs: [],
      requests: [
        request("blocked", { status: "blocked" }),
        request("pending"),
        request("done", { terminal: true, status: "cancelled" }),
        request("failed", { terminal: true, status: "failed" }),
      ],
      v1Runs: [],
    });
    expect(keys(groups.needs)).toEqual(["q:blocked"]);
    expect(keys(groups.progress)).toEqual(["q:pending"]);
    expect(groups.past.map((entry) => entry.outcome)).toEqual(["cancelled", "other"]);
  });

  it("sorts V1 sessions by liveness", () => {
    const live = { sessionId: "s1", state: "RUNNING" } as RunSummary;
    const shipped = { sessionId: "s2", state: "SHIPPED" } as RunSummary;
    const groups = groupDelivery({ v2Runs: [], requests: [], v1Runs: [live, shipped] });
    expect(keys(groups.progress)).toEqual(["s:s1"]);
    expect(groups.past.map((entry) => entry.outcome)).toEqual(["accepted"]);
  });

  it("counts outcomes and names what is already delivered", () => {
    const groups = groupDelivery({
      v2Runs: [run("A-1"), run("Z-9", { lifecycle: "CLOSED", closed_outcome: "cancelled" })],
      requests: [request("p", { workId: "dlv-7" })],
      v1Runs: [],
    });
    expect(historyCounts(groups.past)).toMatchObject({ cancelled: 1, apply: 0 });
    expect([...deliveredIds(groups)].sort()).toEqual(["A-1", "DLV-7"]);
  });

  it("strips only a leading item id", () => {
    expect(bareTitle("BUD-83 Show the tag", "BUD-83")).toBe("Show the tag");
    expect(bareTitle("BUD-83: Show the tag", "bud-83")).toBe("Show the tag");
    expect(bareTitle("BUD-830 Other", "BUD-83")).toBe("BUD-830 Other");
    expect(bareTitle("Show BUD-83", "BUD-83")).toBe("Show BUD-83");
    expect(bareTitle("Plain", null)).toBe("Plain");
  });

  it("preserves a confirmed Apply decision when the queue is unavailable", () => {
    const groups = groupDelivery({ v2Runs: [run("R44", { lifecycle: "CLOSED", closed_outcome: "verified_candidate", ownerActionKind: "apply", ownerAction: "Apply" })], requests: [], v1Runs: [] });
    expect(keys(groups.needs)).toEqual(["r:R44"]);
    expect(groups.past).toEqual([]);
  });

  it("interleaves both engines by attempt date, newest first", () => {
    const groups = groupDelivery({
      v2Runs: [run("R44", { lifecycle: "CLOSED", created_at: "2026-10-24T00:00:00Z" })], requests: [],
      v1Runs: [{ sessionId: "old", state: "CANCELLED", createdAt: "2026-07-01T00:00:00Z" }, { sessionId: "new", state: "CANCELLED", createdAt: "2026-10-25T00:00:00Z" }] as RunSummary[],
    });
    expect(groups.past.map(({ row }) => row.key)).toEqual(["s:new", "r:R44", "s:old"]);
  });
});
