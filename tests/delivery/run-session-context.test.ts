// DW-7 acceptance tests: context rotation (mechanical digest + snapshot +
// fresh driver ref) and pin/unpin, driven through run-session.mjs's state
// machine. Mirrors the fixture pattern in the other run-session-*.test.ts files.
import { mkdirSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { afterEach, describe, expect, it } from "vitest";

import { createDriver } from "../../scripts/delivery/drivers/driver.mjs";
import "../../scripts/delivery/drivers/fake.mjs";
import { buildControl, controlFileName } from "../../scripts/delivery/controls.mjs";
import { atomicWriteJsonSync } from "../../scripts/delivery/fsx.mjs";
import { buildItemIdentity, buildPacket, makeSessionId } from "../../scripts/delivery/packet.mjs";
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
  const root = mkdtempSync(join(tmpdir(), "delivery-context-"));
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

describe("DW-7: owner-triggered rotation", () => {
  it("writes a mechanical compaction + context snapshot and archives the driver ref", async () => {
    const root = setupRepo();
    const { dir } = makePacketAndState(root);
    const driver = createDriver("fake", { script: { turns: [{ finalText: SPEC_TEXT, usage: { input: 1, cachedRead: 0, cacheCreation: 0, output: 1, reasoningOutput: 0 } }] } });

    await advanceOnce(dir, driver, root); // SELECTED -> DISCOVERY
    const discoveryTick = await advanceOnce(dir, driver, root); // DISCOVERY turn -> SPEC_READY
    expect(discoveryTick.state.driver.ref).toBeTruthy(); // a ref was established by the DISCOVERY turn

    writeControl(dir, 1, "rotate");
    const rotateTick = await advanceOnce(dir, driver, root);
    expect(rotateTick.state.driver.ref).toBeNull(); // archived — next getHandle starts fresh
    expect(rotateTick.state.driver.priorRefs).toHaveLength(1);
    expect(rotateTick.state.driver.priorRefs[0].reason).toBe("rotate");
    expect(rotateTick.state.context.rotations).toBe(1);
    expect(rotateTick.state.context.lastCompactionSeq).toBe(1);
    expect(rotateTick.state.context.lastSnapshotSeq).toBe(1);

    const compaction = JSON.parse(readFileSync(join(dir, "context", "compactions", "0001.json"), "utf8"));
    expect(compaction.mode).toBe("mechanical");
    // digests the phase the last turn actually ran in (DISCOVERY), not the
    // current gate state (SPEC_READY) — a gate is one step past its phase.
    expect(compaction.scope.phase).toBe("DISCOVERY");
    expect(compaction.summaryMd).toContain("turn 0001");

    const snapshot = JSON.parse(readFileSync(join(dir, "context", "snapshots", "0001.json"), "utf8"));
    expect(snapshot.reason).toBe("rotate");
    expect(snapshot.tokensEstTotal).toBeGreaterThan(0);
    expect(snapshot.layers.some((l: { name: string }) => l.name === "digests")).toBe(true);
  });

  it("a rotated session still resumes work correctly (fresh ref established on next turn)", async () => {
    const root = setupRepo();
    const { dir } = makePacketAndState(root);
    // DLV-31 regression: the SAME driver instance must survive a rotation.
    // A prior version of this test built a brand-new `planDriver` for the
    // post-rotation turn — a fresh instance naturally has its internal
    // `started` flag false, which passed regardless of whether the runner
    // ever reset the reused instance. The runner creates exactly one driver
    // per process (runLoop) and reuses it for the whole session, so that is
    // the case that actually exercises the bug: `startSession` threw
    // "session already started" on this very instance because nothing told
    // it the SDK-side session had been archived.
    const planText = JSON.stringify({
      steps: [{ id: "S1", description: "d", paths: [], validationHint: "pnpm test" }],
      testPlan: "t", riskFlags: [], rollbackSketch: "r", noNewDeps: true,
    });
    const driver = createDriver("fake", {
      script: {
        turns: [
          { finalText: SPEC_TEXT, usage: { input: 1, cachedRead: 0, cacheCreation: 0, output: 1, reasoningOutput: 0 } },
          { finalText: planText, usage: { input: 1, cachedRead: 0, cacheCreation: 0, output: 1, reasoningOutput: 0 } },
        ],
      },
    });
    await advanceOnce(dir, driver, root); // SELECTED -> DISCOVERY
    await advanceOnce(dir, driver, root); // DISCOVERY turn -> SPEC_READY
    writeControl(dir, 1, "rotate");
    await advanceOnce(dir, driver, root); // rotate: archives the ref, does NOT reset the driver instance itself

    const decisionsDir = join(dir, "decisions");
    mkdirSync(decisionsDir, { recursive: true });
    atomicWriteJsonSync(join(decisionsDir, "0001-spec.json"), {
      seq: 1, gate: "spec", decision: "approve", note: null, confirmText: null, tickCheckbox: true, answer: null,
      capabilitiesDrop: null, at: new Date().toISOString(),
    });
    // Before DLV-31's fix, this call's getHandle would invoke startSession on
    // the same still-`started` driver instance and throw — the session would
    // never reach PLAN_READY.
    const result = await advanceOnce(dir, driver, root);
    expect(result.state.state).toBe("PLAN_READY");
    expect(result.state.driver.ref).toBeTruthy(); // a brand-new ref was established post-rotation
  });
});

describe("DLV-30: automatic phase-boundary rotation", () => {
  it("a short session with small occupancy makes zero automatic rotations, but still evaluates and records the decision every turn", async () => {
    const root = setupRepo();
    const { dir } = makePacketAndState(root);
    const planText = JSON.stringify({
      steps: [{ id: "S1", description: "d", paths: [], validationHint: "pnpm test" }],
      testPlan: "t", riskFlags: [], rollbackSketch: "r", noNewDeps: true,
    });
    const driver = createDriver("fake", {
      script: {
        turns: [
          { finalText: SPEC_TEXT, usageV2: { input: 1, cachedRead: 100, cacheCreation: 0, output: 1, reasoningOutput: 0 } },
          { finalText: planText, usageV2: { input: 1, cachedRead: 100, cacheCreation: 0, output: 1, reasoningOutput: 0 } },
        ],
      },
    });
    await advanceOnce(dir, driver, root); // SELECTED -> DISCOVERY
    await advanceOnce(dir, driver, root); // DISCOVERY turn -> SPEC_READY

    const decisionsDir = join(dir, "decisions");
    mkdirSync(decisionsDir, { recursive: true });
    atomicWriteJsonSync(join(decisionsDir, "0001-spec.json"), {
      seq: 1, gate: "spec", decision: "approve", note: null, confirmText: null, tickCheckbox: true, answer: null,
      capabilitiesDrop: null, at: new Date().toISOString(),
    });
    const result = await advanceOnce(dir, driver, root); // approve -> PLAN turn -> PLAN_READY

    expect(result.state.state).toBe("PLAN_READY");
    expect(result.state.context.rotations || 0).toBe(0);
    expect(result.state.driver.priorRefs || []).toHaveLength(0);

    // Every decideContextStrategy call is recorded, even the ones that
    // decide not to act — the DISCOVERY->PLAN transition IS a phase
    // boundary, it just doesn't cross rotateAtTokens (config default
    // 150,000) at these tiny occupancy numbers.
    const strategyEvents = readEvents(dir).filter((e) => e.type === "context.strategy");
    expect(strategyEvents.length).toBeGreaterThanOrEqual(2);
    expect(strategyEvents.every((e) => (e.data as { strategy: string }).strategy === "resume-native")).toBe(true);
    const planBoundaryEvent = strategyEvents.find((e) => e.phase === "PLAN");
    expect((planBoundaryEvent!.data as { isPhaseBoundary: boolean }).isPhaseBoundary).toBe(true);
  });

  it("occupancy crossing rotateAtTokens at a phase boundary triggers an automatic rotation, and the rotated session still completes the next phase", async () => {
    const root = setupRepo();
    const { dir } = makePacketAndState(root);
    const planText = JSON.stringify({
      steps: [{ id: "S1", description: "d", paths: [], validationHint: "pnpm test" }],
      testPlan: "t", riskFlags: [], rollbackSketch: "r", noNewDeps: true,
    });
    const driver = createDriver("fake", {
      script: {
        turns: [
          // config default rotateAtTokens is 150,000 — this DISCOVERY turn's
          // occupancy (input+cachedRead+cacheCreation) clears it comfortably.
          { finalText: SPEC_TEXT, usageV2: { input: 1000, cachedRead: 200000, cacheCreation: 0, output: 1, reasoningOutput: 0 } },
          { finalText: planText, usageV2: { input: 1, cachedRead: 100, cacheCreation: 0, output: 1, reasoningOutput: 0 } },
        ],
      },
    });
    await advanceOnce(dir, driver, root); // SELECTED -> DISCOVERY
    const discoveryTick = await advanceOnce(dir, driver, root); // DISCOVERY turn -> SPEC_READY
    const refBeforeRotation = discoveryTick.state.driver.ref!.id;

    const decisionsDir = join(dir, "decisions");
    mkdirSync(decisionsDir, { recursive: true });
    atomicWriteJsonSync(join(decisionsDir, "0001-spec.json"), {
      seq: 1, gate: "spec", decision: "approve", note: null, confirmText: null, tickCheckbox: true, answer: null,
      capabilitiesDrop: null, at: new Date().toISOString(),
    });
    // Before DLV-30's fix, decideContextStrategy was never called by the
    // runner at all (rotateAtTokens was dead config) — this same-sized
    // packet+conversation would have resumed the same ever-growing SDK
    // session straight through PLAN, REVIEWING, and UAT.
    const result = await advanceOnce(dir, driver, root); // approve -> auto-rotate -> PLAN turn -> PLAN_READY

    expect(result.state.state).toBe("PLAN_READY");
    expect(result.state.context.rotations).toBe(1);
    expect(result.state.driver.priorRefs).toHaveLength(1);
    expect(result.state.driver.priorRefs[0].reason).toBe("auto-phase-boundary");
    expect(result.state.driver.priorRefs[0].ref.id).toBe(refBeforeRotation);
    // A brand-new ref was established post-rotation for PLAN, not the
    // DISCOVERY turn's ref (D2's driver.reset() fix is what lets this
    // startSession succeed at all on the one reused driver instance).
    expect(result.state.driver.ref!.id).not.toBe(refBeforeRotation);

    const strategyEvents = readEvents(dir).filter((e) => e.type === "context.strategy");
    const rotateEvent = strategyEvents.find((e) => (e.data as { strategy: string }).strategy === "rotate-fresh");
    expect(rotateEvent).toBeTruthy();
    expect(rotateEvent!.phase).toBe("PLAN");
    expect((rotateEvent!.data as { reasons: string[] }).reasons[0]).toMatch(/occupancy \d+ tokens >= rotateAtTokens 150000/);

    // The compaction + snapshot artifacts performRotation always writes are
    // present, same as the owner-triggered rotate control (DW-7).
    const compaction = JSON.parse(readFileSync(join(dir, "context", "compactions", "0001.json"), "utf8"));
    expect(compaction.scope.phase).toBe("DISCOVERY");
  });
});

describe("DW-7: pin / unpin", () => {
  it("pin extracts the record text from the transcript shard and stores it verbatim", async () => {
    const root = setupRepo();
    const { dir } = makePacketAndState(root);
    const driver = createDriver("fake", {
      script: { turns: [{ finalText: SPEC_TEXT, usage: { input: 1, cachedRead: 0, cacheCreation: 0, output: 1, reasoningOutput: 0 }, rawRecords: [{ kind: "assistant.text", text: "This is the exact error text worth pinning." }] }] },
    });
    await advanceOnce(dir, driver, root);
    await advanceOnce(dir, driver, root);

    writeControl(dir, 1, "pin", { turnId: "0001", seqFrom: 2, seqTo: 2, note: "the error" });
    const tick = await advanceOnce(dir, driver, root);
    expect(tick.state.context.pins).toHaveLength(1);
    expect(tick.state.context.pins[0].text).toContain("exact error text worth pinning");
  });

  it("unpin removes a pin by turnId", async () => {
    const root = setupRepo();
    const { dir } = makePacketAndState(root);
    const driver = createDriver("fake", { script: { turns: [{ finalText: SPEC_TEXT, usage: { input: 1, cachedRead: 0, cacheCreation: 0, output: 1, reasoningOutput: 0 } }] } });
    await advanceOnce(dir, driver, root);
    await advanceOnce(dir, driver, root);

    writeControl(dir, 1, "pin", { turnId: "0001", seqFrom: 1, seqTo: 1 });
    await advanceOnce(dir, driver, root);
    writeControl(dir, 2, "unpin", { turnId: "0001" });
    const tick = await advanceOnce(dir, driver, root);
    expect(tick.state.context.pins).toEqual([]);
  });
});
