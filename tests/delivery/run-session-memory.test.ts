// DW-5 acceptance tests: the memory ledger is seeded/updated at every
// boundary (spec, plan, decisions, Q&A) as sessions drive through
// run-session.mjs's state machine. Mirrors the fixture pattern in the other
// run-session-*.test.ts files.
import { existsSync, mkdirSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from "node:fs";
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
  const root = mkdtempSync(join(tmpdir(), "delivery-memory-"));
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

function writeDecision(dir: string, seq: number, gate: string, decision: string, extra: Record<string, unknown> = {}) {
  const decisionsDir = join(dir, "decisions");
  mkdirSync(decisionsDir, { recursive: true });
  atomicWriteJsonSync(join(decisionsDir, `${String(seq).padStart(4, "0")}-${gate}.json`), {
    seq, gate, decision, note: null, confirmText: null, tickCheckbox: true, answer: null,
    capabilitiesDrop: null, at: new Date().toISOString(), ...extra,
  });
}

function writeControl(dir: string, seq: number, type: string, payload: object = {}) {
  const controlsDir = join(dir, "controls");
  mkdirSync(controlsDir, { recursive: true });
  const control = buildControl({ seq, type, payload });
  atomicWriteJsonSync(join(controlsDir, controlFileName(control)), control);
}

function readLedger(dir: string) {
  return JSON.parse(readFileSync(join(dir, "memory", "ledger.json"), "utf8"));
}

async function advanceOnce(dir: string, driver: object, repoRoot: string) {
  return advanceSession({
    sessionDir: dir, driver, repoRoot, retryDelayMs: 0, sleep: () => {}, takeSnapshot: stableSnapshot,
    readHead: () => "fixture-shipped-head",
  });
}

const SPEC_TEXT = JSON.stringify({
  problem: "rounding drifts by a cent", currentBehavior: "c", proposedBehavior: "round consistently",
  acceptanceCriteria: [{ id: "AC1", text: "allocation splits sum exactly" }],
  affectedPaths: [], riskFlags: [], openQuestions: [],
});
const PLAN_TEXT = JSON.stringify({
  steps: [{ id: "S1", description: "d", paths: [], validationHint: "pnpm test" }],
  testPlan: "t", riskFlags: ["db-migration"], rollbackSketch: "r", noNewDeps: true,
});

describe("DW-5: ledger seeded from the DISCOVERY spec", () => {
  it("records the objective, requirements, and a spec-approve decision", async () => {
    const root = setupRepo();
    const { dir } = makePacketAndState(root);
    const driver = createDriver("fake", { script: { turns: [{ finalText: SPEC_TEXT, usage: { input: 1, cachedRead: 0, cacheCreation: 0, output: 1, reasoningOutput: 0 } }] } });

    await advanceOnce(dir, driver, root); // SELECTED -> DISCOVERY
    await advanceOnce(dir, driver, root); // DISCOVERY turn -> SPEC_READY

    const ledger = readLedger(dir);
    expect(ledger.objective.problem).toBe("rounding drifts by a cent");
    expect(ledger.requirements).toEqual([{ id: "AC1", text: "allocation splits sum exactly", source: { artifact: "spec.json" } }]);
    expect(ledger.rev).toBeGreaterThan(0);

    writeDecision(dir, 1, "spec", "approve");
    // The session already consumed DISCOVERY's one turn against `driver`;
    // approving the spec gate runs a fresh PLAN turn, so a new driver
    // instance (its own turn-index cursor) is scripted for just that turn.
    const planDriver = createDriver("fake", { script: { turns: [{ finalText: PLAN_TEXT, usage: { input: 1, cachedRead: 0, cacheCreation: 0, output: 1, reasoningOutput: 0 } }] } });
    const result = await advanceOnce(dir, planDriver, root);
    expect(result.state.state).toBe("PLAN_READY");

    const ledgerAfterApprove = readLedger(dir);
    expect(ledgerAfterApprove.decisions).toContainEqual(
      expect.objectContaining({ gate: "spec", decision: "approve", id: "d-1" }),
    );
    expect(ledgerAfterApprove.risks).toEqual([{ flag: "db-migration", status: "open" }]);
  });
});

describe("DW-5: blocking question round-trip via the existing gate flow", () => {
  it("raises a ledger question with an id, then marks it answered when the owner answers the gate", async () => {
    const root = setupRepo();
    const { dir } = makePacketAndState(root);
    const questionSpec = JSON.stringify({
      problem: "p", currentBehavior: "c", proposedBehavior: "pb", acceptanceCriteria: [],
      affectedPaths: [], riskFlags: [], openQuestions: [{ text: "Should this cover LBP too?" }],
    });
    const driver = createDriver("fake", { script: { turns: [{ finalText: questionSpec, usage: { input: 1, cachedRead: 0, cacheCreation: 0, output: 1, reasoningOutput: 0 } }] } });

    await advanceOnce(dir, driver, root); // SELECTED -> DISCOVERY
    const raised = await advanceOnce(dir, driver, root); // DISCOVERY turn -> NEEDS_DECISION
    expect(raised.state.state).toBe("NEEDS_DECISION");
    const questionId = (raised.state.awaiting.questions[0] as { id: string }).id;
    expect(questionId).toMatch(/^q-0001-0$/);

    const ledgerBefore = readLedger(dir);
    expect(ledgerBefore.questions[0]).toMatchObject({ id: questionId, status: "open", kind: "blocking" });

    writeDecision(dir, 1, "question", "answer", { answer: "Yes, include LBP." });
    await advanceOnce(dir, driver, root);

    const ledgerAfter = readLedger(dir);
    expect(ledgerAfter.questions[0]).toMatchObject({ status: "answered" });
    expect(ledgerAfter.questions[0].answer.text).toBe("Yes, include LBP.");
  });
});

describe("DW-5: advisory Q&A via controls (ask / answer)", () => {
  it("ask raises an advisory ledger question; answer resolves it by id", async () => {
    const root = setupRepo();
    const { dir } = makePacketAndState(root);
    const driver = createDriver("fake", { script: { turns: [] } });

    writeControl(dir, 1, "ask", { text: "Why not use the existing helper?" });
    const askTick = await advanceOnce(dir, driver, root);
    expect(askTick.didWork).toBe(true);

    const ledger = readLedger(dir);
    expect(ledger.questions).toHaveLength(1);
    expect(ledger.questions[0]).toMatchObject({ source: "owner", kind: "advisory", status: "open", text: "Why not use the existing helper?" });
    const questionId = ledger.questions[0].id as string;

    writeControl(dir, 2, "answer", { questionId, text: "Because it doesn't handle this edge case." });
    await advanceOnce(dir, driver, root);

    const ledgerAfter = readLedger(dir);
    expect(ledgerAfter.questions[0].status).toBe("answered");
    expect(ledgerAfter.questions[0].answer.text).toBe("Because it doesn't handle this edge case.");
  });

  it("answering an unknown questionId is rejected without crashing the runner", async () => {
    const root = setupRepo();
    const { dir } = makePacketAndState(root);
    const driver = createDriver("fake", { script: { turns: [] } });
    writeControl(dir, 1, "answer", { questionId: "does-not-exist", text: "x" });
    const result = await advanceOnce(dir, driver, root);
    expect(result.didWork).toBe(true); // control still consumed, cursor advances
    expect(existsSync(join(dir, "memory", "ledger.json"))).toBe(false); // nothing written — the answer never matched
  });
});

describe("DW-5: same-provider set-config also records configHistory", () => {
  it("appends a configHistory entry to the ledger", async () => {
    const root = setupRepo();
    const { dir } = makePacketAndState(root);
    const driver = createDriver("fake", { script: { turns: [] } });
    writeControl(dir, 1, "set-config", { model: "claude-fable-5" });
    await advanceOnce(dir, driver, root);
    const ledger = readLedger(dir);
    expect(ledger.configHistory).toHaveLength(1);
    expect(ledger.configHistory[0].to.model).toBe("claude-fable-5");
  });
});

describe("DW-5: history versioning", () => {
  it("copies the prior ledger revision to memory/history/ before overwriting", async () => {
    const root = setupRepo();
    const { dir } = makePacketAndState(root);
    const driver = createDriver("fake", { script: { turns: [] } });
    writeControl(dir, 1, "ask", { text: "first?" });
    await advanceOnce(dir, driver, root);
    writeControl(dir, 2, "ask", { text: "second?" });
    await advanceOnce(dir, driver, root);

    expect(existsSync(join(dir, "memory", "history", "ledger-0001.json"))).toBe(true);
    const historical = JSON.parse(readFileSync(join(dir, "memory", "history", "ledger-0001.json"), "utf8"));
    expect(historical.questions).toHaveLength(1); // the version before the second question was added
    const current = readLedger(dir);
    expect(current.questions).toHaveLength(2);
  });
});
