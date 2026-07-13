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
  sessionIdFromWatchPath,
} from "../../scripts/delivery/server-routes.mjs";

// ---- fixtures ----

const cleanupDirs: string[] = [];
afterEach(() => {
  while (cleanupDirs.length) {
    const dir = cleanupDirs.pop();
    if (dir) rmSync(dir, { recursive: true, force: true });
  }
});

const CHECKLIST_LINE = "- [ ] **N1** Fix rounding drift in allocation splits _(blocker - M)_";
const CHECKLIST_RAW = ["# Checklist", "", "## Now", "", CHECKLIST_LINE, "- [x] Already done item", ""].join("\n");

function setup() {
  const root = mkdtempSync(join(tmpdir(), "delivery-server-"));
  cleanupDirs.push(root);

  const pmRel = join("ERA Notes", "10 - Project Management");
  const pmDir = join(root, pmRel);
  mkdirSync(join(pmDir, "Budget"), { recursive: true });
  writeFileSync(join(pmDir, "Budget", "4 - Checklist.md"), CHECKLIST_RAW);
  writeFileSync(join(pmDir, "Budget", "1 - Feature State.md"), "# Feature State\n");
  writeFileSync(join(root, "README.md"), "test repo\n");
  writeFileSync(join(root, ".gitignore"), "/.delivery/\n");

  const spawnedRunners: Array<{ sessionId: string; resume: boolean }> = [];
  const ctx = createDeliveryContext({
    ROOT: root,
    PM_DIR: pmDir,
    PM_REL: pmRel,
    gitStatusPorcelain: () => "",
    gitRevParseHead: () => "fixture-head",
    spawnRunner: (_ctx: unknown, sessionId: string, opts: { resume?: boolean }) => {
      spawnedRunners.push({ sessionId, resume: !!opts.resume });
    },
  });
  return { root, pmDir, pmRel, ctx, spawnedRunners };
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
    ...overrides,
  };
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

// eslint-disable-next-line @typescript-eslint/no-explicit-any
async function startSession(ctx: any, overrides: Record<string, unknown> = {}) {
  const result = await routeDelivery(
    { method: "POST", path: "/api/delivery/start", query: q(), body: startBody(overrides) },
    ctx,
  );
  return (result as { status: number; json: { sessionId: string } }).json.sessionId;
}

// ============================================================
describe("POST /api/delivery/start", () => {
  it("creates packet.json + state.json and requests a runner spawn", async () => {
    const { ctx, spawnedRunners } = setup();
    const result = await routeDelivery(
      { method: "POST", path: "/api/delivery/start", query: q(), body: startBody() },
      ctx,
    );
    expect(result?.status).toBe(200);
    const sessionId = (result!.json as { sessionId: string }).sessionId;
    expect(sessionId).toMatch(/^s-/);

    const dir = join(ctx.SESSIONS_DIR, sessionId);
    expect(existsSync(join(dir, "packet.json"))).toBe(true);
    expect(existsSync(join(dir, "state.json"))).toBe(true);
    const packet = JSON.parse(readFileSync(join(dir, "packet.json"), "utf8"));
    expect(packet.item.pmFile).toBe("Budget/4 - Checklist.md");
    expect(packet.item.cbidx).toBe(0);
    expect(packet.item.campaign).toBe("Budget");
    // always-on capabilities are present even with no other signal
    expect(packet.capabilities.map((c: { name: string }) => c.name)).toEqual(
      expect.arrayContaining(["automated-testing", "code-review", "uat-generation"]),
    );
    const state = JSON.parse(readFileSync(join(dir, "state.json"), "utf8"));
    expect(state.state).toBe("SELECTED");
    expect(state.agent).toBe("claude");
    expect(packet.agentConfig).toEqual({
      model: null,
      effort: { discovery: "medium", plan: "high", building: "high", review: "medium" },
    });

    expect(spawnedRunners).toEqual([{ sessionId, resume: false }]);
  });

  it("persists launch model and per-phase effort overrides into packet.agentConfig", async () => {
    const { ctx } = setup();
    const sessionId = await startSession(ctx, {
      model: "provider-model",
      effort: { discovery: "low", plan: "xhigh" },
    });
    const packet = JSON.parse(readFileSync(join(ctx.SESSIONS_DIR, sessionId, "packet.json"), "utf8"));
    expect(packet.agentConfig).toEqual({
      model: "provider-model",
      effort: { discovery: "low", plan: "xhigh", building: "high", review: "medium" },
    });
  });

  it("returns 409 on textHash drift (expectText no longer matches the live line)", async () => {
    const { ctx } = setup();
    await expectRouteError(
      routeDelivery(
        {
          method: "POST",
          path: "/api/delivery/start",
          query: q(),
          body: startBody({ expectText: "this text does not match the source line" }),
        },
        ctx,
      ),
      409,
      /drift/,
    );
  });

  it("returns 409 when the item already has an active (non-terminal) session", async () => {
    const { ctx } = setup();
    await startSession(ctx);
    await expectRouteError(
      routeDelivery({ method: "POST", path: "/api/delivery/start", query: q(), body: startBody() }, ctx),
      409,
      /already has an active delivery session/,
    );
  });

  it("returns 429 when a session is already past the plan gate (global build lock)", async () => {
    const { ctx } = setup();
    const lockedId = "s-locked-fixture";
    const lockedDir = join(ctx.SESSIONS_DIR, lockedId);
    mkdirSync(lockedDir, { recursive: true });
    atomicWriteJsonSync(join(lockedDir, "packet.json"), {
      schemaVersion: 1,
      sessionId: lockedId,
      agent: "claude",
      item: { pmFile: "Budget/4 - Checklist.md", cbidx: 99 },
      workspace: {},
    });
    atomicWriteJsonSync(join(lockedDir, "state.json"), {
      schemaVersion: 1,
      sessionId: lockedId,
      state: "BUILDING",
      awaiting: null,
      updatedAt: new Date().toISOString(),
    });

    await expectRouteError(
      routeDelivery({ method: "POST", path: "/api/delivery/start", query: q(), body: startBody() }, ctx),
      429,
    );
  });

  it("sessions parked at a gate (before BUILDING) do not hold the build lock", async () => {
    const { ctx } = setup();
    const parkedId = "s-parked-fixture";
    const parkedDir = join(ctx.SESSIONS_DIR, parkedId);
    mkdirSync(parkedDir, { recursive: true });
    atomicWriteJsonSync(join(parkedDir, "packet.json"), {
      schemaVersion: 1,
      sessionId: parkedId,
      agent: "claude",
      item: { pmFile: "Budget/4 - Checklist.md", cbidx: 99 },
      workspace: {},
    });
    atomicWriteJsonSync(join(parkedDir, "state.json"), {
      schemaVersion: 1,
      sessionId: parkedId,
      state: "PLAN_READY",
      awaiting: { gate: "plan" },
      updatedAt: new Date().toISOString(),
    });

    const result = await routeDelivery(
      { method: "POST", path: "/api/delivery/start", query: q(), body: startBody() },
      ctx,
    );
    expect(result?.status).toBe(200);
  });

  it("returns 400 when the tree is dirty and dirtyAck is not set, but succeeds with dirtyAck", async () => {
    const { ctx } = setup();
    ctx.gitStatusPorcelain = () => "?? untracked.txt\n";

    await expectRouteError(
      routeDelivery({ method: "POST", path: "/api/delivery/start", query: q(), body: startBody() }, ctx),
      400,
      /dirty/,
    );

    const result = await routeDelivery(
      { method: "POST", path: "/api/delivery/start", query: q(), body: startBody({ dirtyAck: true }) },
      ctx,
    );
    expect(result?.status).toBe(200);
    const dir = join(ctx.SESSIONS_DIR, (result!.json as { sessionId: string }).sessionId);
    const packet = JSON.parse(readFileSync(join(dir, "packet.json"), "utf8"));
    expect(packet.workspace.dirtyAtStart).toBe(true);
  });

  it("rejects an attempt to drop a locked always-on capability with 400", async () => {
    const { ctx } = setup();
    await expectRouteError(
      routeDelivery(
        {
          method: "POST",
          path: "/api/delivery/start",
          query: q(),
          body: startBody({ options: { capabilitiesDrop: ["code-review"] } }),
        },
        ctx,
      ),
      400,
      /locked capability/,
    );
  });

  it("rejects an unknown agent with 400", async () => {
    const { ctx } = setup();
    await expectRouteError(
      routeDelivery(
        { method: "POST", path: "/api/delivery/start", query: q(), body: startBody({ agent: "gpt5" }) },
        ctx,
      ),
      400,
    );
  });
});

describe("POST /api/delivery/decision", () => {
  it("returns 409 when gate doesn't match state.awaiting.gate", async () => {
    const { ctx } = setup();
    const sessionId = await startSession(ctx);
    const dir = join(ctx.SESSIONS_DIR, sessionId);
    const state = JSON.parse(readFileSync(join(dir, "state.json"), "utf8"));
    state.state = "SPEC_READY";
    state.awaiting = { gate: "spec" };
    atomicWriteJsonSync(join(dir, "state.json"), state);

    await expectRouteError(
      routeDelivery(
        { method: "POST", path: "/api/delivery/decision", query: q(), body: { id: sessionId, gate: "plan", decision: "approve" } },
        ctx,
      ),
      409,
      /gate mismatch/,
    );
  });

  it("requires typed confirmText \"APPROVE\" for a risk-flagged plan approval", async () => {
    const { ctx } = setup();
    const sessionId = await startSession(ctx);
    const dir = join(ctx.SESSIONS_DIR, sessionId);
    const state = JSON.parse(readFileSync(join(dir, "state.json"), "utf8"));
    state.state = "PLAN_READY";
    state.awaiting = { gate: "plan" };
    atomicWriteJsonSync(join(dir, "state.json"), state);
    mkdirSync(join(dir, "artifacts"), { recursive: true });
    atomicWriteJsonSync(join(dir, "artifacts", "plan.json"), { riskFlags: ["security"] });

    await expectRouteError(
      routeDelivery(
        { method: "POST", path: "/api/delivery/decision", query: q(), body: { id: sessionId, gate: "plan", decision: "approve" } },
        ctx,
      ),
      400,
      /APPROVE/,
    );

    const result = await routeDelivery(
      {
        method: "POST",
        path: "/api/delivery/decision",
        query: q(),
        body: { id: sessionId, gate: "plan", decision: "approve", confirmText: "APPROVE" },
      },
      ctx,
    );
    expect(result?.status).toBe(200);
  });

  it("returns 409 for a decision on a terminal session", async () => {
    const { ctx } = setup();
    const sessionId = await startSession(ctx);
    const dir = join(ctx.SESSIONS_DIR, sessionId);
    const state = JSON.parse(readFileSync(join(dir, "state.json"), "utf8"));
    state.state = "SHIPPED";
    atomicWriteJsonSync(join(dir, "state.json"), state);

    await expectRouteError(
      routeDelivery(
        { method: "POST", path: "/api/delivery/decision", query: q(), body: { id: sessionId, gate: "spec", decision: "approve" } },
        ctx,
      ),
      409,
    );
  });

  it("cancel is accepted even without a matching gate, and writes a decision file", async () => {
    const { ctx } = setup();
    const sessionId = await startSession(ctx);
    const dir = join(ctx.SESSIONS_DIR, sessionId);
    // Fresh runner.json makes isRunnerAlive() true, so pm-server should NOT
    // mark CANCELLED directly — it just writes the decision file for the
    // (still-alive) runner to consume.
    atomicWriteJsonSync(join(dir, "runner.json"), {
      pid: process.pid,
      startedAt: new Date().toISOString(),
      heartbeatAt: new Date().toISOString(),
      node: process.version,
    });
    const result = await routeDelivery(
      { method: "POST", path: "/api/delivery/decision", query: q(), body: { id: sessionId, decision: "cancel" } },
      ctx,
    );
    expect(result?.status).toBe(200);
    expect(existsSync(join(dir, "decisions", "0001-cancel.json"))).toBe(true);
    const state = JSON.parse(readFileSync(join(dir, "state.json"), "utf8"));
    expect(state.state).toBe("SELECTED"); // runner alive -> pm-server did not mark it CANCELLED itself
  });

  it("cancel with a dead runner marks the session CANCELLED directly", async () => {
    const { ctx } = setup();
    const sessionId = await startSession(ctx);
    const dir = join(ctx.SESSIONS_DIR, sessionId);
    // No runner.json at all -> isRunnerAlive() is false.
    const result = await routeDelivery(
      { method: "POST", path: "/api/delivery/decision", query: q(), body: { id: sessionId, decision: "cancel" } },
      ctx,
    );
    expect(result?.status).toBe(200);
    const state = JSON.parse(readFileSync(join(dir, "state.json"), "utf8"));
    expect(state.state).toBe("CANCELLED");
  });
});

describe("POST /api/delivery/message", () => {
  it("returns 409 for a message on a terminal session", async () => {
    const { ctx } = setup();
    const sessionId = await startSession(ctx);
    const dir = join(ctx.SESSIONS_DIR, sessionId);
    const state = JSON.parse(readFileSync(join(dir, "state.json"), "utf8"));
    state.state = "CANCELLED";
    atomicWriteJsonSync(join(dir, "state.json"), state);

    await expectRouteError(
      routeDelivery({ method: "POST", path: "/api/delivery/message", query: q(), body: { id: sessionId, text: "hi" } }, ctx),
      409,
    );
  });

  it("rejects an empty message with 400 and a too-long message with 400", async () => {
    const { ctx } = setup();
    const sessionId = await startSession(ctx);
    await expectRouteError(
      routeDelivery({ method: "POST", path: "/api/delivery/message", query: q(), body: { id: sessionId, text: "   " } }, ctx),
      400,
    );
    await expectRouteError(
      routeDelivery(
        { method: "POST", path: "/api/delivery/message", query: q(), body: { id: sessionId, text: "x".repeat(8001) } },
        ctx,
      ),
      400,
    );
  });

  it("writes a message file with an incrementing seq", async () => {
    const { ctx } = setup();
    const sessionId = await startSession(ctx);
    const dir = join(ctx.SESSIONS_DIR, sessionId);
    const r1 = await routeDelivery(
      { method: "POST", path: "/api/delivery/message", query: q(), body: { id: sessionId, text: "first" } },
      ctx,
    );
    const r2 = await routeDelivery(
      { method: "POST", path: "/api/delivery/message", query: q(), body: { id: sessionId, text: "second" } },
      ctx,
    );
    expect((r1!.json as { seq: number }).seq).toBe(1);
    expect((r2!.json as { seq: number }).seq).toBe(2);
    expect(existsSync(join(dir, "messages", "0001.json"))).toBe(true);
    expect(existsSync(join(dir, "messages", "0002.json"))).toBe(true);
  });
});

describe("POST /api/delivery/resume", () => {
  it("returns 409 when the heartbeat is fresh", async () => {
    const { ctx } = setup();
    const sessionId = await startSession(ctx);
    const dir = join(ctx.SESSIONS_DIR, sessionId);
    atomicWriteJsonSync(join(dir, "runner.json"), {
      pid: process.pid,
      startedAt: new Date().toISOString(),
      heartbeatAt: new Date().toISOString(),
      node: process.version,
    });
    await expectRouteError(
      routeDelivery({ method: "POST", path: "/api/delivery/resume", query: q(), body: { id: sessionId } }, ctx),
      409,
      /fresh/,
    );
  });

  it("spawns a resumed runner when the heartbeat is stale", async () => {
    const { ctx, spawnedRunners } = setup();
    const sessionId = await startSession(ctx);
    const dir = join(ctx.SESSIONS_DIR, sessionId);
    atomicWriteJsonSync(join(dir, "runner.json"), {
      pid: process.pid,
      startedAt: new Date(0).toISOString(),
      heartbeatAt: new Date(0).toISOString(),
      node: process.version,
    });
    const result = await routeDelivery(
      { method: "POST", path: "/api/delivery/resume", query: q(), body: { id: sessionId } },
      ctx,
    );
    expect(result?.status).toBe(200);
    expect(spawnedRunners).toEqual(
      expect.arrayContaining([expect.objectContaining({ sessionId, resume: true })]),
    );
  });
});

describe("GET /api/delivery/artifact", () => {
  it("rejects a path-traversal attempt", async () => {
    const { ctx } = setup();
    const sessionId = await startSession(ctx);
    await expectRouteError(
      routeDelivery(
        { method: "GET", path: "/api/delivery/artifact", query: q({ id: sessionId, path: "../../../etc/passwd" }), body: {} },
        ctx,
      ),
      400,
    );
  });

  it("rejects a disallowed extension", async () => {
    const { ctx } = setup();
    const sessionId = await startSession(ctx);
    const dir = join(ctx.SESSIONS_DIR, sessionId);
    mkdirSync(join(dir, "artifacts"), { recursive: true });
    writeFileSync(join(dir, "artifacts", "evil.exe"), "x");
    await expectRouteError(
      routeDelivery({ method: "GET", path: "/api/delivery/artifact", query: q({ id: sessionId, path: "evil.exe" }), body: {} }, ctx),
      400,
    );
  });

  it("returns 404 for a missing artifact", async () => {
    const { ctx } = setup();
    const sessionId = await startSession(ctx);
    await expectRouteError(
      routeDelivery(
        { method: "GET", path: "/api/delivery/artifact", query: q({ id: sessionId, path: "spec.md" }), body: {} },
        ctx,
      ),
      404,
    );
  });

  it("returns the content + lang of an existing artifact", async () => {
    const { ctx } = setup();
    const sessionId = await startSession(ctx);
    const dir = join(ctx.SESSIONS_DIR, sessionId);
    mkdirSync(join(dir, "artifacts", "uat"), { recursive: true });
    writeFileSync(join(dir, "artifacts", "uat", "summary.md"), "# Summary\n");
    const result = await routeDelivery(
      { method: "GET", path: "/api/delivery/artifact", query: q({ id: sessionId, path: "uat/summary.md" }), body: {} },
      ctx,
    );
    expect(result?.status).toBe(200);
    expect((result!.json as { content: string }).content).toBe("# Summary\n");
    expect((result!.json as { lang: string }).lang).toBe("md");
  });
});

describe("GET /api/delivery/sessions and /api/delivery/session", () => {
  it("lists sessions with the build-lock flag and per-session runner liveness", async () => {
    const { ctx } = setup();
    const sessionId = await startSession(ctx);
    const list = await routeDelivery({ method: "GET", path: "/api/delivery/sessions", query: q(), body: {} }, ctx);
    expect(list?.status).toBe(200);
    const json = list!.json as { sessions: Array<{ sessionId: string; runnerAlive: boolean }>; buildLockActive: boolean };
    expect(json.sessions.map((s) => s.sessionId)).toContain(sessionId);
    expect(json.buildLockActive).toBe(false);
    expect(json.sessions.find((s) => s.sessionId === sessionId)?.runnerAlive).toBe(false); // no runner.json yet
  });

  it("returns 404 for an unknown session id", async () => {
    const { ctx } = setup();
    await expectRouteError(
      routeDelivery({ method: "GET", path: "/api/delivery/session", query: q({ id: "s-does-not-exist" }), body: {} }, ctx),
      404,
    );
  });

  it("returns packet, state, and artifact listing for a known session", async () => {
    const { ctx } = setup();
    const sessionId = await startSession(ctx);
    const dir = join(ctx.SESSIONS_DIR, sessionId);
    mkdirSync(join(dir, "artifacts"), { recursive: true });
    writeFileSync(join(dir, "artifacts", "spec.md"), "# Spec\n");
    const result = await routeDelivery(
      { method: "GET", path: "/api/delivery/session", query: q({ id: sessionId }), body: {} },
      ctx,
    );
    expect(result?.status).toBe(200);
    const json = result!.json as { packet: unknown; state: unknown; artifacts: Array<{ path: string }>; runner: { alive: boolean } };
    expect(json.packet).toBeTruthy();
    expect(json.state).toBeTruthy();
    expect(json.artifacts.some((a) => a.path === "spec.md")).toBe(true);
    expect(json.runner.alive).toBe(false);
  });
});

describe("GET /api/delivery/events", () => {
  it("replays events after a seq cursor, capped at 500", async () => {
    const { ctx } = setup();
    const sessionId = await startSession(ctx);
    const dir = join(ctx.SESSIONS_DIR, sessionId);
    const lines = [1, 2, 3].map((seq) => JSON.stringify({ ts: new Date().toISOString(), seq, type: "test.event", phase: null, agent: null, data: {} }));
    writeFileSync(join(dir, "events.ndjson"), lines.join("\n") + "\n");
    const result = await routeDelivery(
      { method: "GET", path: "/api/delivery/events", query: q({ id: sessionId, after: "1" }), body: {} },
      ctx,
    );
    const json = result!.json as { events: Array<{ seq: number }>; lastSeq: number };
    expect(json.events.map((e) => e.seq)).toEqual([2, 3]);
    expect(json.lastSeq).toBe(3);
  });
});

describe("routeDelivery: not-a-delivery-route passthrough", () => {
  it("returns null for a path outside /api/delivery/*", async () => {
    const { ctx } = setup();
    const result = await routeDelivery({ method: "GET", path: "/api/data", query: q(), body: {} }, ctx);
    expect(result).toBeNull();
  });
});

describe("sessionIdFromWatchPath", () => {
  it("extracts the first path segment across both separators", () => {
    expect(sessionIdFromWatchPath("s-20260711-abcd/state.json")).toBe("s-20260711-abcd");
    expect(sessionIdFromWatchPath("s-20260711-abcd\\state.json")).toBe("s-20260711-abcd");
    expect(sessionIdFromWatchPath(null)).toBeNull();
    expect(sessionIdFromWatchPath("")).toBeNull();
  });
});

describe("performPendingWritebacks", () => {
  it("ticks the source checkbox exactly once for an ACCEPTED session and writes writeback.done", async () => {
    const { ctx, pmDir } = setup();
    const sessionId = await startSession(ctx);
    const dir = join(ctx.SESSIONS_DIR, sessionId);
    const state = JSON.parse(readFileSync(join(dir, "state.json"), "utf8"));
    state.state = "ACCEPTED";
    state.writebackRequested = { tickCheckbox: true, at: new Date().toISOString() };
    atomicWriteJsonSync(join(dir, "state.json"), state);

    performPendingWritebacks(ctx);

    expect(existsSync(join(dir, "writeback.done"))).toBe(true);
    const raw = readFileSync(join(pmDir, "Budget", "4 - Checklist.md"), "utf8");
    expect(raw).toContain("- [x] **N1** Fix rounding drift in allocation splits _(blocker - M)_");

    // exactly-once: running it again must not re-toggle (would flip back to open)
    performPendingWritebacks(ctx);
    const rawAfterSecondPass = readFileSync(join(pmDir, "Budget", "4 - Checklist.md"), "utf8");
    expect(rawAfterSecondPass).toBe(raw);
  });

  it("skips the tick (drift) when the source line no longer matches, and still writes the marker", async () => {
    const { ctx, pmDir } = setup();
    const sessionId = await startSession(ctx);
    const dir = join(ctx.SESSIONS_DIR, sessionId);
    const state = JSON.parse(readFileSync(join(dir, "state.json"), "utf8"));
    state.state = "ACCEPTED";
    atomicWriteJsonSync(join(dir, "state.json"), state);

    // The owner edited the source line after the session started.
    const checklistPath = join(pmDir, "Budget", "4 - Checklist.md");
    writeFileSync(checklistPath, CHECKLIST_RAW.replace(CHECKLIST_LINE, "- [ ] **N1** A completely different line now"));

    performPendingWritebacks(ctx);

    expect(existsSync(join(dir, "writeback.done"))).toBe(true);
    const marker = JSON.parse(readFileSync(join(dir, "writeback.done"), "utf8"));
    expect(marker.tickedCheckbox).toBe(false);
    expect(marker.driftReason).toBeTruthy();
    // never guesses a line — the file is untouched
    expect(readFileSync(checklistPath, "utf8")).toContain("- [ ] **N1** A completely different line now");
  });

  it("does not tick the checkbox when the owner unchecked tickCheckbox at Accept time", async () => {
    const { ctx, pmDir } = setup();
    const sessionId = await startSession(ctx);
    const dir = join(ctx.SESSIONS_DIR, sessionId);
    const state = JSON.parse(readFileSync(join(dir, "state.json"), "utf8"));
    state.state = "ACCEPTED";
    state.writebackRequested = { tickCheckbox: false, at: new Date().toISOString() };
    atomicWriteJsonSync(join(dir, "state.json"), state);

    performPendingWritebacks(ctx);

    expect(existsSync(join(dir, "writeback.done"))).toBe(true);
    const raw = readFileSync(join(pmDir, "Budget", "4 - Checklist.md"), "utf8");
    expect(raw).toContain(CHECKLIST_LINE); // still unchecked
  });
});
