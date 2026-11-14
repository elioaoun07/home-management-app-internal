import { describe, expect, it } from "vitest";
import {
  pendingOwnerUat,
  sessionBoard,
} from "../../scripts/pm/app/sessionBoardModel";
import { buildWorld } from "../../scripts/pm/app/model";
import type { Flight } from "../../scripts/pm/app/cockpitTypes";
import type {
  RunSummary,
  StewardRequest,
  UatSummary,
  V2Queue,
  V2RunSummary,
} from "../../scripts/pm/app/types";

const world = (book = "", checklist = "") =>
  buildWorld({
    files: [
      { relPath: "Budget/Budget — Master Book.md", raw: book },
      { relPath: "Budget/4 - Checklist.md", raw: checklist },
    ],
    generatedAt: "2026-11-14T12:00:00Z",
  });
function run(extra: Partial<V2RunSummary> = {}): V2RunSummary {
  return {
    run_id: "run-1",
    engine: "v2",
    alias: "BUD-1",
    campaign: "Budget",
    file: "Budget/4 - Checklist.md",
    title: "BUD-1 · Example",
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
    created_at: "2026-11-14T10:00:00Z",
    updated_at: "2026-11-14T11:00:00Z",
    ...extra,
  };
}
function flight(
  id = "agent-1",
  extra: Partial<Flight["session"]> = {},
): Flight {
  return {
    session: {
      id,
      agent: "codex",
      itemId: "BUD-1",
      startedAt: "2026-11-14T10:00:00Z",
      skills: [],
      reads: [],
      timeline: [],
      usage: {},
      turns: 1,
      outcome: "unrecorded",
      ...extra,
    },
    events: [],
    checks: [],
    verdicts: [],
  };
}
function request(extra: Partial<StewardRequest> = {}): StewardRequest {
  return {
    command_id: "request-1",
    initiatedBy: "Owner",
    actor: "owner",
    file: "Budget/4 - Checklist.md",
    workId: "BUD-1",
    acceptedAt: "2026-11-14T10:00:00Z",
    startedAt: null,
    lastConfirmedAt: "2026-11-14T11:00:00Z",
    staleAfterMs: 60000,
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
function queue(extra: Partial<V2Queue> = {}): V2Queue {
  return {
    limits: { maxWriters: 1, maxJobs: 1, fleetAllowance: null, unit: "tokens" },
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
  };
}
function handover(extra: Partial<UatSummary> = {}): UatSummary {
  return {
    handover_id: "test-1",
    revision: 1,
    revisions: 1,
    status: "ready",
    subject: {
      type: "run",
      run_id: "run-1",
      delivery_ref: "run:run-1",
      work_id: "BUD-1",
      campaign: "Budget",
      title: "Example",
    },
    binding: null,
    environment: { target: "local", build: null, url: null, device: null },
    created_at: "2026-11-14T12:00:00Z",
    summary: "Test example",
    setup: "",
    limits: "",
    problems: [],
    counts: { pass: 1, fail: 0, blocked: 0, pending: 1 },
    availability: { state: "available", evidence: null },
    stale: false,
    acceptance: { state: "pending", shipped: false },
    signoff: null,
    signable: false,
    blockers: [],
    feedback: [],
    draft: null,
    staleDraft: false,
    draftRev: 0,
    supersededBy: null,
    scenarios: [
      {
        id: "one",
        title: "First",
        required: true,
        result: "pass",
        draft: false,
        steps: 1,
      },
      {
        id: "two",
        title: "Second",
        required: true,
        result: "pending",
        draft: false,
        steps: 2,
      },
    ],
    ...extra,
  };
}
const cards = (board: ReturnType<typeof sessionBoard>) =>
  board.lanes.flatMap((lane) => lane.cards);

describe("unified session board", () => {
  it("excludes ordinary backlog items and keeps explicit owner acceptance as its own unit", () => {
    const data = world(
      "### BUD-1\n**Outcome:** Example\n**Acceptance:** Works\n### BUD-2\n**Outcome:** Test the feature\n**UAT:** pending\n",
      "## Now\n- [ ] **BUD-1** Example _(friction - M)_\n",
    );
    const board = sessionBoard({ world: data, statusKnown: true });
    expect(board.counts).toEqual({ sessions: 0, requests: 0, acceptance: 1 });
    expect(cards(board)[0]).toMatchObject({
      lane: "uat",
      workId: "BUD-2",
      href: "#/uat-item/Budget/BUD-2",
    });
    expect(cards(board)[0].href).not.toContain("/read");
  });

  it("joins explicit run, request, recorder and UAT bindings while preserving separate sessions for the same item", () => {
    const board = sessionBoard({
      world: world(),
      statusKnown: true,
      v2: [
        run({
          active: false,
          lifecycle: "CLOSED",
          closed_outcome: "verified_candidate",
        }),
      ],
      requests: [request({ run_id: "run-1", status: "running" })],
      records: [
        flight("job-1", { runId: "run-1" }),
        flight("job-2", { runId: "run-1" }),
        flight("independent"),
      ],
      uat: [handover()],
    });
    expect(board.counts).toEqual({ sessions: 2, requests: 0, acceptance: 0 });
    const joined = cards(board).find((card) => card.key === "v2:run-1")!;
    expect(joined).toMatchObject({
      lane: "uat",
      href: "#/delivery/test/test-1?from=%2Fsessions",
      requestId: "request-1",
      testProgress: { done: 1, total: 2 },
    });
    expect(joined.recordIds).toEqual(["job-1", "job-2"]);
    expect(
      cards(board).find((card) => card.key === "record:independent")!.lane,
    ).toBe("unknown");
  });

  it("shows the observed lifecycle with explicit failed and cancelled outcomes", () => {
    const board = sessionBoard({
      world: world(),
      statusKnown: true,
      v2: [
        run(),
        run({
          run_id: "question",
          active: false,
          ownerActionKind: "question",
          ownerAction: "Answer question",
        }),
        run({
          run_id: "queued",
          active: false,
          ownerActionKind: "waiting",
          ownerAction: "Capacity full",
        }),
        run({
          run_id: "failed",
          active: false,
          lifecycle: "CLOSED",
          closed_outcome: "failed",
        }),
        run({
          run_id: "cancelled",
          active: false,
          lifecycle: "CLOSED",
          closed_outcome: "cancelled",
        }),
        run({
          run_id: "verified",
          active: false,
          lifecycle: "CLOSED",
          closed_outcome: "verified_candidate",
        }),
      ],
    });
    expect(cards(board).find((card) => card.key === "v2:run-1")).toMatchObject({
      lane: "running",
      stage: "Build",
    });
    expect(cards(board).find((card) => card.key === "v2:question")!.lane).toBe(
      "needs",
    );
    expect(cards(board).find((card) => card.key === "v2:queued")!.lane).toBe(
      "waiting",
    );
    expect(cards(board).find((card) => card.key === "v2:failed")).toMatchObject(
      { lane: "finished", status: "Failed", outcome: "failed" },
    );
    expect(
      cards(board).find((card) => card.key === "v2:cancelled")!.outcome,
    ).toBe("cancelled");
    expect(
      cards(board).find((card) => card.key === "v2:verified")!.status,
    ).toBe("Candidate verified");
  });

  it("retains stale observations and makes current uncertain jobs explicitly unconfirmed", () => {
    const stale = sessionBoard({
      world: world(),
      statusKnown: false,
      v2: [run()],
    });
    expect(cards(stale)[0]).toMatchObject({ lane: "running", lastKnown: true });
    expect(stale.lanes.find((lane) => lane.id === "running")!.known).toBe(
      false,
    );
    const uncertain = sessionBoard({
      world: world(),
      statusKnown: true,
      v2: [run()],
      queue: queue({
        unknown: {
          jobs: [{ run_id: "run-1", job_id: "job" }],
          reservationsWithoutAmount: 0,
        },
      }),
    });
    expect(cards(uncertain)[0]).toMatchObject({
      lane: "unknown",
      status: "Execution unconfirmed",
    });
  });

  it("keeps owner questions and Apply actionable while test instructions are being prepared", () => {
    for (const ownerActionKind of ["question", "apply"]) {
      for (const status of ["draft", "incomplete"] as const) {
        const board = sessionBoard({
          world: world(),
          statusKnown: true,
          v2: [
            run({
              active: false,
              ownerActionKind,
              ownerAction:
                ownerActionKind === "question" ? "Answer question" : "Apply",
            }),
          ],
          uat: [handover({ status })],
        });
        expect(cards(board)[0]).toMatchObject({
          lane: "needs",
          status: ownerActionKind === "question" ? "Answer question" : "Apply",
          action: "Review",
          href: "#/delivery/run/run-1?from=%2Fsessions",
          testStatus: "Test steps pending",
          testHref: "#/delivery/test/test-1?from=%2Fsessions",
        });
      }
    }
  });

  it("does not infer transcript completion from clean checks or recent recording", () => {
    const board = sessionBoard({
      world: world(),
      statusKnown: true,
      records: [flight(), flight("ended", { endedAt: "2026-11-14T11:00:00Z" })],
    });
    expect(
      cards(board).find((card) => card.key === "record:agent-1")!.lane,
    ).toBe("unknown");
    expect(
      cards(board).find((card) => card.key === "record:ended"),
    ).toMatchObject({
      lane: "finished",
      outcome: "unrecorded",
      status: "Ended · outcome unrecorded",
    });
  });

  it("groups orphan supervisor jobs by run and uses their latest explicit run outcome", () => {
    const board = sessionBoard({
      world: world(),
      statusKnown: true,
      records: [
        flight("old-job", {
          runId: "missing",
          endedAt: "2026-11-14T10:30:00Z",
          outcome: "ACTIVE",
        }),
        flight("new-job", {
          runId: "missing",
          startedAt: "2026-11-14T11:00:00Z",
          endedAt: "2026-11-14T12:00:00Z",
          outcome: "failed",
        }),
      ],
    });
    expect(board.counts.sessions).toBe(1);
    expect(cards(board)[0]).toMatchObject({
      lane: "finished",
      outcome: "failed",
      recordIds: ["old-job", "new-job"],
    });
    const active = sessionBoard({
      world: world(),
      statusKnown: true,
      records: [
        flight("job", {
          runId: "missing",
          endedAt: "2026-11-14T11:00:00Z",
          outcome: "ACTIVE",
        }),
      ],
    });
    expect(cards(active)[0].lane).toBe("unknown");
  });

  it("retains request controls and never calls an undispatched request a running session", () => {
    const board = sessionBoard({
      world: world(),
      statusKnown: true,
      requests: [
        request({ status: "running" }),
        request({ command_id: "blocked", status: "blocked" }),
      ],
    });
    expect(board.counts).toEqual({ sessions: 0, requests: 2, acceptance: 0 });
    expect(
      cards(board).find((card) => card.requestId === "request-1"),
    ).toMatchObject({ lane: "waiting", href: "#/sessions?request=request-1" });
    expect(
      cards(board).find((card) => card.requestId === "blocked")!.lane,
    ).toBe("needs");
  });

  it("deduplicates direct acceptance by item and retains accepted test results", () => {
    const direct = handover({
      subject: { ...handover().subject, type: "direct", run_id: null },
    });
    const data = world("### BUD-1\n**UAT:** pending\n");
    const board = sessionBoard({
      world: data,
      statusKnown: true,
      uat: [
        direct,
        {
          ...direct,
          handover_id: "accepted",
          created_at: "2026-11-15T10:00:00Z",
          acceptance: { state: "accepted", shipped: true },
        },
      ],
    });
    expect(board.counts).toEqual({ sessions: 0, requests: 0, acceptance: 1 });
    expect(cards(board)[0]).toMatchObject({
      lane: "finished",
      status: "Accepted",
      href: "#/delivery/test/accepted?from=%2Fsessions",
    });
  });

  it("keeps pending owner checks visible beside another active session for that work", () => {
    const board = sessionBoard({
      world: world("### BUD-1\n**UAT:** pending\n"),
      statusKnown: true,
      v2: [run()],
    });
    expect(board.counts).toEqual({ sessions: 1, requests: 0, acceptance: 1 });
  });

  it("a stale accepted handover cannot dismiss a pending current owner check", () => {
    const board = sessionBoard({
      world: world("### BUD-1\n**UAT:** pending\n"),
      statusKnown: true,
      uat: [
        handover({
          stale: true,
          acceptance: { state: "accepted", shipped: true },
          subject: { ...handover().subject, type: "direct", run_id: null },
        }),
      ],
    });
    expect(
      board.lanes.find((lane) => lane.id === "uat")!.counts.acceptance,
    ).toBe(1);
    expect(
      board.lanes.find((lane) => lane.id === "finished")!.counts.acceptance,
    ).toBe(1);
  });

  it("marks an expired request observation as last known even with a current run feed", () => {
    const board = sessionBoard({
      world: world(),
      statusKnown: true,
      requests: [request()],
      now: Date.parse("2026-11-14T12:00:00Z"),
    });
    expect(cards(board)[0].lastKnown).toBe(true);
  });

  it("preserves V1 owner gates and marks unknown runner state honestly", () => {
    const v1 = (id: string, extra: Partial<RunSummary> = {}): RunSummary => ({
      sessionId: id,
      item: { id: "BUD-1", campaign: "Budget" },
      agent: "claude",
      state: "BUILDING",
      ...extra,
    });
    const board = sessionBoard({
      world: world(),
      statusKnown: true,
      v1: [
        v1("unknown"),
        v1("running", { runnerAlive: true }),
        v1("review", { awaiting: { gate: "plan" } }),
        v1("uat", { state: "UAT_READY" }),
      ],
    });
    expect(cards(board).find((card) => card.key === "v1:unknown")!.lane).toBe(
      "unknown",
    );
    expect(cards(board).find((card) => card.key === "v1:running")!.lane).toBe(
      "running",
    );
    expect(cards(board).find((card) => card.key === "v1:review")!.lane).toBe(
      "needs",
    );
    expect(cards(board).find((card) => card.key === "v1:uat")!.href).toBe(
      "#/uat-item/Budget/BUD-1",
    );
  });

  it("ignores fenced UAT examples and arena sessions", () => {
    expect(
      pendingOwnerUat(world("### BUD-1\n```md\n**UAT:** pending\n```\n")),
    ).toEqual([]);
    const record = flight("arena", {
      arena: {
        caseId: "test",
        caseFingerprint: "fixture",
        start: "base",
        oracleHash: "hash",
        oracleVerdict: "pass",
        isolation: "protected",
      },
    });
    expect(
      sessionBoard({ world: world(), statusKnown: true, records: [record] })
        .counts.sessions,
    ).toBe(0);
  });
});
