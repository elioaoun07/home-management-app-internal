// DLV-13 (salvage) and DLV-14 (PM trace as an exit effect) acceptance tests,
// driven through the real routes. Own file, matching the house split.
import { existsSync, mkdirSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { afterEach, describe, expect, it } from "vitest";

import { atomicWriteJsonSync } from "../../scripts/delivery/fsx.mjs";
import {
  DeliveryRouteError,
  createDeliveryContext,
  performPendingWritebacks,
  routeDelivery,
} from "../../scripts/delivery/server-routes.mjs";

const cleanupDirs: string[] = [];
afterEach(() => {
  while (cleanupDirs.length) {
    const dir = cleanupDirs.pop();
    if (dir) rmSync(dir, { recursive: true, force: true });
  }
});

const CHECKLIST_LINE = "- [ ] **N1** Fix rounding drift in allocation splits _(blocker - M)_";
const CHECKLIST_RAW = ["# Checklist", "", "## Now", "", CHECKLIST_LINE, ""].join("\n");
const FEATURE_STATE_RAW = ["# Feature State", "", "## 1. What exists today", "", "- something", "", "## 4. Done", "", "- nothing yet", ""].join("\n");

function setup() {
  const root = mkdtempSync(join(tmpdir(), "delivery-salvage-"));
  cleanupDirs.push(root);
  const pmRel = join("ERA Notes", "10 - Project Management");
  const pmDir = join(root, pmRel);
  mkdirSync(join(pmDir, "Budget"), { recursive: true });
  writeFileSync(join(pmDir, "Budget", "4 - Checklist.md"), CHECKLIST_RAW);
  writeFileSync(join(pmDir, "Budget", "1 - Feature State.md"), FEATURE_STATE_RAW);
  writeFileSync(join(root, "README.md"), "test repo\n");

  const ctx = createDeliveryContext({
    ROOT: root,
    PM_DIR: pmDir,
    PM_REL: pmRel,
    gitStatusPorcelain: () => "",
    gitRevParseHead: () => "fixture-head",
    runValidation: async () => ({ ok: true, results: {} }),
    spawnRunner: () => {},
  });
  return { root, pmDir, ctx };
}

function q(params: Record<string, string> = {}) {
  return new URLSearchParams(params);
}

function startBody(overrides: Record<string, unknown> = {}) {
  return {
    file: "Budget/4 - Checklist.md",
    cbidx: 0,
    expectText: CHECKLIST_LINE,
    agent: "claude",
    budget: { maxUsd: 2, maxTokens: 2_000_000, warnPct: 0.8 },
    flightCheck: { reviewed: true, lane: "STANDARD" },
    ...overrides,
  };
}

// eslint-disable-next-line @typescript-eslint/no-explicit-any
async function startSession(ctx: any, overrides: Record<string, unknown> = {}) {
  const result = await routeDelivery({ method: "POST", path: "/api/delivery/start", query: q(), body: startBody(overrides) }, ctx);
  return (result as { json: { sessionId: string } }).json;
}

async function expectRouteError(promise: Promise<unknown>, status: number, messageMatch?: RegExp) {
  try {
    await promise;
    throw new Error("expected routeDelivery to throw a DeliveryRouteError");
  } catch (err) {
    expect(err).toBeInstanceOf(DeliveryRouteError);
    expect((err as InstanceType<typeof DeliveryRouteError>).status).toBe(status);
    if (messageMatch) expect((err as Error).message).toMatch(messageMatch);
  }
}

/** Park a started session at a stopped state with a finish package, as the runner would. */
// eslint-disable-next-line @typescript-eslint/no-explicit-any
function parkWithFinishPackage(ctx: any, sessionId: string, overrides: Record<string, unknown> = {}) {
  const dir = join(ctx.SESSIONS_DIR, sessionId);
  const state = JSON.parse(readFileSync(join(dir, "state.json"), "utf8"));
  atomicWriteJsonSync(join(dir, "state.json"), {
    ...state,
    state: "BLOCKED",
    awaiting: { gate: "blocked", returnTo: "BUILDING" },
    workspace: { ...state.workspace, changedFiles: ["src/lib/money.ts"] },
    acceptance: [
      { id: "AC1", text: "one", status: "met", evidence: "test", evidenceKind: "validation" },
      { id: "AC2", text: "two", status: "unmet", evidence: null },
    ],
    lastError: { phase: "BUILDING", message: "simulated stop" },
    ...overrides,
  });
  atomicWriteJsonSync(join(dir, "artifacts", "finish", "remaining-work.json"), {
    schemaVersion: 1,
    sessionId,
    acceptanceCriteria: [{ id: "AC2", text: "two", status: "unmet", evidence: null }],
    planSteps: [{ id: "S2", description: "the rest", paths: ["src/lib/money.ts"], validationHint: "pnpm test" }],
    summary: "1 acceptance criteria and 1 plan step(s) remain.",
  });
  atomicWriteJsonSync(join(dir, "artifacts", "finish", "manifest.json"), {
    schemaVersion: 1, files: [{ path: "src/lib/money.ts", ownership: "own" }],
  });
  writeFileSync(join(dir, "artifacts", "finish", "summary.md"), "# Session blocked\n");
  atomicWriteJsonSync(join(dir, "memory", "ledger.json"), { rev: 3, objective: "fix rounding", requirements: [], questions: [], decisions: [] });
  return dir;
}

// ============================================================
describe("DLV-13: GET /api/delivery/salvage", () => {
  it("returns the predecessor's remaining work and what was previously tried", async () => {
    const { ctx } = setup();
    const { sessionId } = await startSession(ctx);
    parkWithFinishPackage(ctx, sessionId);

    const result = await routeDelivery({ method: "GET", path: "/api/delivery/salvage", query: q({ id: sessionId }), body: {} }, ctx);
    const json = (result as { json: Record<string, never> }).json as Record<string, unknown>;

    expect(json.salvageable).toBe(true);
    expect(json.predecessor).toMatchObject({ sessionId, state: "BLOCKED" });
    expect((json.remainingWork as { acceptanceCriteria: unknown[] }).acceptanceCriteria).toHaveLength(1);
    expect((json.item as { cbidx: number }).cbidx).toBe(0);
    // Shown, never pre-selected — a session usually needs salvaging *because*
    // one of these was wrong.
    expect(json.previousSelection).toMatchObject({ lane: "STANDARD" });
  });

  it("refuses a session that never wrote a finish package", async () => {
    const { ctx } = setup();
    const { sessionId } = await startSession(ctx);
    await expectRouteError(
      routeDelivery({ method: "GET", path: "/api/delivery/salvage", query: q({ id: sessionId }), body: {} }, ctx),
      409,
      /no finish package/,
    );
  });

  it("reports salvageable:false when the finish package records nothing remaining", async () => {
    const { ctx } = setup();
    const { sessionId } = await startSession(ctx);
    const dir = parkWithFinishPackage(ctx, sessionId);
    atomicWriteJsonSync(join(dir, "artifacts", "finish", "remaining-work.json"), {
      schemaVersion: 1, sessionId, acceptanceCriteria: [], planSteps: [], summary: "Nothing recorded as remaining.",
    });

    const result = await routeDelivery({ method: "GET", path: "/api/delivery/salvage", query: q({ id: sessionId }), body: {} }, ctx);
    expect((result as { json: { salvageable: boolean } }).json.salvageable).toBe(false);
  });
});

describe("DLV-13: relaunching as a continuation", () => {
  it("narrows the successor to the remaining ACs, carries the ledger, and supersedes the predecessor", async () => {
    const { ctx } = setup();
    const { sessionId: predecessorId } = await startSession(ctx);
    parkWithFinishPackage(ctx, predecessorId);

    const { sessionId: successorId, continuationOf } = (await startSession(ctx, {
      continuationOf: predecessorId,
      flightCheck: { reviewed: true, lane: "DEEP" },
      budget: { maxUsd: 5, maxTokens: 5_000_000, warnPct: 0.8 },
    })) as unknown as { sessionId: string; continuationOf: string };

    expect(continuationOf).toBe(predecessorId);
    const successorDir = join(ctx.SESSIONS_DIR, successorId);
    const packet = JSON.parse(readFileSync(join(successorDir, "packet.json"), "utf8"));

    // Narrowed to what is actually left.
    expect(packet.acceptanceCriteria).toEqual([{ id: "AC2", text: "two" }]);
    expect(packet.continuation.predecessorSessionId).toBe(predecessorId);
    expect(packet.continuation.remainingWork.planSteps).toHaveLength(1);
    // A fresh envelope, not the predecessor's.
    expect(packet.lanePolicy.lane).toBe("DEEP");
    expect(packet.budget.maxUsd).toBe(5);
    // The durable ledger travels; the transcript does not.
    expect(JSON.parse(readFileSync(join(successorDir, "memory", "ledger.json"), "utf8")).rev).toBe(3);
    expect(existsSync(join(successorDir, "transcript"))).toBe(false);

    const predecessorState = JSON.parse(readFileSync(join(ctx.SESSIONS_DIR, predecessorId, "state.json"), "utf8"));
    expect(predecessorState.supersededBy).toMatchObject({ sessionId: successorId });
    expect(predecessorState.awaiting.reason).toBe("superseded");
    // Superseding is a note about lineage, never a state transition — the one
    // record of how the session actually ended must survive it.
    expect(predecessorState.state).toBe("BLOCKED");
  });

  it("refuses a continuation pointed at a different work item", async () => {
    const { ctx, pmDir } = setup();
    writeFileSync(
      join(pmDir, "Budget", "4 - Checklist.md"),
      ["# Checklist", "", "## Now", "", CHECKLIST_LINE, "- [ ] **N2** Something else _(friction - S)_", ""].join("\n"),
    );
    const { sessionId } = await startSession(ctx);
    parkWithFinishPackage(ctx, sessionId);

    await expectRouteError(
      routeDelivery(
        {
          method: "POST", path: "/api/delivery/start", query: q(),
          body: startBody({ cbidx: 1, expectText: "- [ ] **N2** Something else _(friction - S)_", continuationOf: sessionId }),
        },
        ctx,
      ),
      400,
      /different work item/,
    );
  });

  it("refuses a continuation whose predecessor has no finish package", async () => {
    const { ctx } = setup();
    const { sessionId } = await startSession(ctx);
    await expectRouteError(
      routeDelivery(
        { method: "POST", path: "/api/delivery/start", query: q(), body: startBody({ continuationOf: sessionId }) },
        ctx,
      ),
      409,
      /no finish package/,
    );
  });
});

// ============================================================
describe("DLV-14: PM trace on every session exit", () => {
  it("appends one dated bullet to the campaign's Feature State for a blocked session", async () => {
    const { ctx, pmDir } = setup();
    const { sessionId } = await startSession(ctx);
    parkWithFinishPackage(ctx, sessionId);

    performPendingWritebacks(ctx);

    const featureState = readFileSync(join(pmDir, "Budget", "1 - Feature State.md"), "utf8");
    expect(featureState).toContain("## Delivery session log");
    expect(featureState).toContain(sessionId);
    expect(featureState).toContain("ended **blocked**");
    expect(featureState).toContain("1 file(s) changed");
    expect(featureState).toContain("ACs 1/2 satisfied");
    // Append-only: nothing the owner wrote is touched.
    expect(featureState).toContain("## 1. What exists today");
    expect(featureState).toContain("- nothing yet");
  });

  it("is idempotent across repeated runs", async () => {
    const { ctx, pmDir } = setup();
    const { sessionId } = await startSession(ctx);
    parkWithFinishPackage(ctx, sessionId);

    performPendingWritebacks(ctx);
    performPendingWritebacks(ctx);
    performPendingWritebacks(ctx);

    const featureState = readFileSync(join(pmDir, "Budget", "1 - Feature State.md"), "utf8");
    // Counting bullets, not session-id occurrences: one bullet names the id
    // twice (once in the sentence, once in the finish-package path).
    expect(featureState.split("delivery session `").length - 1).toBe(1);
    expect(featureState.split("## Delivery session log").length - 1).toBe(1);
    expect(existsSync(join(ctx.SESSIONS_DIR, sessionId, "pm-trace.done"))).toBe(true);
  });

  it("still traces a drifted item, with the drift called out rather than hidden", async () => {
    const { ctx, pmDir } = setup();
    const { sessionId } = await startSession(ctx);
    parkWithFinishPackage(ctx, sessionId);
    // The owner rewords the checklist line after launch.
    writeFileSync(
      join(pmDir, "Budget", "4 - Checklist.md"),
      ["# Checklist", "", "## Now", "", "- [ ] **N1** Fix rounding drift EVERYWHERE _(blocker - L)_", ""].join("\n"),
    );

    performPendingWritebacks(ctx);

    const featureState = readFileSync(join(pmDir, "Budget", "1 - Feature State.md"), "utf8");
    expect(featureState).toContain(sessionId);
    expect(featureState).toContain("checklist line has changed since launch");
  });

  it("traces a cancelled session too, not only failures", async () => {
    const { ctx, pmDir } = setup();
    const { sessionId } = await startSession(ctx);
    parkWithFinishPackage(ctx, sessionId, { state: "CANCELLED", awaiting: null });

    performPendingWritebacks(ctx);
    expect(readFileSync(join(pmDir, "Budget", "1 - Feature State.md"), "utf8")).toContain("ended **cancelled**");
  });

  it("leaves a still-running session alone", async () => {
    const { ctx, pmDir } = setup();
    await startSession(ctx); // state stays SELECTED

    performPendingWritebacks(ctx);
    expect(readFileSync(join(pmDir, "Budget", "1 - Feature State.md"), "utf8")).not.toContain("## Delivery session log");
  });
});
