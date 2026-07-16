import { existsSync, mkdirSync, mkdtempSync, readFileSync, readdirSync, rmSync, writeFileSync } from "node:fs";
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

function setup({ deliveryConfig }: { deliveryConfig?: object } = {}) {
  const root = mkdtempSync(join(tmpdir(), "delivery-server-"));
  cleanupDirs.push(root);

  const pmRel = join("ERA Notes", "10 - Project Management");
  const pmDir = join(root, pmRel);
  mkdirSync(join(pmDir, "Budget"), { recursive: true });
  writeFileSync(join(pmDir, "Budget", "4 - Checklist.md"), CHECKLIST_RAW);
  writeFileSync(join(pmDir, "Budget", "1 - Feature State.md"), "# Feature State\n");
  writeFileSync(join(root, "README.md"), "test repo\n");
  writeFileSync(join(root, ".gitignore"), "/.delivery/\n");
  if (deliveryConfig) {
    mkdirSync(join(root, ".delivery"), { recursive: true });
    writeFileSync(join(root, ".delivery", "config.json"), JSON.stringify(deliveryConfig));
  }

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

  it("(DW-2) rejects an unknown effort value with 400", async () => {
    const { ctx } = setup();
    await expectRouteError(
      routeDelivery(
        { method: "POST", path: "/api/delivery/start", query: q(), body: startBody({ effort: { discovery: "bogus" } }) },
        ctx,
      ),
      400,
      /unknown effort/,
    );
  });

  it("(DW-2) rejects an unknown model when the provider's catalog is populated", async () => {
    const { ctx } = setup({
      deliveryConfig: {
        providers: { claude: { defaultModel: "claude-sonnet-5", efforts: ["low", "medium", "high", "xhigh", "max"], models: [{ id: "claude-sonnet-5" }] } },
      },
    });
    await expectRouteError(
      routeDelivery(
        { method: "POST", path: "/api/delivery/start", query: q(), body: startBody({ model: "does-not-exist" }) },
        ctx,
      ),
      400,
      /unknown model/,
    );
  });

  it("(DW-2) accepts any model string when the provider's catalog is empty (no config.json yet)", async () => {
    const { ctx } = setup();
    const result = await routeDelivery(
      { method: "POST", path: "/api/delivery/start", query: q(), body: startBody({ model: "whatever-not-cataloged", dirtyAck: false }) },
      ctx,
    );
    expect(result?.status).toBe(200);
  });

  it("(DW-2) defaults agentConfig.model from the provider's configured defaultModel when omitted", async () => {
    const { ctx } = setup({
      deliveryConfig: { providers: { claude: { defaultModel: "claude-sonnet-5", efforts: ["low", "medium", "high", "xhigh", "max"], models: [] } } },
    });
    const result = await routeDelivery(
      { method: "POST", path: "/api/delivery/start", query: q(), body: startBody() },
      ctx,
    );
    const dir = join(ctx.SESSIONS_DIR, (result!.json as { sessionId: string }).sessionId);
    const packet = JSON.parse(readFileSync(join(dir, "packet.json"), "utf8"));
    expect(packet.agentConfig.model).toBe("claude-sonnet-5");
  });
});

describe("GET /api/delivery/capabilities", () => {
  it("(DW-2) merges pure driver manifests with the owner's model/pricing catalog", async () => {
    const { ctx } = setup({
      deliveryConfig: {
        providers: {
          claude: { defaultModel: "claude-sonnet-5", efforts: ["low", "medium", "high", "xhigh", "max"], models: [{ id: "claude-sonnet-5" }] },
        },
      },
    });
    const result = await routeDelivery({ method: "GET", path: "/api/delivery/capabilities", query: q(), body: {} }, ctx);
    expect(result?.status).toBe(200);
    const payload = result!.json as {
      providers: Record<string, { manifest: { provider: string }; defaultModel: string | null; models: unknown[] }>;
      config: { routing: Record<string, { effort: string }> };
    };
    expect(payload.providers.claude.manifest.provider).toBe("claude");
    expect(payload.providers.claude.defaultModel).toBe("claude-sonnet-5");
    expect(payload.providers.codex.manifest.provider).toBe("codex");
    expect(payload.config.routing.plan.effort).toBe("high");
  });

  it("(DW-2) never touches either SDK (manifest() is pure data)", async () => {
    const { ctx } = setup();
    // No importSdk override is wired through routeDelivery's manifest path —
    // if this ever imported a real SDK it would throw in this sandboxed test
    // environment. Reaching 200 proves manifest() stayed SDK-free.
    const result = await routeDelivery({ method: "GET", path: "/api/delivery/capabilities", query: q(), body: {} }, ctx);
    expect(result?.status).toBe(200);
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

describe("(DW-4) POST /api/delivery/control", () => {
  it("writes a numbered control file and returns its seq", async () => {
    const { ctx } = setup();
    const sessionId = await startSession(ctx);
    const result = await routeDelivery(
      { method: "POST", path: "/api/delivery/control", query: q(), body: { id: sessionId, type: "pause", payload: {} } },
      ctx,
    );
    expect(result?.status).toBe(200);
    expect((result!.json as { seq: number }).seq).toBe(1);
    const files = readdirSync(join(ctx.SESSIONS_DIR, sessionId, "controls"));
    expect(files).toContain("0001-pause.json");
  });

  it("returns 404 for an unknown session", async () => {
    const { ctx } = setup();
    await expectRouteError(
      routeDelivery({ method: "POST", path: "/api/delivery/control", query: q(), body: { id: "nope", type: "pause" } }, ctx),
      404,
    );
  });

  it("returns 400 for an invalid control type or malformed payload", async () => {
    const { ctx } = setup();
    const sessionId = await startSession(ctx);
    await expectRouteError(
      routeDelivery({ method: "POST", path: "/api/delivery/control", query: q(), body: { id: sessionId, type: "bogus" } }, ctx),
      400,
    );
    await expectRouteError(
      routeDelivery({ method: "POST", path: "/api/delivery/control", query: q(), body: { id: sessionId, type: "set-config", payload: {} } }, ctx),
      400,
    );
  });

  it("validates a set-config model against the owner's catalog when populated", async () => {
    const { ctx } = setup({
      deliveryConfig: { providers: { claude: { defaultModel: "claude-sonnet-5", efforts: ["low", "medium", "high", "xhigh", "max"], models: [{ id: "claude-sonnet-5" }] } } },
    });
    const sessionId = await startSession(ctx);
    await expectRouteError(
      routeDelivery(
        { method: "POST", path: "/api/delivery/control", query: q(), body: { id: sessionId, type: "set-config", payload: { model: "unknown-model" } } },
        ctx,
      ),
      400,
      /unknown model/,
    );
  });
});

describe("(DW-5) GET /api/delivery/memory + /api/delivery/questions", () => {
  it("returns an empty ledger for a fresh session", async () => {
    const { ctx } = setup();
    const sessionId = await startSession(ctx);
    const result = await routeDelivery({ method: "GET", path: "/api/delivery/memory", query: q({ id: sessionId }), body: {} }, ctx);
    expect(result?.status).toBe(200);
    const json = result!.json as { ledger: { rev: number; questions: unknown[] } };
    expect(json.ledger.rev).toBe(0);
    expect(json.ledger.questions).toEqual([]);
  });

  it("404s for an unknown session on both routes", async () => {
    const { ctx } = setup();
    await expectRouteError(routeDelivery({ method: "GET", path: "/api/delivery/memory", query: q({ id: "nope" }), body: {} }, ctx), 404);
    await expectRouteError(routeDelivery({ method: "GET", path: "/api/delivery/questions", query: q({ id: "nope" }), body: {} }, ctx), 404);
  });

  it("splits questions into blocking/advisory/answered once the runner has written a ledger", async () => {
    const { ctx } = setup();
    const sessionId = await startSession(ctx);
    const dir = join(ctx.SESSIONS_DIR, sessionId);
    mkdirSync(join(dir, "memory"), { recursive: true });
    atomicWriteJsonSync(join(dir, "memory", "ledger.json"), {
      v: 1, rev: 2, updatedAt: new Date().toISOString(),
      objective: { itemText: null, problem: null, proposedBehavior: null },
      requirements: [], constraints: [], decisions: [],
      questions: [
        { id: "q-1", askedAt: "x", phase: "DISCOVERY", source: "agent", text: "blocking", kind: "blocking", status: "open", answer: null, evidence: null },
        { id: "q-2", askedAt: "x", phase: null, source: "owner", text: "advisory", kind: "advisory", status: "open", answer: null, evidence: null },
        { id: "q-3", askedAt: "x", phase: "DISCOVERY", source: "agent", text: "done", kind: "blocking", status: "answered", answer: { text: "yes", at: "x", via: null }, evidence: null },
      ],
      rejectedApproaches: [], fileIndex: [], testResults: [], risks: [], configHistory: [], workspace: null,
    });
    const result = await routeDelivery({ method: "GET", path: "/api/delivery/questions", query: q({ id: sessionId }), body: {} }, ctx);
    const json = result!.json as { blocking: unknown[]; advisory: unknown[]; answered: unknown[]; total: number };
    expect(json.blocking).toHaveLength(1);
    expect(json.advisory).toHaveLength(1);
    expect(json.answered).toHaveLength(1);
    expect(json.total).toBe(3);
  });
});

describe("(DW-3) GET /api/delivery/turns, /transcript, /prompt, /transcript/search", () => {
  function writeTranscriptFixture(dir: string) {
    mkdirSync(join(dir, "transcript", "prompts"), { recursive: true });
    writeFileSync(join(dir, "transcript", "prompts", "0001.md"), "Discovery prompt: investigate rounding drift.");
    writeFileSync(
      join(dir, "transcript", "t-0001.ndjson"),
      [
        JSON.stringify({ v: 1, turnId: "0001", seq: 1, ts: "t", kind: "prompt", provider: "claude", promptFile: "transcript/prompts/0001.md" }),
        JSON.stringify({ v: 1, turnId: "0001", seq: 2, ts: "t", kind: "assistant.text", provider: "claude", text: "Found a rounding drift in allocation splits." }),
      ].join("\n") + "\n",
    );
    writeFileSync(join(dir, "transcript", "prompts", "0002.md"), "Plan prompt.");
    writeFileSync(
      join(dir, "transcript", "t-0002.ndjson"),
      [JSON.stringify({ v: 1, turnId: "0002", seq: 1, ts: "t", kind: "prompt", provider: "claude", promptFile: "transcript/prompts/0002.md" })].join("\n") + "\n",
    );
    writeFileSync(
      join(dir, "transcript", "turns.ndjson"),
      [
        JSON.stringify({ v: 1, turnId: "0001", phase: "DISCOVERY", agent: "orchestrator", provider: "claude", model: "claude-sonnet-5", effort: "medium", startedAt: "t", durationMs: 10, promptFile: "transcript/prompts/0001.md", recordsFile: "transcript/t-0001.ndjson", records: 2, usage: { input: 1, cachedRead: 0, cacheCreation: 0, output: 1, reasoningOutput: 0 }, costUsd: null, costEstUsd: null, pricingVersion: null, context: { occupancyTokens: 1, windowTokens: null, pctUsed: null }, result: "ok", strategy: "start", snapshotRef: null, configChangeRef: null, compactBoundaries: null }),
        JSON.stringify({ v: 1, turnId: "0002", phase: "PLAN", agent: "orchestrator", provider: "claude", model: "claude-sonnet-5", effort: "high", startedAt: "t", durationMs: 10, promptFile: "transcript/prompts/0002.md", recordsFile: "transcript/t-0002.ndjson", records: 1, usage: { input: 1, cachedRead: 0, cacheCreation: 0, output: 1, reasoningOutput: 0 }, costUsd: null, costEstUsd: null, pricingVersion: null, context: { occupancyTokens: 1, windowTokens: null, pctUsed: null }, result: "ok", strategy: "resume-native", snapshotRef: null, configChangeRef: null, compactBoundaries: null }),
      ].join("\n") + "\n",
    );
  }

  it("getTurns returns turns after a numeric cursor", async () => {
    const { ctx } = setup();
    const sessionId = await startSession(ctx);
    writeTranscriptFixture(join(ctx.SESSIONS_DIR, sessionId));
    const result = await routeDelivery({ method: "GET", path: "/api/delivery/turns", query: q({ id: sessionId, after: "1" }), body: {} }, ctx);
    const json = result!.json as { turns: Array<{ turnId: string }>; lastTurn: number };
    expect(json.turns.map((t) => t.turnId)).toEqual(["0002"]);
    expect(json.lastTurn).toBe(2);
  });

  it("getTranscript returns a turn's records, sandboxed to a numeric turn id", async () => {
    const { ctx } = setup();
    const sessionId = await startSession(ctx);
    writeTranscriptFixture(join(ctx.SESSIONS_DIR, sessionId));
    const result = await routeDelivery({ method: "GET", path: "/api/delivery/transcript", query: q({ id: sessionId, turn: "0001" }), body: {} }, ctx);
    const json = result!.json as { records: Array<{ kind: string }>; lastSeq: number };
    expect(json.records).toHaveLength(2);
    expect(json.records[1].kind).toBe("assistant.text");
    expect(json.lastSeq).toBe(2);
  });

  it("getTranscript rejects a non-numeric turn id (path-traversal guard)", async () => {
    const { ctx } = setup();
    const sessionId = await startSession(ctx);
    writeTranscriptFixture(join(ctx.SESSIONS_DIR, sessionId));
    await expectRouteError(
      routeDelivery({ method: "GET", path: "/api/delivery/transcript", query: q({ id: sessionId, turn: "../../etc" }), body: {} }, ctx),
      400,
    );
  });

  it("getPrompt returns the exact assembled prompt text", async () => {
    const { ctx } = setup();
    const sessionId = await startSession(ctx);
    writeTranscriptFixture(join(ctx.SESSIONS_DIR, sessionId));
    const result = await routeDelivery({ method: "GET", path: "/api/delivery/prompt", query: q({ id: sessionId, turn: "0002" }), body: {} }, ctx);
    expect((result!.json as { content: string }).content).toBe("Plan prompt.");
  });

  it("getPrompt 404s for a turn with no prompt file", async () => {
    const { ctx } = setup();
    const sessionId = await startSession(ctx);
    writeTranscriptFixture(join(ctx.SESSIONS_DIR, sessionId));
    await expectRouteError(
      routeDelivery({ method: "GET", path: "/api/delivery/prompt", query: q({ id: sessionId, turn: "9999" }), body: {} }, ctx),
      404,
    );
  });

  it("searchTranscript finds matches with highlighted snippets, honoring phase/kind filters", async () => {
    const { ctx } = setup();
    const sessionId = await startSession(ctx);
    writeTranscriptFixture(join(ctx.SESSIONS_DIR, sessionId));
    const result = await routeDelivery(
      { method: "GET", path: "/api/delivery/transcript/search", query: q({ id: sessionId, q: "rounding drift" }), body: {} },
      ctx,
    );
    const json = result!.json as { matches: Array<{ turnId: string; kind: string; phase: string; snippet: string }>; truncated: boolean };
    expect(json.matches).toHaveLength(1);
    expect(json.matches[0]).toMatchObject({ turnId: "0001", kind: "assistant.text", phase: "DISCOVERY" });
    expect(json.matches[0].snippet).toContain("rounding drift");
    expect(json.truncated).toBe(false);
  });

  it("searchTranscript phase filter excludes non-matching turns", async () => {
    const { ctx } = setup();
    const sessionId = await startSession(ctx);
    writeTranscriptFixture(join(ctx.SESSIONS_DIR, sessionId));
    const result = await routeDelivery(
      { method: "GET", path: "/api/delivery/transcript/search", query: q({ id: sessionId, q: "prompt", phase: "PLAN" }), body: {} },
      ctx,
    );
    const json = result!.json as { matches: Array<{ turnId: string }> };
    expect(json.matches.every((m) => m.turnId === "0002")).toBe(true);
  });

  it("searchTranscript requires a non-empty query", async () => {
    const { ctx } = setup();
    const sessionId = await startSession(ctx);
    writeTranscriptFixture(join(ctx.SESSIONS_DIR, sessionId));
    await expectRouteError(
      routeDelivery({ method: "GET", path: "/api/delivery/transcript/search", query: q({ id: sessionId, q: "" }), body: {} }, ctx),
      400,
    );
  });

  it("searchTranscript returns empty results (not an error) for a pre-DW-1 session with no transcript/ dir", async () => {
    const { ctx } = setup();
    const sessionId = await startSession(ctx);
    const result = await routeDelivery(
      { method: "GET", path: "/api/delivery/transcript/search", query: q({ id: sessionId, q: "anything" }), body: {} },
      ctx,
    );
    expect((result!.json as { matches: unknown[] }).matches).toEqual([]);
  });
});

describe("(DW-7) GET /api/delivery/context, /context/preview, /context/snapshot", () => {
  it("returns empty snapshots/compactions/pins with healthy status for a fresh session", async () => {
    const { ctx } = setup();
    const sessionId = await startSession(ctx);
    const result = await routeDelivery({ method: "GET", path: "/api/delivery/context", query: q({ id: sessionId }), body: {} }, ctx);
    const json = result!.json as { snapshots: unknown[]; compactions: unknown[]; pins: unknown[]; rotations: number; health: { score: string; reasons: string[] } };
    expect(json.snapshots).toEqual([]);
    expect(json.compactions).toEqual([]);
    expect(json.pins).toEqual([]);
    expect(json.rotations).toBe(0);
    expect(json.health).toEqual({ score: "healthy", reasons: [] });
  });

  it("lists written snapshots/compactions and reports a warning health status for open blocking questions", async () => {
    const { ctx } = setup();
    const sessionId = await startSession(ctx);
    const dir = join(ctx.SESSIONS_DIR, sessionId);
    mkdirSync(join(dir, "context", "snapshots"), { recursive: true });
    mkdirSync(join(dir, "context", "compactions"), { recursive: true });
    mkdirSync(join(dir, "memory"), { recursive: true });
    atomicWriteJsonSync(join(dir, "context", "snapshots", "0001.json"), {
      v: 1, seq: 1, at: "t", reason: "rotate", layers: [], renderedMd: "", tokensEstTotal: 42, pins: [], forStrategy: "rotate-fresh", provider: "claude", model: "claude-sonnet-5",
    });
    atomicWriteJsonSync(join(dir, "context", "compactions", "0001.json"), {
      v: 1, seq: 1, at: "t", scope: { phase: "DISCOVERY" }, covers: { turns: [], eventSeq: [] }, mode: "mechanical", summaryMd: "digest", evidence: [],
    });
    atomicWriteJsonSync(join(dir, "memory", "ledger.json"), {
      v: 1, rev: 1, updatedAt: "t",
      objective: { itemText: null, problem: null, proposedBehavior: null },
      requirements: [], constraints: [], decisions: [],
      questions: [{ id: "q-1", askedAt: "t", phase: "DISCOVERY", source: "agent", text: "open blocker", kind: "blocking", status: "open", answer: null, evidence: null }],
      rejectedApproaches: [], fileIndex: [], testResults: [], risks: [], configHistory: [], workspace: null,
    });

    const result = await routeDelivery({ method: "GET", path: "/api/delivery/context", query: q({ id: sessionId }), body: {} }, ctx);
    const json = result!.json as { snapshots: Array<{ seq: number; tokensEstTotal: number }>; compactions: Array<{ seq: number }>; health: { score: string; reasons: string[] } };
    expect(json.snapshots).toEqual([{ seq: 1, at: "t", reason: "rotate", tokensEstTotal: 42, provider: "claude", model: "claude-sonnet-5" }]);
    expect(json.compactions[0].seq).toBe(1);
    expect(json.health.score).toBe("warning");
    expect(json.health.reasons[0]).toMatch(/unresolved blocking question/);
  });

  it("context/snapshot returns a specific snapshot by seq, 404 if missing", async () => {
    const { ctx } = setup();
    const sessionId = await startSession(ctx);
    const dir = join(ctx.SESSIONS_DIR, sessionId);
    mkdirSync(join(dir, "context", "snapshots"), { recursive: true });
    atomicWriteJsonSync(join(dir, "context", "snapshots", "0001.json"), { v: 1, seq: 1, renderedMd: "full content" });
    const result = await routeDelivery({ method: "GET", path: "/api/delivery/context/snapshot", query: q({ id: sessionId, seq: "1" }), body: {} }, ctx);
    expect((result!.json as { renderedMd: string }).renderedMd).toBe("full content");
    await expectRouteError(
      routeDelivery({ method: "GET", path: "/api/delivery/context/snapshot", query: q({ id: sessionId, seq: "9" }), body: {} }, ctx),
      404,
    );
  });

  it("context/preview is a pure read-only computation reflecting the current ledger + artifacts, with no side effects", async () => {
    const { ctx } = setup();
    const sessionId = await startSession(ctx);
    const dir = join(ctx.SESSIONS_DIR, sessionId);
    mkdirSync(join(dir, "artifacts"), { recursive: true });
    writeFileSync(join(dir, "artifacts", "spec.md"), "# Spec\n");

    const result = await routeDelivery({ method: "GET", path: "/api/delivery/context/preview", query: q({ id: sessionId }), body: {} }, ctx);
    const json = result!.json as { layers: Array<{ name: string; text: string }>; tokenEstimate: number; renderedMd: string };
    const artifactsLayer = json.layers.find((l) => l.name === "artifacts");
    expect(artifactsLayer?.text).toContain("artifacts/spec.md");
    expect(json.tokenEstimate).toBeGreaterThan(0);

    // no snapshot/compaction files were written by merely previewing
    expect(existsSync(join(dir, "context", "snapshots"))).toBe(false);
    expect(existsSync(join(dir, "context", "compactions"))).toBe(false);
  });

  it("404s for an unknown session on all three routes", async () => {
    const { ctx } = setup();
    await expectRouteError(routeDelivery({ method: "GET", path: "/api/delivery/context", query: q({ id: "nope" }), body: {} }, ctx), 404);
    await expectRouteError(routeDelivery({ method: "GET", path: "/api/delivery/context/preview", query: q({ id: "nope" }), body: {} }, ctx), 404);
    await expectRouteError(routeDelivery({ method: "GET", path: "/api/delivery/context/snapshot", query: q({ id: "nope", seq: "1" }), body: {} }, ctx), 404);
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
