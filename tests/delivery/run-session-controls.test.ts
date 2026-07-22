// DW-4 acceptance tests: cooperative pause/resume + same-provider model/effort
// change via the controls channel, layered on run-session.mjs's state-machine
// harness. Mirrors the fixture pattern in run-session.test.ts / run-session-transcript.test.ts.
import { existsSync, mkdirSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { afterEach, describe, expect, it } from "vitest";

import { createDriver } from "../../scripts/delivery/drivers/driver.mjs";
import "../../scripts/delivery/drivers/fake.mjs";
import { buildControl, controlFileName } from "../../scripts/delivery/controls.mjs";
import { atomicWriteJsonSync } from "../../scripts/delivery/fsx.mjs";
import { buildItemIdentity, buildPacket, makeSessionId } from "../../scripts/delivery/packet.mjs";
import { parseTurns } from "../../scripts/delivery/transcript.mjs";
import { advanceSession } from "../../scripts/delivery/run-session.mjs";

type BuildPacketArgs = Parameters<typeof buildPacket>[0];
function asPacketArgs(partial: object): BuildPacketArgs {
  return partial as unknown as BuildPacketArgs;
}

const cleanupDirs: string[] = [];
afterEach(() => {
  while (cleanupDirs.length) {
    const dir = cleanupDirs.pop();
    if (dir) rmSync(dir, { recursive: true, force: true });
  }
});

function setupRepo(): string {
  const root = mkdtempSync(join(tmpdir(), "delivery-controls-"));
  cleanupDirs.push(root);
  writeFileSync(join(root, "README.md"), "test repo\n");
  return root;
}

const STABLE_SNAPSHOT = Object.freeze({
  status: "", head: "fixture-head", refs: "fixture-refs", indexDiff: "", trackedDiff: "", fingerprints: {},
});
function stableSnapshot() {
  return { ...STABLE_SNAPSHOT, fingerprints: {} };
}

function makePacketAndState(root: string) {
  const raw = ["# Now", "", "- [ ] **N1** Fix rounding drift _(blocker - M)_", ""].join("\n");
  const pmFile = "Budget/4 - Checklist.md";
  const idResult = buildItemIdentity(raw, 0, pmFile);
  if (!idResult.ok) throw new Error(`fixture setup failed: ${(idResult as { reason: string }).reason}`);
  const item = (idResult as { ok: true; item: Record<string, unknown> }).item;
  const sessionId = makeSessionId(new Date(2026, 0, 1), () => 0.42);
  const dir = join(root, ".delivery", "sessions", sessionId);
  mkdirSync(dir, { recursive: true });
  const packet = buildPacket(
    asPacketArgs({
      sessionId,
      agent: "claude",
      agentConfig: { model: "claude-sonnet-5", effort: { discovery: "medium", plan: "high", building: "high", review: "medium" } },
      item,
      context: { campaignFiles: [], relatedNotes: [] },
      scopeHints: { keywords: [], globs: [], modules: ["Budget"] },
      capabilities: [
        { name: "automated-testing", reason: "always-on", source: "rule", blocking: true },
        { name: "code-review", reason: "always-on", source: "rule", blocking: true },
        { name: "uat-generation", reason: "always-on", source: "rule", blocking: true },
      ],
      skills: [],
      acceptanceCriteria: [],
      workspace: { baseHead: "HEAD", dirtyAtStart: false, baselineStatusHash: "x", changedFiles: [] },
    }),
  );
  atomicWriteJsonSync(join(dir, "packet.json"), packet);
  const now = new Date().toISOString();
  const state = {
    schemaVersion: 1, sessionId, state: "SELECTED", awaiting: null,
    phaseHistory: [{ state: "SELECTED", enteredAt: now, exitedAt: null }],
    agent: "claude", driver: { ref: null, specialists: {} }, workspace: packet.workspace,
    build: null, fixLoop: 0,
    usage: { perPhase: {}, total: { input: 0, cachedInput: 0, output: 0, costUsd: null } },
    decisionsProcessed: 0, messagesProcessed: 0, lastError: null, createdAt: now, updatedAt: now,
  };
  atomicWriteJsonSync(join(dir, "state.json"), state);
  return { dir, packet };
}

function writeControl(dir: string, seq: number, type: string, payload: object = {}) {
  const controlsDir = join(dir, "controls");
  mkdirSync(controlsDir, { recursive: true });
  const control = buildControl({ seq, type, payload });
  atomicWriteJsonSync(join(controlsDir, controlFileName(control)), control);
}

function readEvents(dir: string): Array<Record<string, unknown>> {
  const text = readFileSync(join(dir, "events.ndjson"), "utf8");
  return text.trim().split("\n").filter(Boolean).map((line) => JSON.parse(line));
}

async function advanceOnce(dir: string, driver: object, repoRoot: string) {
  return advanceSession({
    sessionDir: dir, driver, repoRoot, retryDelayMs: 0, sleep: () => {}, takeSnapshot: stableSnapshot,
    readHead: () => "fixture-shipped-head",
  });
}

const SPEC_TEXT = JSON.stringify({
  problem: "p", currentBehavior: "c", proposedBehavior: "pb",
  acceptanceCriteria: [{ id: "AC1", text: "works" }], affectedPaths: [], riskFlags: [], openQuestions: [],
});

describe("DW-4: pause / resume-run", () => {
  it("pausing before any turn skips phase work entirely until resume-run", async () => {
    const root = setupRepo();
    const { dir } = makePacketAndState(root);
    const driver = createDriver("fake", { script: { turns: [{ finalText: SPEC_TEXT, usage: { input: 1, cachedRead: 0, cacheCreation: 0, output: 1, reasoningOutput: 0 } }] } });

    writeControl(dir, 1, "pause");
    const drainTick = await advanceOnce(dir, driver, root); // consumes the pause control
    expect(drainTick.state.execution.paused).toBe(true);
    expect(drainTick.state.controlsProcessed).toBe(1);

    const events = readEvents(dir);
    expect(events.some((e) => e.type === "execution.paused")).toBe(true);

    // SELECTED -> DISCOVERY would normally happen here; paused means no work.
    const whilePaused = await advanceOnce(dir, driver, root);
    expect(whilePaused.didWork).toBe(false);
    expect(whilePaused.state.state).toBe("SELECTED"); // never advanced

    writeControl(dir, 2, "resume-run");
    const resumeTick = await advanceOnce(dir, driver, root);
    expect(resumeTick.state.execution.paused).toBe(false);
    expect(readEvents(dir).some((e) => e.type === "execution.resumed")).toBe(true);

    const afterResume = await advanceOnce(dir, driver, root); // SELECTED -> DISCOVERY now proceeds
    expect(afterResume.state.state).toBe("DISCOVERY");
  });

  it("a session with no execution field and no controls/ dir behaves exactly as before (back-compat)", async () => {
    const root = setupRepo();
    const { dir } = makePacketAndState(root);
    const driver = createDriver("fake", { script: { turns: [{ finalText: SPEC_TEXT, usage: { input: 1, cachedRead: 0, cacheCreation: 0, output: 1, reasoningOutput: 0 } }] } });
    expect(existsSync(join(dir, "controls"))).toBe(false);
    const result = await advanceOnce(dir, driver, root);
    expect(result.didWork).toBe(true);
    expect(result.state.state).toBe("DISCOVERY");
  });
});

describe("DW-4: same-provider set-config (model/effort override)", () => {
  it("changes state.execution.model, marks the next turn resume-with-overrides, then clears back to resume-native", async () => {
    const root = setupRepo();
    const { dir } = makePacketAndState(root);
    const driver = createDriver("fake", {
      script: {
        turns: [
          { finalText: SPEC_TEXT, usage: { input: 1, cachedRead: 0, cacheCreation: 0, output: 1, reasoningOutput: 0 } },
          { finalText: JSON.stringify({ steps: [{ id: "S1", description: "d", paths: [], validationHint: "pnpm test" }], testPlan: "t", riskFlags: [], rollbackSketch: "r", noNewDeps: true }), usage: { input: 1, cachedRead: 0, cacheCreation: 0, output: 1, reasoningOutput: 0 } },
        ],
      },
    });

    await advanceOnce(dir, driver, root); // SELECTED -> DISCOVERY
    await advanceOnce(dir, driver, root); // DISCOVERY turn (turnId 0001, strategy "start")

    writeControl(dir, 1, "set-config", { model: "claude-fable-5" });
    const configTick = await advanceOnce(dir, driver, root);
    expect(configTick.state.execution.model).toBe("claude-fable-5");
    expect(configTick.state.execution.configChangedSinceLastTurn).toBe(true);

    const events = readEvents(dir);
    const changed = events.find((e) => e.type === "config.changed") as { data: { from: object; to: object } } | undefined;
    expect(changed).toBeDefined();
    expect((changed!.data.to as { model: string }).model).toBe("claude-fable-5");

    // approve the spec gate -> runs the PLAN turn (turnId 0002), which should
    // see the pending override and use strategy resume-with-overrides.
    const decisionsDir = join(dir, "decisions");
    mkdirSync(decisionsDir, { recursive: true });
    atomicWriteJsonSync(join(decisionsDir, "0001-spec.json"), {
      seq: 1, gate: "spec", decision: "approve", note: null, confirmText: null, tickCheckbox: true, answer: null,
      capabilitiesDrop: null, at: new Date().toISOString(),
    });
    const planTick = await advanceOnce(dir, driver, root);
    expect(planTick.state.state).toBe("PLAN_READY");
    expect(planTick.state.execution.configChangedSinceLastTurn).toBe(false); // cleared after being consumed

    const turns = parseTurns(readFileSync(join(dir, "transcript", "turns.ndjson"), "utf8"));
    expect(turns[0].strategy).toBe("start");
    expect(turns[1].strategy).toBe("resume-with-overrides");
    expect(turns[1].model).toBe("claude-fable-5");
  });

  it("rejects an empty set-config payload with ControlsError at build time", () => {
    expect(() => buildControl({ seq: 1, type: "set-config", payload: {} })).toThrow();
  });
});

// Provider-switch set-config now performs a full handoff (DW-8) — see
// tests/delivery/run-session-handoff.test.ts.

// Regression: cancel is legal from any non-terminal state (state-machine.mjs
// NON_TERMINAL_STATES), but before this fix a cancel decision was only ever
// consumed inside the gate-state branch of advanceSession. A session paused
// in a non-gate state (SELECTED/DISCOVERY/BUILDING/...) never reaches a gate
// on its own while paused, so the pending cancel sat unconsumed forever —
// the owner's "cancel this stuck delivery" had no effect. advanceSession now
// checks for a pending cancel before the pause short-circuit.
describe("cancel is immediate even while paused in a non-gate state", () => {
  it("cancels a session paused at SELECTED without it ever reaching DISCOVERY", async () => {
    const root = setupRepo();
    const { dir } = makePacketAndState(root);
    const driver = createDriver("fake", { script: { turns: [{ finalText: SPEC_TEXT }] } });

    writeControl(dir, 1, "pause");
    await advanceOnce(dir, driver, root); // consumes the pause control
    const stillPaused = await advanceOnce(dir, driver, root);
    expect(stillPaused.state.state).toBe("SELECTED"); // paused before ever leaving SELECTED
    expect(stillPaused.didWork).toBe(false);

    const decisionsDir = join(dir, "decisions");
    mkdirSync(decisionsDir, { recursive: true });
    atomicWriteJsonSync(join(decisionsDir, "0001-cancel.json"), {
      seq: 1, gate: null, decision: "cancel", note: null, confirmText: null, tickCheckbox: true, answer: null,
      capabilitiesDrop: null, at: new Date().toISOString(),
    });

    const cancelled = await advanceOnce(dir, driver, root);
    expect(cancelled.didWork).toBe(true);
    expect(cancelled.state.state).toBe("CANCELLED");
  });
});
