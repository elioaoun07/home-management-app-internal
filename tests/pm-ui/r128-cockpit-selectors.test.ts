import { describe, expect, it } from "vitest";
import {
  cockpitCounts,
  sessionEvidenceGaps,
  setupConflictCount,
} from "../../scripts/pm/app/cockpitModel";
import type { Flight } from "../../scripts/pm/app/cockpitTypes";
import { buildWorld } from "../../scripts/pm/app/model";
import { sessionBoard } from "../../scripts/pm/app/sessionBoardModel";
import type {
  StewardRequest,
  V2Queue,
  V2RunSummary,
} from "../../scripts/pm/app/types";
import { sessionScorecard } from "../../scripts/os/scorecard.mjs";

const at = "2026-11-14T12:00:00Z";
const world = () => buildWorld({ files: [], generatedAt: at });
function run(run_id: string, extra: Partial<V2RunSummary> = {}): V2RunSummary {
  return {
    run_id,
    engine: "v2",
    alias: "BUD-1",
    campaign: "Budget",
    file: "Budget/4 - Checklist.md",
    title: "BUD-1 Example",
    lifecycle: "ACTIVE",
    closed_outcome: null,
    waiting_reason: null,
    executor: "codex",
    model: "fixture",
    effort: "medium",
    stage: "Build",
    branch: null,
    active: true,
    ownerAction: "Working",
    ownerActionKind: "none",
    created_at: at,
    updated_at: at,
    ...extra,
  };
}
function request(command_id: string, extra: Partial<StewardRequest> = {}): StewardRequest {
  return {
    command_id,
    initiatedBy: "Owner",
    actor: "owner",
    file: "Budget/4 - Checklist.md",
    workId: "BUD-1",
    acceptedAt: at,
    startedAt: null,
    lastConfirmedAt: at,
    staleAfterMs: 60_000,
    stage: "queued",
    status: "queued",
    terminal: false,
    run_id: null,
    jobUpdatedAt: null,
    blocker: null,
    evidence: [],
    result: null,
    runEvidence: null,
    ...extra,
  };
}
function flight(extra: Partial<Flight["session"]> = {}): Flight {
  return {
    session: {
      id: "recorded-job",
      agent: "codex",
      itemId: "BUD-1",
      startedAt: at,
      endedAt: at,
      base: "base-commit",
      head: "head-commit",
      coverage: "transcript",
      skills: [],
      reads: [],
      timeline: [],
      usage: {},
      turns: 1,
      outcome: "unrecorded",
      changeFacts: [],
      ...extra,
    },
    events: [],
    checks: ["typecheck", "lint", "test", "pm:lint", "docs:check", "os:check"].map((name) => ({
      id: name,
      name,
      source: "supervisor",
      exitCode: 0,
    })),
    verdicts: [],
  };
}
function scored(record: Flight): Flight {
  return {
    ...record,
    session: {
      ...record.session,
      scorecard: sessionScorecard(record, record.session.changeFacts ?? null),
    },
  };
}

describe("R128 shared cockpit counts", () => {
  it("counts errors and warnings consistently while keeping notes out of conflicts", () => {
    const conflicts = [
      { severity: "error" },
      { severity: "warning" },
      ...Array.from({ length: 12 }, () => ({ severity: "info" })),
    ];
    expect(setupConflictCount(conflicts)).toBe(2);
    expect(setupConflictCount([{ severity: "info" }])).toBe(0);
    expect(setupConflictCount([])).toBe(0);
  });

  it("uses deduplicated session-board lanes and adds standing decisions exactly once", () => {
    const waiting = run("owner-question", {
      active: false,
      ownerAction: "Answer question",
      ownerActionKind: "question",
    });
    const queue: V2Queue = {
      limits: { maxWriters: 1, maxJobs: 1, fleetAllowance: null, unit: "tokens" },
      writers: { used: 1, max: 1 },
      jobs: { used: 1, max: 1 },
      running: [],
      waiting: [],
      decisions: [{
        run_id: waiting.run_id,
        alias: waiting.alias,
        title: waiting.title,
        campaign: waiting.campaign,
        executor: waiting.executor,
        model: waiting.model,
        effort: waiting.effort,
        kind: "question",
        label: "Answer question",
      }],
      candidates: [],
      applying: null,
      pairs: [],
      unknown: { jobs: [], reservationsWithoutAmount: 0 },
      nativeAgents: 1,
    };
    const board = sessionBoard({
      world: world(),
      statusKnown: true,
      recordsKnown: true,
      v2: [waiting, run("working")],
      queue,
      requests: [
        request("linked-request", { run_id: waiting.run_id, status: "running" }),
        request("blocked-request", { status: "blocked" }),
        request("undispatched", { status: "running" }),
      ],
      records: [
        flight({ id: "job-one", runId: waiting.run_id }),
        flight({ id: "job-two", runId: waiting.run_id }),
      ],
    });
    const counts = cockpitCounts(board, 21);
    expect(counts).toEqual({ needs: 2, running: 1, decisions: 21, needsTotal: 23 });
    const needs = board.lanes.find((lane) => lane.id === "needs")!;
    expect(counts.needs).toBe(needs.cards.length);
    expect(needs.counts).toEqual({ sessions: 1, requests: 1, acceptance: 0 });
    expect(board.lanes.find((lane) => lane.id === "running")!.counts).toEqual({
      sessions: 1,
      requests: 0,
      acceptance: 0,
    });
    expect(needs.cards.find((card) => card.key === "v2:owner-question")!.recordIds).toEqual([
      "job-one",
      "job-two",
    ]);
  });

  it("keeps an empty known board at zero without inventing an active session", () => {
    const board = sessionBoard({ world: world(), statusKnown: true, records: [] });
    expect(cockpitCounts(board, 0)).toEqual({
      needs: 0,
      running: 0,
      decisions: 0,
      needsTotal: 0,
    });
  });
});

describe("R128 unknown session evidence", () => {
  it("names missing commit facts while retaining observed transcript and empty-diff facts", () => {
    const record = scored(flight({ base: null, head: null }));
    const before = JSON.stringify(record);
    const gaps = sessionEvidenceGaps(record);
    expect(gaps).toContain("No base commit");
    expect(gaps).toContain("No head commit");
    expect(gaps).not.toContain("Transcript not ingested");
    expect(gaps).not.toContain("Diff unrecorded");
    expect(gaps).not.toContain("No supervisor check results");
    expect(JSON.stringify(record)).toBe(before);
  });

  it("does not treat agent checks as independently recorded supervisor results", () => {
    const record = flight();
    record.checks = record.checks.map((check) => ({ ...check, source: "agent" }));
    const gaps = sessionEvidenceGaps(scored(record));
    expect(gaps).toContain("No supervisor check results");
    expect(gaps).not.toContain("No base commit");
    expect(gaps).not.toContain("No head commit");
  });

  it("names a missing scorecard and diff without inventing a verdict", () => {
    const record = flight({ changeFacts: null });
    const gaps = sessionEvidenceGaps(record);
    expect(gaps).toContain("No scorecard");
    expect(gaps).toContain("Diff unrecorded");
    expect(record.session.scorecard).toBeUndefined();
  });

  it("retains raw supervisor observations and names an absent coverage flag precisely", () => {
    const record = flight({ coverage: undefined });
    const gaps = sessionEvidenceGaps(record);
    expect(gaps).toContain("No scorecard");
    expect(gaps).toContain("Transcript coverage unrecorded");
    expect(gaps).not.toContain("Transcript not ingested");
    expect(gaps).not.toContain("No supervisor check results");
  });
});
