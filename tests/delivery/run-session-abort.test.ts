// DW-10 acceptance tests: owner-initiated mid-turn abort. A turn is a single
// await inside one `advanceSession` tick, so `controls/` is only drained
// between ticks — an abort request that arrives *during* a turn can only
// reach it via the concurrent poller in `runGuardedTurn` (`watchForAbort`).
// These tests genuinely race a scripted, artificially-delayed fake-driver
// turn against a control file written mid-flight (real timers, small delays).
import { mkdirSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from "node:fs";
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
  const root = mkdtempSync(join(tmpdir(), "delivery-abort-"));
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
      sessionId, agent: "claude", item,
      context: { campaignFiles: [], relatedNotes: [] },
      scopeHints: { keywords: [], globs: [], modules: ["Budget"] },
      capabilities: [
        { name: "automated-testing", reason: "always-on", source: "rule", blocking: true },
        { name: "code-review", reason: "always-on", source: "rule", blocking: true },
        { name: "uat-generation", reason: "always-on", source: "rule", blocking: true },
      ],
      skills: [], acceptanceCriteria: [],
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

function writeDecision(dir: string, seq: number, gate: string, decision: string) {
  const decisionsDir = join(dir, "decisions");
  mkdirSync(decisionsDir, { recursive: true });
  atomicWriteJsonSync(join(decisionsDir, `${String(seq).padStart(4, "0")}-${gate}.json`), {
    seq, gate, decision, note: null, confirmText: null, tickCheckbox: true, answer: null,
    capabilitiesDrop: null, at: new Date().toISOString(),
  });
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

async function advanceOnce(dir: string, driver: object, repoRoot: string, extra: Record<string, unknown> = {}) {
  return advanceSession({
    sessionDir: dir, driver, repoRoot, retryDelayMs: 0, sleep: () => {}, takeSnapshot: stableSnapshot,
    readHead: () => "fixture-shipped-head",
    ...extra,
  });
}

function sleep(ms: number) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

const SPEC_TEXT = JSON.stringify({
  problem: "p", currentBehavior: "c", proposedBehavior: "pb",
  acceptanceCriteria: [{ id: "AC1", text: "works" }], affectedPaths: [], riskFlags: [], openQuestions: [],
});
const PLAN_TEXT = JSON.stringify({
  steps: [{ id: "S1", description: "do it", paths: [], validationHint: "pnpm test" }],
  testPlan: "t", riskFlags: [], rollbackSketch: "r", noNewDeps: true,
});

async function driveToBuilding(dir: string, driver: object, root: string) {
  await advanceOnce(dir, driver, root); // SELECTED -> DISCOVERY
  await advanceOnce(dir, driver, root); // DISCOVERY turn -> SPEC_READY
  writeDecision(dir, 1, "spec", "approve");
  await advanceOnce(dir, driver, root); // PLAN turn -> PLAN_READY
  writeDecision(dir, 2, "plan", "approve");
  const tick = await advanceOnce(dir, driver, root); // PLAN_READY -> BUILDING (no turn yet)
  expect(tick.state.state).toBe("BUILDING");
}

describe("DW-10: mid-turn abort", () => {
  it("aborts an in-flight BUILDING turn when a pause{abortInFlight:true} control lands mid-turn, sealing it as 'aborted' and blocking the phase", async () => {
    const root = setupRepo();
    const { dir } = makePacketAndState(root);
    const driver = createDriver("fake", {
      script: {
        turns: [
          { finalText: SPEC_TEXT, usage: { input: 1, cachedRead: 0, cacheCreation: 0, output: 1, reasoningOutput: 0 } },
          { finalText: PLAN_TEXT, usage: { input: 1, cachedRead: 0, cacheCreation: 0, output: 1, reasoningOutput: 0 } },
          { finalText: "build attempt 1", delayMs: 150 },
        ],
      },
    });

    await driveToBuilding(dir, driver, root);

    // Start the BUILDING tick (turnId 0003) without awaiting yet, then race an
    // abort control against its scripted 150ms delay — abortPollMs is small
    // so the concurrent poller inside runGuardedTurn picks it up quickly.
    const buildTickPromise = advanceOnce(dir, driver, root, { abortPollMs: 10 });
    await sleep(30);
    writeControl(dir, 1, "pause", { abortInFlight: true });

    const buildTick = await buildTickPromise;
    expect(buildTick.state.state).toBe("BLOCKED");
    expect(buildTick.state.awaiting).toEqual({ gate: "blocked", returnTo: "BUILDING" });
    expect(buildTick.state.lastError.aborted).toBe(true);
    expect(buildTick.state.lastError.message).toMatch(/aborted by owner/i);

    const turns = parseTurns(readFileSync(join(dir, "transcript", "turns.ndjson"), "utf8"));
    expect(turns).toHaveLength(3);
    const aborted = turns[2];
    expect(aborted.result).toBe("aborted");
    expect(aborted.phase).toBe("BUILDING");
    expect(aborted.workspaceDelta).toEqual({ changedPaths: [] });

    const events = readEvents(dir);
    const abortEvent = events.find((e) => e.type === "turn.aborted") as { data: { changedPaths: string[] } } | undefined;
    expect(abortEvent).toBeDefined();
    expect(abortEvent!.data.changedPaths).toEqual([]);

    // The pause control itself is only drained on the *next* tick (controls
    // aren't consumed mid-turn — the poller only detects and aborts).
    expect(buildTick.state.controlsProcessed || 0).toBe(0);
    const drainTick = await advanceOnce(dir, driver, root);
    expect(drainTick.state.execution.paused).toBe(true);
    expect(drainTick.state.controlsProcessed).toBe(1);
  });

  it("never retries an aborted turn (unlike a generic failure, which retries once)", async () => {
    const root = setupRepo();
    const { dir } = makePacketAndState(root);
    const driver = createDriver("fake", {
      script: {
        turns: [
          { finalText: SPEC_TEXT, usage: { input: 1, cachedRead: 0, cacheCreation: 0, output: 1, reasoningOutput: 0 } },
          { finalText: PLAN_TEXT, usage: { input: 1, cachedRead: 0, cacheCreation: 0, output: 1, reasoningOutput: 0 } },
          { finalText: "build attempt 1", delayMs: 150 },
        ],
      },
    });
    await driveToBuilding(dir, driver, root);

    const buildTickPromise = advanceOnce(dir, driver, root, { abortPollMs: 10, retryDelayMs: 0 });
    await sleep(30);
    writeControl(dir, 1, "pause", { abortInFlight: true });
    await buildTickPromise;

    // The script only had exactly 3 turns scripted — if the aborted BUILDING
    // turn had been retried, this next call would throw "script exhausted"
    // instead of cleanly resuming the BLOCKED gate flow.
    const turns = parseTurns(readFileSync(join(dir, "transcript", "turns.ndjson"), "utf8"));
    expect(turns).toHaveLength(3);
  });
});
