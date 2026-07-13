import { existsSync, mkdirSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { afterEach, describe, expect, it } from "vitest";

import { createDriver } from "../../scripts/delivery/drivers/driver.mjs";
// Importing fake.mjs self-registers "fake" into the shared driver registry.
import "../../scripts/delivery/drivers/fake.mjs";
import { atomicWriteJsonSync } from "../../scripts/delivery/fsx.mjs";
import { buildItemIdentity, buildPacket, makeSessionId } from "../../scripts/delivery/packet.mjs";

// buildPacket has no JSDoc @param types, so TS infers the object-array fields
// (capabilities/skills/acceptanceCriteria) as `never[]` from their empty
// defaults — same workaround tests/delivery/packet.test.ts already uses.
type BuildPacketArgs = Parameters<typeof buildPacket>[0];
function asPacketArgs(partial: object): BuildPacketArgs {
  return partial as unknown as BuildPacketArgs;
}
import {
  advanceSession,
  checkGitGuard,
  isRunnerAlive,
  runValidationCommands,
  writeHeartbeat,
} from "../../scripts/delivery/run-session.mjs";

// ---- fixtures ----

const cleanupDirs: string[] = [];
afterEach(() => {
  while (cleanupDirs.length) {
    const dir = cleanupDirs.pop();
    if (dir) rmSync(dir, { recursive: true, force: true });
  }
});

function setupRepo(): string {
  const root = mkdtempSync(join(tmpdir(), "delivery-runner-"));
  cleanupDirs.push(root);
  writeFileSync(join(root, "README.md"), "test repo\n");
  return root;
}

const STABLE_SNAPSHOT = Object.freeze({
  status: "",
  head: "fixture-head",
  refs: "fixture-refs",
  indexDiff: "",
  trackedDiff: "",
  fingerprints: {},
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
      item,
      context: { campaignFiles: [], relatedNotes: [] },
      scopeHints: { keywords: ["rounding"], globs: [], modules: ["Budget"] },
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
    schemaVersion: 1,
    sessionId,
    state: "SELECTED",
    awaiting: null,
    phaseHistory: [{ state: "SELECTED", enteredAt: now, exitedAt: null }],
    agent: "claude",
    driver: { ref: null, specialists: {} },
    workspace: packet.workspace,
    build: null,
    fixLoop: 0,
    usage: { perPhase: {}, total: { input: 0, cachedInput: 0, output: 0, costUsd: null } },
    decisionsProcessed: 0,
    messagesProcessed: 0,
    lastError: null,
    createdAt: now,
    updatedAt: now,
  };
  atomicWriteJsonSync(join(dir, "state.json"), state);
  return { dir, packet };
}

function writeDecision(dir: string, seq: number, gate: string, decision: string, extra: Record<string, unknown> = {}) {
  const decisionsDir = join(dir, "decisions");
  mkdirSync(decisionsDir, { recursive: true });
  const rec = {
    seq,
    gate,
    decision,
    note: null,
    confirmText: null,
    tickCheckbox: true,
    answer: null,
    capabilitiesDrop: null,
    at: new Date().toISOString(),
    ...extra,
  };
  atomicWriteJsonSync(join(decisionsDir, `${String(seq).padStart(4, "0")}-${gate}.json`), rec);
}
function writeMessage(dir: string, seq: number, text: string) {
  const messagesDir = join(dir, "messages");
  mkdirSync(messagesDir, { recursive: true });
  atomicWriteJsonSync(join(messagesDir, `${String(seq).padStart(4, "0")}.json`), {
    seq,
    text,
    at: new Date().toISOString(),
  });
}

function readEvents(dir: string): Array<Record<string, unknown>> {
  const text = readFileSync(join(dir, "events.ndjson"), "utf8");
  return text
    .trim()
    .split("\n")
    .filter(Boolean)
    .map((line) => JSON.parse(line));
}

async function drive(
  dir: string,
  driver: object,
  repoRoot: string,
  opts: { runValidation?: (...args: unknown[]) => unknown; takeSnapshot?: () => Record<string, unknown> } = {},
) {
  let last;
  for (let i = 0; i < 50; i++) {
    const { didWork, state } = await advanceSession({
      sessionDir: dir,
      driver,
      repoRoot,
      runValidation: opts.runValidation,
      retryDelayMs: 0,
      sleep: () => {},
      takeSnapshot: opts.takeSnapshot || stableSnapshot,
      readHead: () => "fixture-shipped-head",
    });
    last = state;
    if (!didWork) return last;
  }
  throw new Error("drive() exceeded iteration budget — likely an infinite loop");
}

function passingValidation() {
  return {
    ok: true,
    results: {
      typecheck: { ok: true, ms: 1, excerpt: "" },
      lint: { ok: true, ms: 1, excerpt: "" },
      test: { ok: true, ms: 1, excerpt: "" },
    },
  };
}
function failingValidation() {
  return { ok: false, results: { typecheck: { ok: false, ms: 1, excerpt: "type error" } } };
}

const SPEC_TEXT = JSON.stringify({
  problem: "p",
  currentBehavior: "c",
  proposedBehavior: "pb",
  acceptanceCriteria: [{ id: "AC1", text: "works" }],
  affectedPaths: [],
  riskFlags: [],
  openQuestions: [],
});
const PLAN_TEXT = JSON.stringify({
  steps: [{ id: "S1", description: "do it", paths: [], validationHint: "pnpm test" }],
  testPlan: "t",
  riskFlags: [],
  rollbackSketch: "r",
  noNewDeps: true,
});
const PASS_REVIEW_TEXT = JSON.stringify({ verdict: "PASS", findings: [] });
const UAT_TEXT = JSON.stringify({
  summary: "done",
  acceptanceCriteria: [{ id: "AC1", status: "met", evidence: "tests" }],
  manualSteps: [{ action: "a", expected: "e" }],
  deviations: [],
  followUps: [],
});

function happyPathScript() {
  return {
    turns: [
      { finalText: SPEC_TEXT, usage: { input: 10, cachedInput: 0, output: 5, costUsd: null } },
      { finalText: PLAN_TEXT, usage: { input: 10, cachedInput: 0, output: 5, costUsd: null } },
      { finalText: "did the change", usage: { input: 5, cachedInput: 0, output: 5, costUsd: null } },
      { finalText: PASS_REVIEW_TEXT, usage: { input: 5, cachedInput: 0, output: 3, costUsd: null } },
      { finalText: UAT_TEXT, usage: { input: 5, cachedInput: 0, output: 3, costUsd: null } },
    ],
  };
}

// ============================================================
describe("advanceSession: happy path SELECTED -> SHIPPED", () => {
  it("drives a fake session through every gate to SHIPPED, writing every documented artifact", async () => {
    const root = setupRepo();
    const { dir } = makePacketAndState(root);
    const driver = createDriver("fake", { script: happyPathScript() });

    let state = await drive(dir, driver, root, { runValidation: passingValidation });
    expect(state.state).toBe("SPEC_READY");
    expect(state.awaiting).toEqual({ gate: "spec" });
    expect(existsSync(join(dir, "artifacts", "spec.md"))).toBe(true);
    expect(existsSync(join(dir, "artifacts", "spec.json"))).toBe(true);

    writeDecision(dir, 1, "spec", "approve");
    state = await drive(dir, driver, root, { runValidation: passingValidation });
    expect(state.state).toBe("PLAN_READY");
    expect(state.awaiting).toEqual({ gate: "plan" });
    expect(existsSync(join(dir, "artifacts", "plan.md"))).toBe(true);
    // packet.json enrichment happens exactly at spec approval (doc 3 §1)
    const enrichedPacket = JSON.parse(readFileSync(join(dir, "packet.json"), "utf8"));
    expect(enrichedPacket.acceptanceCriteria).toEqual([{ id: "AC1", text: "works" }]);

    writeDecision(dir, 2, "plan", "approve");
    state = await drive(dir, driver, root, { runValidation: passingValidation });
    expect(state.state).toBe("UAT_READY");
    expect(state.awaiting).toEqual({ gate: "uat" });
    expect(existsSync(join(dir, "artifacts", "build-log.md"))).toBe(true);
    expect(existsSync(join(dir, "artifacts", "validation.json"))).toBe(true);
    expect(existsSync(join(dir, "artifacts", "review-self.md"))).toBe(true);
    expect(existsSync(join(dir, "artifacts", "uat", "summary.md"))).toBe(true);
    expect(existsSync(join(dir, "artifacts", "uat", "manual-test-script.md"))).toBe(true);
    expect(existsSync(join(dir, "artifacts", "uat", "rollback.md"))).toBe(true);

    writeDecision(dir, 3, "uat", "accept");
    state = await drive(dir, driver, root, { runValidation: passingValidation });
    expect(state.state).toBe("ACCEPTED");
    expect(state.awaiting).toEqual({ gate: "shipped" });
    expect(state.writebackRequested.tickCheckbox).toBe(true);

    writeDecision(dir, 4, "shipped", "shipped");
    state = await drive(dir, driver, root, { runValidation: passingValidation });
    expect(state.state).toBe("SHIPPED");
    expect(state.shippedHead).toBeTruthy();
    expect(state.usage.total.input).toBeGreaterThan(0);

    const events = readEvents(dir);
    const types = events.map((e) => e.type);
    expect(types).toContain("phase.transition");
    expect(types).toContain("decision.consumed");
    expect(types).toContain("validation.result");
    // seq is strictly monotonic
    const seqs = events.map((e) => e.seq as number);
    for (let i = 1; i < seqs.length; i++) expect(seqs[i]).toBe(seqs[i - 1] + 1);
  });
});

describe("advanceSession: validation-fail loop exhaustion -> BLOCKED", () => {
  it("loops through BUILDING exactly maxFixLoops times before blocking", async () => {
    const root = setupRepo();
    const { dir } = makePacketAndState(root);
    const driver = createDriver("fake", {
      script: {
        turns: [
          { finalText: SPEC_TEXT },
          { finalText: PLAN_TEXT },
          { finalText: "build attempt 1" },
          { finalText: "fix attempt 1" },
          { finalText: "fix attempt 2" },
          { finalText: "fix attempt 3" },
        ],
      },
    });

    let state = await drive(dir, driver, root, { runValidation: failingValidation });
    expect(state.state).toBe("SPEC_READY");
    writeDecision(dir, 1, "spec", "approve");
    state = await drive(dir, driver, root, { runValidation: failingValidation });
    expect(state.state).toBe("PLAN_READY");
    writeDecision(dir, 2, "plan", "approve");
    state = await drive(dir, driver, root, { runValidation: failingValidation });

    expect(state.state).toBe("BLOCKED");
    expect(state.awaiting).toEqual({ gate: "blocked", returnTo: "BUILDING" });
    expect(state.fixLoop).toBe(3);
    expect(state.lastError.phase).toBe("VALIDATING");

    const validationJson = JSON.parse(readFileSync(join(dir, "artifacts", "validation.json"), "utf8"));
    expect(validationJson.ok).toBe(false);
  });

  it("Retry re-arms the counter: one more BUILDING turn, then a passing validation carries the session all the way to UAT_READY", async () => {
    const root = setupRepo();
    const { dir } = makePacketAndState(root);
    const driver = createDriver("fake", {
      script: {
        turns: [
          { finalText: SPEC_TEXT },
          { finalText: PLAN_TEXT },
          { finalText: "build attempt 1" },
          { finalText: "fix attempt 1" },
          { finalText: "fix attempt 2" },
          { finalText: "fix attempt 3" },
          { finalText: "retried build" },
          { finalText: PASS_REVIEW_TEXT },
          { finalText: UAT_TEXT },
        ],
      },
    });
    let state = await drive(dir, driver, root, { runValidation: failingValidation });
    writeDecision(dir, 1, "spec", "approve");
    state = await drive(dir, driver, root, { runValidation: failingValidation });
    writeDecision(dir, 2, "plan", "approve");
    state = await drive(dir, driver, root, { runValidation: failingValidation });
    expect(state.state).toBe("BLOCKED");
    expect(state.fixLoop).toBe(3);

    writeDecision(dir, 3, "blocked", "retry");
    state = await drive(dir, driver, root, { runValidation: passingValidation });
    expect(state.state).toBe("UAT_READY");
    // the counter was re-armed, not left exhausted from the prior attempt
    expect(state.fixLoop).toBe(0);
  });
});

describe("advanceSession: resume after a simulated runner crash", () => {
  it("continues correctly when a fresh driver instance resumes the persisted ref", async () => {
    const root = setupRepo();
    const { dir } = makePacketAndState(root);

    const driver1 = createDriver("fake", { script: { turns: [{ finalText: SPEC_TEXT }] } });
    let state = await drive(dir, driver1, root, { runValidation: passingValidation });
    expect(state.state).toBe("SPEC_READY");
    expect(state.driver.ref).toBeTruthy();
    const refBeforeCrash = state.driver.ref;

    // Simulate a killed runner process: driver1 is simply discarded. A fresh
    // `node run-session.mjs --resume` invocation would construct a brand-new
    // driver instance and call resume(ref) against the same persisted ref.
    writeDecision(dir, 1, "spec", "approve");
    const driver2 = createDriver("fake", {
      script: {
        turns: [{ finalText: PLAN_TEXT }, { finalText: "built it" }, { finalText: PASS_REVIEW_TEXT }, { finalText: UAT_TEXT }],
      },
    });
    state = await drive(dir, driver2, root, { runValidation: passingValidation });
    expect(state.state).toBe("PLAN_READY");

    writeDecision(dir, 2, "plan", "approve");
    state = await drive(dir, driver2, root, { runValidation: passingValidation });

    expect(state.state).toBe("UAT_READY");
    expect(state.driver.ref).toEqual(refBeforeCrash);
  });
});

describe("advanceSession: S3 driver setup and structured-output failures", () => {
  it("persists a new provider ref before the first real turn begins", async () => {
    const root = setupRepo();
    const { dir } = makePacketAndState(root);
    const driver = {
      kind: "persistence-probe",
      startSession: (opts: { cwd: string; mode: string }) => ({
        ref: { id: "persist-before-turn", cwd: opts.cwd, mode: opts.mode },
        cwd: opts.cwd,
        mode: opts.mode,
      }),
      resume: () => {
        throw new Error("resume should not be called");
      },
      runTurn: () => {
        const stateOnDisk = JSON.parse(readFileSync(join(dir, "state.json"), "utf8"));
        expect(stateOnDisk.driver.ref.id).toBe("persist-before-turn");
        return { finalText: SPEC_TEXT, usage: { input: 2, cachedInput: 1, output: 1, costUsd: null } };
      },
    };

    const state = await drive(dir, driver, root);
    expect(state.state).toBe("SPEC_READY");
    expect(state.driver.ref.id).toBe("persist-before-turn");
  });

  it("turns a provider preflight failure into a durable BLOCKED session", async () => {
    const root = setupRepo();
    const { dir } = makePacketAndState(root);
    const driver = {
      kind: "preflight-failure",
      startSession: () => {
        throw new Error("authentication preflight failed");
      },
      resume: () => {
        throw new Error("resume should not be called");
      },
      runTurn: () => {
        throw new Error("runTurn should not be called");
      },
    };

    const state = await drive(dir, driver, root);
    expect(state.state).toBe("BLOCKED");
    expect(state.lastError.message).toMatch(/authentication preflight failed/);
    expect(JSON.parse(readFileSync(join(dir, "state.json"), "utf8")).state).toBe("BLOCKED");
  });

  it("blocks malformed structured discovery output while retaining its usage", async () => {
    const root = setupRepo();
    const { dir } = makePacketAndState(root);
    const driver = createDriver("fake", {
      script: { turns: [{ finalText: "{}", usage: { input: 7, cachedInput: 2, output: 3, costUsd: null } }] },
    });

    const state = await drive(dir, driver, root);
    expect(state.state).toBe("BLOCKED");
    expect(state.lastError.message).toMatch(/DISCOVERY output field/);
    expect(state.usage.perPhase.discovery).toMatchObject({ input: 7, cachedInput: 2, output: 3 });
  });
});

describe("advanceSession: stale decision handling", () => {
  it("skips a decision whose gate no longer matches the current await, advancing past it", async () => {
    const root = setupRepo();
    const { dir } = makePacketAndState(root);
    const driver = createDriver("fake", { script: happyPathScript() });

    let state = await drive(dir, driver, root, { runValidation: passingValidation });
    expect(state.state).toBe("SPEC_READY");

    // Stale: a "plan" decision arrives while the session is still awaiting "spec".
    writeDecision(dir, 1, "plan", "approve");
    state = await drive(dir, driver, root, { runValidation: passingValidation });
    expect(state.state).toBe("SPEC_READY");
    expect(state.decisionsProcessed).toBe(1);
    expect(readEvents(dir).some((e) => e.type === "decision.stale")).toBe(true);

    // The real approval, with the correct gate, proceeds normally afterward.
    writeDecision(dir, 2, "spec", "approve");
    state = await drive(dir, driver, root, { runValidation: passingValidation });
    expect(state.state).toBe("PLAN_READY");
  });
});

describe("advanceSession: owner messages drained at boundaries, not mid-turn", () => {
  it("consumes a pending message only when composing the next turn", async () => {
    const root = setupRepo();
    const { dir } = makePacketAndState(root);
    const driver = createDriver("fake", { script: happyPathScript() });

    let state = await drive(dir, driver, root, { runValidation: passingValidation });
    expect(state.state).toBe("SPEC_READY");
    expect(state.messagesProcessed).toBe(0);

    writeMessage(dir, 1, "please double-check the rounding edge case");
    writeDecision(dir, 1, "spec", "approve");
    state = await drive(dir, driver, root, { runValidation: passingValidation });
    expect(state.state).toBe("PLAN_READY");
    expect(state.messagesProcessed).toBe(1);

    const consumed = readEvents(dir).find((e) => e.type === "owner.message.consumed");
    expect(consumed).toBeTruthy();
    expect((consumed as { data: { text: string } }).data.text).toContain("rounding edge case");
  });
});

describe("advanceSession: git guard BLOCKS on a simulated HEAD change", () => {
  it("detects a simulated commit result and transitions to BLOCKED without running a Git write", async () => {
    const root = setupRepo();
    const { dir } = makePacketAndState(root);

    const violatingDriver = {
      kind: "violator",
      startSession: (opts: { cwd: string; mode: string }) => ({ ref: { id: "v1" }, cwd: opts.cwd, mode: opts.mode }),
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      resume: (ref: any) => ({ ref, cwd: root, mode: "readonly" }),
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      runTurn: (_handle: any, _prompt: string) => ({
        finalText: SPEC_TEXT,
        usage: { input: 1, cachedInput: 0, output: 1, costUsd: null },
      }),
    };

    let snapshotCount = 0;
    const takeSnapshot = () => {
      snapshotCount += 1;
      return snapshotCount === 1 ? stableSnapshot() : { ...stableSnapshot(), head: "simulated-new-head" };
    };

    const state = await drive(dir, violatingDriver, root, { runValidation: passingValidation, takeSnapshot });
    expect(state.state).toBe("BLOCKED");
    expect(state.lastError.gitViolation).toBe(true);
    expect(state.lastError.violations).toContain("HEAD changed");

    expect(snapshotCount).toBeGreaterThanOrEqual(2);

    const violation = readEvents(dir).find((e) => e.type === "git.guard.violation");
    expect(violation).toBeTruthy();
  });

  it("treats analysis-tree drift as a read-only violation", () => {
    const before = stableSnapshot();
    const after = {
      ...stableSnapshot(),
      status: " M README.md\n",
      trackedDiff: "simulated diff",
      fingerprints: { "README.md": "simulated-new-content" },
    };
    const result = checkGitGuard(before, "/repo", "readonly", { takeSnapshot: () => after });
    expect(result.ok).toBe(false);
    expect(result.violations).toContain("working tree changed during a read-only phase");
  });

  it("detects a simulated forbidden-path build delta", () => {
    const before = stableSnapshot();
    const after = {
      ...stableSnapshot(),
      status: " M src/components/ui/button.tsx\n",
      fingerprints: { "src/components/ui/button.tsx": "simulated-new-content" },
    };
    const result = checkGitGuard(before, "/repo", "build", {
      takeSnapshot: () => after,
      forbiddenPaths: ["src/components/ui/**"],
    });
    expect(result.ok).toBe(false);
    expect(result.violations).toContain("forbidden paths changed: src/components/ui/button.tsx");
  });
});

describe("advanceSession: NEEDS_DECISION question flow", () => {
  it("raises a question when DISCOVERY reports openQuestions, and resumes DISCOVERY with the answer injected as guidance", async () => {
    const root = setupRepo();
    const { dir } = makePacketAndState(root);
    const questionSpec = JSON.stringify({
      problem: "p",
      currentBehavior: "c",
      proposedBehavior: "pb",
      acceptanceCriteria: [],
      affectedPaths: [],
      riskFlags: [],
      openQuestions: [{ text: "Should this also cover the LBP conversion path?" }],
    });
    const driver = createDriver("fake", {
      script: { turns: [{ finalText: questionSpec }, { finalText: SPEC_TEXT }] },
    });

    let state = await drive(dir, driver, root, { runValidation: passingValidation });
    expect(state.state).toBe("NEEDS_DECISION");
    expect(state.awaiting.gate).toBe("question");
    expect(state.awaiting.returnTo).toBe("DISCOVERY");

    writeDecision(dir, 1, "question", "answer", { answer: "Yes, include LBP." });
    state = await drive(dir, driver, root, { runValidation: passingValidation });
    expect(state.state).toBe("SPEC_READY");
  });
});

describe("advanceSession: cancel is legal from any non-terminal state, not just gates", () => {
  it("cancels a session that is mid-BUILDING (no awaiting gate)", async () => {
    const root = setupRepo();
    const { dir } = makePacketAndState(root);
    const driver = createDriver("fake", { script: happyPathScript() });
    let state = await drive(dir, driver, root, { runValidation: passingValidation });
    writeDecision(dir, 1, "spec", "approve");
    state = await drive(dir, driver, root, { runValidation: passingValidation });
    writeDecision(dir, 2, "plan", "approve");
    // Cancel immediately after PLAN_READY approval lands the session in
    // BUILDING with awaiting:null — cancel must still apply.
    writeDecision(dir, 3, "cancel", "cancel");
    state = await drive(dir, driver, root, { runValidation: passingValidation });
    expect(state.state).toBe("CANCELLED");
  });
});

describe("writeHeartbeat + isRunnerAlive", () => {
  it("reports alive for a fresh heartbeat with a live pid probe", () => {
    const root = mkdtempSync(join(tmpdir(), "delivery-heartbeat-"));
    cleanupDirs.push(root);
    const dir = join(root, "sessions", "s1");
    mkdirSync(dir, { recursive: true });
    writeHeartbeat(dir, { pid: process.pid });
    expect(isRunnerAlive(dir, { pidAlive: () => true }).alive).toBe(true);
  });

  it("reports stale once the heartbeat age exceeds staleMs", () => {
    const root = mkdtempSync(join(tmpdir(), "delivery-heartbeat-"));
    cleanupDirs.push(root);
    const dir = join(root, "sessions", "s1");
    mkdirSync(dir, { recursive: true });
    writeHeartbeat(dir, { pid: process.pid });
    expect(isRunnerAlive(dir, { staleMs: -1, pidAlive: () => true }).alive).toBe(false);
  });

  it("reports dead when the pid probe fails, even with a fresh heartbeat", () => {
    const root = mkdtempSync(join(tmpdir(), "delivery-heartbeat-"));
    cleanupDirs.push(root);
    const dir = join(root, "sessions", "s1");
    mkdirSync(dir, { recursive: true });
    writeHeartbeat(dir, { pid: 123456 });
    expect(isRunnerAlive(dir, { pidAlive: () => false }).alive).toBe(false);
  });

  it("returns not-alive when runner.json doesn't exist", () => {
    const root = mkdtempSync(join(tmpdir(), "delivery-heartbeat-"));
    cleanupDirs.push(root);
    expect(isRunnerAlive(join(root, "sessions", "nope")).alive).toBe(false);
  });
});

describe("runValidationCommands", () => {
  it("stops at the first failing command and captures its excerpt; later commands don't run", () => {
    const calls: string[] = [];
    const spawn = (_cmd: string, args: string[]) => {
      calls.push(args[0]);
      if (args[0] === "typecheck") return { status: 0, stdout: "ok\n", stderr: "" };
      if (args[0] === "lint") return { status: 1, stdout: "", stderr: "lint error\n" };
      return { status: 0, stdout: "", stderr: "" };
    };
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const result = runValidationCommands({ cwd: "/repo", spawn: spawn as any });
    expect(result.ok).toBe(false);
    expect(calls).toEqual(["typecheck", "lint"]);
    expect(result.results.lint.ok).toBe(false);
    expect(result.results.lint.excerpt).toContain("lint error");
    expect(result.results.test).toBeUndefined();
  });

  it("passes when every command exits 0", () => {
    const spawn = () => ({ status: 0, stdout: "", stderr: "" });
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const result = runValidationCommands({ cwd: "/repo", spawn: spawn as any });
    expect(result.ok).toBe(true);
    expect(result.results.typecheck.ok).toBe(true);
    expect(result.results.lint.ok).toBe(true);
    expect(result.results.test.ok).toBe(true);
  });

  it("truncates output to the last 200 lines", () => {
    const bigOutput = Array.from({ length: 500 }, (_, i) => `line ${i}`).join("\n");
    const spawn = () => ({ status: 1, stdout: bigOutput, stderr: "" });
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const result = runValidationCommands({ cwd: "/repo", spawn: spawn as any });
    const lineCount = result.results.typecheck.excerpt.split("\n").length;
    expect(lineCount).toBeLessThanOrEqual(200);
    expect(result.results.typecheck.excerpt).toContain("line 499");
    expect(result.results.typecheck.excerpt).not.toContain("line 0\n");
  });
});
