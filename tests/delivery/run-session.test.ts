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
  runLoop,
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

function makePacketAndState(root: string, budget: Record<string, unknown> | null = null, lanePolicy: Record<string, unknown> | null = null) {
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
      budget,
      lanePolicy,
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
    ...(budget ? { budget: { current: budget, warned: [], exhaustedAt: null } } : {}),
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
function writeControl(dir: string, seq: number, type: string, payload: Record<string, unknown>) {
  const controlsDir = join(dir, "controls");
  mkdirSync(controlsDir, { recursive: true });
  atomicWriteJsonSync(join(controlsDir, `${String(seq).padStart(4, "0")}-${type}.json`), {
    seq,
    type,
    payload,
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
    // DLV-10: the UAT gate now also carries the AC coverage summary. AC1's
    // claim cites `tests`, and this fixture's validation ran and passed the
    // test rung, so the runner confirms it as met rather than taking the
    // agent's word for it.
    expect(state.awaiting).toEqual({ gate: "uat", acceptance: { total: 1, met: 1, waived: 0, unmet: 0, failed: 0 } });
    expect(existsSync(join(dir, "artifacts", "acceptance.json"))).toBe(true);
    expect(readFileSync(join(dir, "artifacts", "acceptance.md"), "utf8")).toContain("| AC1 | MET |");
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

describe("advanceSession: D12/DLV-17 transcript integrity + raw SDK linkage", () => {
  it("reports a zero-gap transcript.gap.checked event and a rawTranscript pointer at SHIPPED", async () => {
    const root = setupRepo();
    const { dir } = makePacketAndState(root);
    const driver = createDriver("fake", { script: happyPathScript() });

    let state = await drive(dir, driver, root, { runValidation: passingValidation });
    writeDecision(dir, 1, "spec", "approve");
    state = await drive(dir, driver, root, { runValidation: passingValidation });
    writeDecision(dir, 2, "plan", "approve");
    state = await drive(dir, driver, root, { runValidation: passingValidation });
    writeDecision(dir, 3, "uat", "accept");
    state = await drive(dir, driver, root, { runValidation: passingValidation });
    writeDecision(dir, 4, "shipped", "shipped");
    state = await drive(dir, driver, root, { runValidation: passingValidation });
    expect(state.state).toBe("SHIPPED");

    const gapEvents = readEvents(dir).filter((e) => e.type === "transcript.gap.checked");
    expect(gapEvents.length).toBe(1);
    expect(gapEvents[0].data).toMatchObject({ gapCount: 0, missingTurnIds: [] });

    // packet.agent is "claude" in this fixture -- the pointer is always
    // attempted, and safely resolves exists:false against the *real*
    // homedir() for a fake test session id that was never really written
    // by Claude Code (no test seam threaded through advanceSession itself;
    // computeRawTranscriptPointer's own homeDir seam is unit-tested directly
    // in drivers-claude.test.ts).
    expect(state.driver.rawTranscript).toMatchObject({ exists: false, sizeBytes: null, sha256: null });
    expect(state.driver.rawTranscript.path).toContain(`${state.driver.ref.id}.jsonl`);
  });

  it("reports the missing turn ids when turns are silently dropped between phases (the whdv failure shape)", async () => {
    const root = setupRepo();
    const { dir } = makePacketAndState(root);
    const driver = createDriver("fake", { script: happyPathScript() });

    let state = await drive(dir, driver, root, { runValidation: passingValidation });
    expect(state.state).toBe("SPEC_READY");
    expect(state.turnCounter).toBe(1);

    // Simulate 2 turn ids allocated with nothing ever written for them --
    // the exact whdv shape (turnCounter reached 23, but 0013-0018/0021 had
    // no trace at all). The next real turn (PLAN) will compute turn 0004,
    // leaving 0002/0003 as a genuine, silent gap.
    const statePath = join(dir, "state.json");
    const onDisk = JSON.parse(readFileSync(statePath, "utf8"));
    atomicWriteJsonSync(statePath, { ...onDisk, turnCounter: 3 });

    writeDecision(dir, 1, "spec", "approve");
    state = await drive(dir, driver, root, { runValidation: passingValidation });
    writeDecision(dir, 2, "plan", "approve");
    state = await drive(dir, driver, root, { runValidation: passingValidation });
    writeDecision(dir, 3, "uat", "accept");
    state = await drive(dir, driver, root, { runValidation: passingValidation });
    writeDecision(dir, 4, "shipped", "shipped");
    state = await drive(dir, driver, root, { runValidation: passingValidation });
    expect(state.state).toBe("SHIPPED");

    const gapEvents = readEvents(dir).filter((e) => e.type === "transcript.gap.checked");
    expect(gapEvents.length).toBe(1);
    expect(gapEvents[0].data).toMatchObject({ gapCount: 2, missingTurnIds: ["0002", "0003"] });
  });

  it("does not attempt raw-transcript linkage for a codex-agent session", async () => {
    const root = setupRepo();
    const raw = ["# Now", "", "- [ ] **N1** Fix rounding drift _(blocker - M)_", ""].join("\n");
    const pmFile = "Budget/4 - Checklist.md";
    const idResult = buildItemIdentity(raw, 0, pmFile);
    if (!idResult.ok) throw new Error("fixture setup failed");
    const item = (idResult as { ok: true; item: Record<string, unknown> }).item;
    const sessionId = makeSessionId(new Date(2026, 0, 1), () => 0.42);
    const sessionDir = join(root, ".delivery", "sessions", sessionId);
    mkdirSync(sessionDir, { recursive: true });
    const packet = buildPacket(
      asPacketArgs({
        sessionId,
        agent: "codex",
        item,
        context: { campaignFiles: [], relatedNotes: [] },
        scopeHints: { keywords: [], globs: [], modules: [] },
        capabilities: [],
        skills: [],
        acceptanceCriteria: [],
        workspace: { baseHead: "HEAD", dirtyAtStart: false, baselineStatusHash: "x", changedFiles: [] },
        budget: null,
      }),
    );
    atomicWriteJsonSync(join(sessionDir, "packet.json"), packet);
    const now = new Date().toISOString();
    atomicWriteJsonSync(join(sessionDir, "state.json"), {
      schemaVersion: 1,
      sessionId,
      state: "SPEC_READY",
      awaiting: { gate: "spec" },
      phaseHistory: [{ state: "SELECTED", enteredAt: now, exitedAt: null }],
      agent: "codex",
      driver: { ref: { id: "codex-thread-1" }, specialists: {} },
      workspace: packet.workspace,
      build: null,
      fixLoop: 0,
      usage: { perPhase: {}, total: { input: 0, cachedInput: 0, output: 0, costUsd: null } },
      decisionsProcessed: 0,
      messagesProcessed: 0,
      turnCounter: 1,
    });

    writeDecision(sessionDir, 1, "cancel", "cancel");
    const { state: tickState } = await advanceSession({
      sessionDir,
      driver: createDriver("codex"),
      repoRoot: root,
      runValidation: passingValidation,
      retryDelayMs: 0,
      sleep: () => {},
      takeSnapshot: stableSnapshot,
      readHead: () => "fixture-shipped-head",
    });
    expect(tickState.state).toBe("CANCELLED");
    expect(tickState.driver.rawTranscript).toBeUndefined();
  });
});

function preExistingFailingValidation() {
  return {
    ok: false,
    results: {
      typecheck: {
        ok: false,
        ms: 1,
        excerpt: "tests/pm-ui/lint-rules.test.ts(10,33): error TS2353: bogus, unrelated to this session\n",
      },
    },
  };
}

describe("advanceSession: validation delta vs acknowledged baseline", () => {
  it("captures a baseline on a dirty-at-start workspace and passes validation when the same pre-existing error remains", async () => {
    const root = setupRepo();
    const { dir } = makePacketAndState(root);
    // Simulate the BUD-11 workspace: uncommitted changes unrelated to this
    // delivery were already present when the session started.
    const stateFile = join(dir, "state.json");
    const seededState = JSON.parse(readFileSync(stateFile, "utf8"));
    seededState.workspace.dirtyAtStart = true;
    atomicWriteJsonSync(stateFile, seededState);

    const driver = createDriver("fake", {
      script: { turns: [{ finalText: SPEC_TEXT }, { finalText: PLAN_TEXT }, { finalText: "build attempt 1" }] },
    });

    let state = await drive(dir, driver, root, { runValidation: preExistingFailingValidation });
    expect(state.state).toBe("SPEC_READY");
    expect(state.workspace.baselineValidation).toBeTruthy(); // captured once, during SELECTED
    expect(existsSync(join(dir, "artifacts", "validation-baseline.json"))).toBe(true);

    writeDecision(dir, 1, "spec", "approve");
    state = await drive(dir, driver, root, { runValidation: preExistingFailingValidation });
    expect(state.state).toBe("PLAN_READY");

    writeDecision(dir, 2, "plan", "approve");
    for (let i = 0; i < 20; i++) {
      const tick = await advanceSession({
        sessionDir: dir,
        driver,
        repoRoot: root,
        runValidation: preExistingFailingValidation,
        retryDelayMs: 0,
        sleep: () => {},
        takeSnapshot: stableSnapshot,
        readHead: () => "fixture-shipped-head",
      });
      state = tick.state;
      if (state.state === "REVIEWING" || !tick.didWork) break;
    }

    expect(state.state).toBe("REVIEWING");
    expect(state.awaiting).toBeNull();
    // Not one fix-loop attempt was spent — the very first validation
    // failure is accepted on delta without spending a fix-loop attempt.
    expect(state.fixLoop).toBe(0);
    expect(readEvents(dir).some((event) => event.type === "validation.delta.pass")).toBe(true);
  });

  it("still runs the normal fix loop when validation fails on a file the baseline did NOT already have failing", async () => {
    const root = setupRepo();
    const { dir } = makePacketAndState(root);
    const stateFile = join(dir, "state.json");
    const seededState = JSON.parse(readFileSync(stateFile, "utf8"));
    seededState.workspace.dirtyAtStart = true;
    atomicWriteJsonSync(stateFile, seededState);

    const driver = createDriver("fake", {
      script: {
        turns: [
          { finalText: SPEC_TEXT },
          { finalText: PLAN_TEXT },
          { finalText: "build attempt 1" },
          { finalText: "fix attempt 1" },
        ],
      },
    });

    let state = await drive(dir, driver, root, { runValidation: preExistingFailingValidation });
    writeDecision(dir, 1, "spec", "approve");
    state = await drive(dir, driver, root, { runValidation: preExistingFailingValidation });
    writeDecision(dir, 2, "plan", "approve");
    const planReadyState = JSON.parse(readFileSync(stateFile, "utf8"));
    planReadyState.workspace.changedFiles = ["src/lib/queryConfig.ts"];
    atomicWriteJsonSync(stateFile, planReadyState);

    // Baseline was captured with the pre-existing failure; a fresh, different
    // failure now shows up (a file this session's build step could plausibly
    // have broken) — this must go through the ordinary fix loop, not be
    // waved through as "pre-existing". Drive tick-by-tick (rather than the
    // auto-looping `drive()` helper, which would keep re-entering BUILDING
    // past the single scripted fix turn and exhaust the fake driver's
    // script) and stop as soon as the fix loop has armed once.
    const newFailure = () => ({
      ok: false,
      results: { typecheck: { ok: false, ms: 1, excerpt: "src/lib/queryConfig.ts(4,1): error TS1005: new failure\n" } },
    });
    for (let i = 0; i < 50; i++) {
      const tick = await advanceSession({
        sessionDir: dir,
        driver,
        repoRoot: root,
        runValidation: newFailure,
        retryDelayMs: 0,
        sleep: () => {},
        takeSnapshot: stableSnapshot,
        readHead: () => "fixture-shipped-head",
      });
      state = tick.state;
      if (state.state === "BUILDING" && state.fixLoop === 1) break;
      if (!tick.didWork) break;
    }

    expect(state.state).toBe("BUILDING"); // the fix loop re-entered BUILDING for a genuine, attributable failure
    expect(state.fixLoop).toBe(1);
  });
});

describe("advanceSession: change ownership", () => {
  it("records build-turn file deltas and marks writes to pre-dirty files as shared", async () => {
    const root = setupRepo();
    const { dir } = makePacketAndState(root);
    const stateFile = join(dir, "state.json");
    const seeded = JSON.parse(readFileSync(stateFile, "utf8"));
    seeded.state = "BUILDING";
    seeded.build = { mode: "fix", stepIndex: 0, totalSteps: 1 };
    seeded.workspace.preExistingChanges = [
      { path: "shared.ts", ownership: "not-session-owned" },
    ];
    atomicWriteJsonSync(stateFile, seeded);

    const before = {
      status: " M shared.ts\n",
      head: "fixture-head",
      refs: "fixture-refs",
      indexDiff: "",
      trackedDiff: "before",
      fingerprints: { "shared.ts": "before" },
    };
    const after = {
      status: " M shared.ts\n?? new.ts\n",
      head: "fixture-head",
      refs: "fixture-refs",
      indexDiff: "",
      trackedDiff: "after",
      fingerprints: { "shared.ts": "after", "new.ts": "created" },
    };
    let snapshots = 0;
    const driver = createDriver("fake", {
      script: { turns: [{ finalText: "updated shared.ts and created new.ts" }] },
    });
    const tick = await advanceSession({
      sessionDir: dir,
      driver,
      repoRoot: root,
      runValidation: passingValidation,
      retryDelayMs: 0,
      sleep: () => {},
      takeSnapshot: () => (snapshots++ === 0 ? before : after),
      readHead: () => "fixture-head",
    });

    expect(tick.state.state).toBe("VALIDATING");
    expect(tick.state.workspace.changedFiles).toEqual(["new.ts", "shared.ts"]);
    expect(tick.state.workspace.changeOwnership).toEqual([
      { path: "new.ts", ownership: "session-owned" },
      { path: "shared.ts", ownership: "shared" },
    ]);
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

describe("advanceSession: governed packet budget", () => {
  it("pauses gracefully between turns, writes a finish package, and never starts the next BUILDING turn", async () => {
    const root = setupRepo();
    const budget = {
      maxUsd: 2,
      maxTokens: 2_000_000,
      warnPct: 0.8,
      perPhase: {},
      authorization: "capped",
      authorizedAt: "2026-07-24T00:00:00.000Z",
    };
    const { dir } = makePacketAndState(root, budget);
    const driver = createDriver("fake", {
      script: { turns: [{ finalText: SPEC_TEXT }, { finalText: PLAN_TEXT }, { finalText: "should never run" }] },
    });

    let state = await drive(dir, driver, root, { runValidation: passingValidation });
    writeDecision(dir, 1, "spec", "approve");
    state = await drive(dir, driver, root, { runValidation: passingValidation });
    expect(state.state).toBe("PLAN_READY");
    writeDecision(dir, 2, "plan", "approve");
    const enteredBuilding = await advanceSession({
      sessionDir: dir,
      driver,
      repoRoot: root,
      runValidation: passingValidation,
      retryDelayMs: 0,
      sleep: () => {},
      takeSnapshot: stableSnapshot,
      readHead: () => "fixture-shipped-head",
    });
    expect(enteredBuilding.state.state).toBe("BUILDING");

    // Seed the session's accumulated usage as if it had already burned
    // through a huge amount of (mostly cached) tokens — the exact BUD-11
    // shape — before the BUILDING turn that would otherwise run next.
    const stateFile = join(dir, "state.json");
    const seeded = JSON.parse(readFileSync(stateFile, "utf8"));
    seeded.usage = {
      perPhase: seeded.usage.perPhase,
      total: { input: 1434, cachedInput: 2_991_876, output: 43_447, costUsd: 2.5 },
    };
    atomicWriteJsonSync(stateFile, seeded);

    let last;
    for (let i = 0; i < 10; i++) {
      const tick = await advanceSession({
        sessionDir: dir,
        driver,
        repoRoot: root,
        runValidation: passingValidation,
        retryDelayMs: 0,
        sleep: () => {},
        takeSnapshot: stableSnapshot,
        readHead: () => "fixture-shipped-head",
      });
      last = tick.state;
      if (!tick.didWork) break;
    }
    state = last;

    expect(state.state).toBe("BUILDING");
    expect(state.execution.paused).toBe(true);
    expect(state.awaiting).toEqual({ gate: "budget", returnTo: "BUILDING", reason: "budget-exhausted", priorAwaiting: null });
    expect(state.lastError).toBeNull();
    expect(existsSync(join(dir, "artifacts", "finish", "budget.json"))).toBe(true);
    expect(existsSync(join(dir, "artifacts", "finish", "summary.md"))).toBe(true);

    // The fake driver's script still has an unconsumed "should never run"
    // turn — proves the BUILDING turn was skipped outright, not merely
    // attempted and failed.
    expect(readEvents(dir).filter((e) => e.type === "budget.exhausted")).toHaveLength(1);
    expect(readEvents(dir).filter((e) => e.type === "notification.requested")).toHaveLength(1);
  });

  it("emits the warning exactly once after crossing warnPct and continues", async () => {
    const root = setupRepo();
    const budget = {
      maxUsd: null,
      maxTokens: 4_000_000,
      warnPct: 0.375,
      perPhase: {},
      authorization: "capped",
      authorizedAt: "2026-07-24T00:00:00.000Z",
    };
    const { dir } = makePacketAndState(root, budget);
    const driver = createDriver("fake", {
      script: { turns: [{ finalText: SPEC_TEXT }, { finalText: PLAN_TEXT }, { finalText: "did the change" }] },
    });

    let state = await drive(dir, driver, root, { runValidation: passingValidation });
    writeDecision(dir, 1, "spec", "approve");
    state = await drive(dir, driver, root, { runValidation: passingValidation });
    writeDecision(dir, 2, "plan", "approve");

    const stateFile = join(dir, "state.json");
    const seeded = JSON.parse(readFileSync(stateFile, "utf8"));
    seeded.usage = { perPhase: seeded.usage.perPhase, total: { input: 100, cachedInput: 1_600_000, output: 100, costUsd: null } };
    atomicWriteJsonSync(stateFile, seeded);

    // Stop as soon as the warning fires (don't let the fake driver's script
    // run out on later phases the seeded usage has nothing to do with).
    let last;
    for (let i = 0; i < 10; i++) {
      const tick = await advanceSession({
        sessionDir: dir,
        driver,
        repoRoot: root,
        runValidation: passingValidation,
        retryDelayMs: 0,
        sleep: () => {},
        takeSnapshot: stableSnapshot,
        readHead: () => "fixture-shipped-head",
      });
      last = tick.state;
      if (readEvents(dir).some((e) => e.type === "budget.warning")) {
        await advanceSession({
          sessionDir: dir,
          driver,
          repoRoot: root,
          runValidation: passingValidation,
          retryDelayMs: 0,
          sleep: () => {},
          takeSnapshot: stableSnapshot,
          readHead: () => "fixture-shipped-head",
        });
        break;
      }
      if (!tick.didWork) break;
    }
    state = last;

    expect(state.state).not.toBe("BLOCKED"); // warn never blocks
    expect(readEvents(dir).filter((e) => e.type === "budget.warning")).toHaveLength(1);
  });

  it("consumes an audited raise-only control and resumes from the same phase", async () => {
    const root = setupRepo();
    const budget = {
      maxUsd: null,
      maxTokens: 100,
      warnPct: 0.8,
      perPhase: {},
      authorization: "capped",
      authorizedAt: "2026-07-24T00:00:00.000Z",
    };
    const { dir } = makePacketAndState(root, budget);
    const stateFile = join(dir, "state.json");
    const seeded = JSON.parse(readFileSync(stateFile, "utf8"));
    seeded.usage.total = { input: 25, cachedInput: 75, output: 0, costUsd: null };
    atomicWriteJsonSync(stateFile, seeded);
    const driver = createDriver("fake", { script: { turns: [{ finalText: SPEC_TEXT }] } });

    let tick = await advanceSession({
      sessionDir: dir, driver, repoRoot: root, runValidation: passingValidation,
      retryDelayMs: 0, sleep: () => {}, takeSnapshot: stableSnapshot, readHead: () => "fixture-head",
    });
    expect(tick.state.awaiting?.reason).toBe("budget-exhausted");

    writeControl(dir, 1, "set-budget", { maxTokens: 200, reason: "owner approved one more discovery turn" });
    tick = await advanceSession({
      sessionDir: dir, driver, repoRoot: root, runValidation: passingValidation,
      retryDelayMs: 0, sleep: () => {}, takeSnapshot: stableSnapshot, readHead: () => "fixture-head",
    });
    expect(tick.state.state).toBe("SELECTED");
    expect(tick.state.execution.paused).toBe(false);
    expect(tick.state.awaiting).toBeNull();
    expect(tick.state.budget.current.maxTokens).toBe(200);
    expect(readEvents(dir).filter((e) => e.type === "budget.raised")).toHaveLength(1);
  });

  // DLV-29 regression: a budget-exhausted pause landing on the same tick as
  // entering a manual gate (here, PLAN_READY right after spec approval) used
  // to permanently overwrite that gate's `awaiting` with the budget pause's,
  // and the resume path only knew how to clear it to `null` — the session
  // became unresponsive to the plan decision forever, even after an
  // owner-authorized raise. See Delivery 10x/1 - Feature State.md Cluster B.
  it("restores the manual gate awaiting after a budget-exhausted pause collides with it", async () => {
    const root = setupRepo();
    const budget = {
      maxUsd: null,
      maxTokens: 4_000_000,
      warnPct: 0.8,
      perPhase: {},
      authorization: "capped",
      authorizedAt: "2026-07-24T00:00:00.000Z",
    };
    const { dir } = makePacketAndState(root, budget);
    const driver = createDriver("fake", {
      script: { turns: [{ finalText: SPEC_TEXT }, { finalText: PLAN_TEXT }, { finalText: "did the change" }] },
    });

    let state = await drive(dir, driver, root, { runValidation: passingValidation });
    writeDecision(dir, 1, "spec", "approve");
    state = await drive(dir, driver, root, { runValidation: passingValidation });
    expect(state.state).toBe("PLAN_READY");
    expect(state.awaiting).toEqual({ gate: "plan" });

    // Simulate the budget boundary tripping on the very next tick, exactly
    // as it did for real in s-20260725-151324-23aw — before the owner's
    // plan decision has been consumed.
    const stateFile = join(dir, "state.json");
    const seeded = JSON.parse(readFileSync(stateFile, "utf8"));
    seeded.usage = { perPhase: seeded.usage.perPhase, total: { input: 0, cachedInput: 5_000_000, output: 0, costUsd: null } };
    atomicWriteJsonSync(stateFile, seeded);

    let tick = await advanceSession({
      sessionDir: dir, driver, repoRoot: root, runValidation: passingValidation,
      retryDelayMs: 0, sleep: () => {}, takeSnapshot: stableSnapshot, readHead: () => "fixture-head",
    });
    expect(tick.state.state).toBe("PLAN_READY");
    expect(tick.state.awaiting).toEqual({ gate: "budget", returnTo: "PLAN_READY", reason: "budget-exhausted", priorAwaiting: { gate: "plan" } });

    writeControl(dir, 1, "set-budget", { maxTokens: 8_000_000, reason: "owner-authorized raise to finish the smoke test" });
    tick = await advanceSession({
      sessionDir: dir, driver, repoRoot: root, runValidation: passingValidation,
      retryDelayMs: 0, sleep: () => {}, takeSnapshot: stableSnapshot, readHead: () => "fixture-head",
    });
    expect(tick.state.state).toBe("PLAN_READY");
    // The bug: this used to be `null` here, permanently — no UI panel, and
    // POST /api/delivery/decision would 409 with "awaiting nothing" forever.
    expect(tick.state.awaiting).toEqual({ gate: "plan" });

    // Prove the session is actually unblocked, not just cosmetically fixed:
    // the plan decision the owner was always trying to submit now succeeds.
    writeDecision(dir, 2, "plan", "approve");
    const enteredBuilding = await advanceSession({
      sessionDir: dir, driver, repoRoot: root, runValidation: passingValidation,
      retryDelayMs: 0, sleep: () => {}, takeSnapshot: stableSnapshot, readHead: () => "fixture-head",
    });
    expect(enteredBuilding.state.state).toBe("BUILDING");
  });
});

describe("advanceSession: DISCOVERY phase turn-count limit (Slice C backstop)", () => {
  it("blocks with reason phase-turn-limit instead of looping DISCOVERY forever on repeated questions", async () => {
    const root = setupRepo();
    const { dir } = makePacketAndState(root);
    const questionSpecText = JSON.stringify({
      problem: "p",
      currentBehavior: "c",
      proposedBehavior: "pb",
      acceptanceCriteria: [],
      affectedPaths: [],
      riskFlags: [],
      openQuestions: [{ text: "still unsure" }],
    });
    const driver = createDriver("fake", {
      script: { turns: [{ finalText: questionSpecText }, { finalText: questionSpecText }] },
    });

    let last;
    for (let i = 0; i < 10; i++) {
      const tick = await advanceSession({
        sessionDir: dir,
        driver,
        repoRoot: root,
        runValidation: passingValidation,
        retryDelayMs: 0,
        sleep: () => {},
        takeSnapshot: stableSnapshot,
        readHead: () => "fixture-shipped-head",
        deliveryConfig: { budgets: { maxTurnsPerPhase: { discovery: 1 } } },
      });
      last = tick.state;
      if (last.state === "NEEDS_DECISION") {
        // Answer the question so DISCOVERY re-enters — the second entry
        // should hit the 1-turn cap instead of spending another turn.
        writeDecision(dir, tick.state.decisionsProcessed + 1, "question", "answer", { answer: "still unsure, try again" });
      }
      if (!tick.didWork && last.state !== "NEEDS_DECISION") break;
    }
    const state = last;

    expect(state.state).toBe("BLOCKED");
    expect(state.awaiting).toEqual({ gate: "blocked", returnTo: "DISCOVERY", reason: "phase-turn-limit" });
  });
});

describe("advanceSession: quota/rate-limit turn errors short-circuit to BLOCKED without retrying (BUD-11 root cause #6)", () => {
  it("never sleeps for a retry and blocks after exactly one attempt when the driver throws a session-limit error", async () => {
    const root = setupRepo();
    const { dir } = makePacketAndState(root);
    const driver = createDriver("fake", {
      script: {
        turns: [
          { finalText: SPEC_TEXT },
          { finalText: PLAN_TEXT },
          {
            throws:
              "claude driver: query failed — Claude Code returned an error result: You've hit your session limit · resets 12:30am (Asia/Beirut)",
          },
        ],
      },
    });

    let state = await drive(dir, driver, root, { runValidation: passingValidation });
    expect(state.state).toBe("SPEC_READY");
    writeDecision(dir, 1, "spec", "approve");
    state = await drive(dir, driver, root, { runValidation: passingValidation });
    expect(state.state).toBe("PLAN_READY");
    writeDecision(dir, 2, "plan", "approve");

    const sleepCalls: number[] = [];
    let last;
    for (let i = 0; i < 50; i++) {
      const tick = await advanceSession({
        sessionDir: dir,
        driver,
        repoRoot: root,
        retryDelayMs: 30000,
        sleep: (ms: number) => sleepCalls.push(ms),
        takeSnapshot: stableSnapshot,
        readHead: () => "fixture-shipped-head",
      });
      last = tick.state;
      if (!tick.didWork) break;
    }
    state = last;

    expect(sleepCalls).toEqual([]); // no 30s retry-delay sleep — a quota error is never retried
    expect(state.state).toBe("BLOCKED");
    expect(state.awaiting).toEqual({ gate: "blocked", returnTo: "BUILDING", reason: "quota-paused" });
    expect(state.lastError.errorKind).toBe("quota");
    expect(state.lastError.resetsAt).toBe("12:30am (Asia/Beirut)");

    const failedEvents = readEvents(dir).filter((e) => e.type === "agent.turn.failed");
    expect(failedEvents).toHaveLength(1); // exactly one attempt, not the usual two

    writeDecision(dir, 3, "blocked", "retry", { note: "Provider allowance has reset." });
    const resumed = await advanceSession({ sessionDir: dir, driver, repoRoot: root, retryDelayMs: 0, sleep: () => {}, takeSnapshot: stableSnapshot });
    expect(resumed.state.state).toBe("BUILDING");
    expect(resumed.state.driver.ref).toBeNull(); // resume requires a fresh provider preflight/session
  });

  it("escalates identical transient failures after the configured automatic retry limit", async () => {
    const root = setupRepo();
    const { dir } = makePacketAndState(root);
    const driver = createDriver("fake", {
      script: { turns: [{ finalText: SPEC_TEXT }, { finalText: PLAN_TEXT }, { throws: "network exploded" }, { throws: "network exploded" }, { throws: "network exploded" }] },
    });
    await drive(dir, driver, root, { runValidation: passingValidation });
    writeDecision(dir, 1, "spec", "approve");
    await drive(dir, driver, root, { runValidation: passingValidation });
    writeDecision(dir, 2, "plan", "approve");

    await advanceSession({
      sessionDir: dir, driver, repoRoot: root, retryDelayMs: 0, sleep: () => {}, takeSnapshot: stableSnapshot,
      deliveryConfig: { errors: { maxAutoRetries: 2 } },
    });
    const tick = await advanceSession({
      sessionDir: dir, driver, repoRoot: root, retryDelayMs: 0, sleep: () => {}, takeSnapshot: stableSnapshot,
      deliveryConfig: { errors: { maxAutoRetries: 2 } },
    });
    expect(tick.state.state).toBe("NEEDS_DECISION");
    expect(tick.state.awaiting).toMatchObject({ gate: "question", returnTo: "BUILDING", reason: "retry-exhausted" });
    expect(readEvents(dir).filter((event) => event.type === "retry.automatic")).toHaveLength(2);
    expect(readEvents(dir).filter((event) => event.type === "notification.requested")).toHaveLength(1);

    writeDecision(dir, 3, "question", "answer", { answer: "Investigate the provider outage before continuing." });
    const resumed = await advanceSession({ sessionDir: dir, driver, repoRoot: root, retryDelayMs: 0, sleep: () => {}, takeSnapshot: stableSnapshot });
    expect(resumed.state.state).toBe("BUILDING");
  });

  // DLV-44: hitting the lane's own maxInternalTurns ceiling is a sizing verdict,
  // not a transient fault. Retrying the same prompt into the same ceiling can
  // only fail identically, so the two automatic retries were pure waste — and in
  // the real session they also triggered the sessionId-collision crash loop.
  it("escalates a maxInternalTurns ceiling straight to the owner without retrying (DLV-44)", async () => {
    const root = setupRepo();
    const { dir } = makePacketAndState(root);
    const driver = createDriver("fake", {
      script: {
        turns: [
          { throws: "claude driver: query failed — Claude Code returned an error result: Reached maximum number of turns (8)" },
        ],
      },
    });

    // SELECTED -> DISCOVERY (validation baseline), then the doomed turn.
    await advanceSession({
      sessionDir: dir, driver, repoRoot: root, runValidation: passingValidation,
      retryDelayMs: 0, sleep: () => {}, takeSnapshot: stableSnapshot,
    });
    const tick = await advanceSession({
      sessionDir: dir, driver, repoRoot: root, runValidation: passingValidation,
      retryDelayMs: 0, sleep: () => {}, takeSnapshot: stableSnapshot,
      deliveryConfig: { errors: { maxAutoRetries: 2 } },
    });

    expect(tick.state.state).toBe("NEEDS_DECISION");
    expect(tick.state.awaiting).toMatchObject({ gate: "question", returnTo: "DISCOVERY", reason: "max-turns" });
    expect(tick.state.lastError.errorKind).toBe("max-turns");
    // The whole point: zero wasted retries, and the owner gets an actionable ask.
    expect(readEvents(dir).filter((e) => e.type === "retry.automatic")).toHaveLength(0);
    expect(readEvents(dir).filter((e) => e.type === "agent.turn.failed")).toHaveLength(1);
    expect(tick.state.awaiting.questions[0].text).toMatch(/maxInternalTurns/);
  });

  // DLV-43: the session that exposed this recorded $0.00 / 0 tokens for a
  // DISCOVERY phase whose raw SDK transcript showed 512,752 processed tokens
  // (~$0.34) — already past that lane's own 500,000-token cap. A hard cap that
  // cannot see spend from a phase that FAILS is not a cap.
  it("banks a failed turn's spend into state.usage so budget caps can see it (DLV-43)", async () => {
    const root = setupRepo();
    const { dir } = makePacketAndState(root);
    const driver = createDriver("fake", {
      script: {
        turns: [
          {
            throws: "claude driver: query failed — Claude Code returned an error result: Reached maximum number of turns (8)",
            throwsUsage: {
              usage: { input: 7794, cachedInput: 368131, output: 7010, costUsd: 0.3393 },
              usageV2: { input: 7794, cachedRead: 368131, cacheCreation: 129817, output: 7010, reasoningOutput: 0 },
            },
          },
        ],
      },
    });

    await advanceSession({
      sessionDir: dir, driver, repoRoot: root, runValidation: passingValidation,
      retryDelayMs: 0, sleep: () => {}, takeSnapshot: stableSnapshot,
    });
    const tick = await advanceSession({
      sessionDir: dir, driver, repoRoot: root, runValidation: passingValidation,
      retryDelayMs: 0, sleep: () => {}, takeSnapshot: stableSnapshot,
      deliveryConfig: { errors: { maxAutoRetries: 2 } },
    });

    expect(tick.state.state).toBe("NEEDS_DECISION");
    expect(tick.state.usage.total).toMatchObject({
      input: 7794,
      cachedRead: 368131,
      cacheCreation: 129817,
      output: 7010,
    });
    expect(tick.state.usage.total.costUsd).toBeCloseTo(0.3393, 4);
    // Attributed to the phase that spent it, in the same bucket a successful
    // turn would have used — not a parallel key nothing else reads.
    expect(tick.state.usage.perPhase.discovery).toMatchObject({ cacheCreation: 129817 });
  });

  it("sums spend across every failed retry attempt, not just the last one (DLV-43)", async () => {
    const root = setupRepo();
    const { dir } = makePacketAndState(root);
    const attempt = {
      throws: "network exploded",
      throwsUsage: {
        usage: { input: 100, cachedInput: 1000, output: 50, costUsd: 0.01 },
        usageV2: { input: 100, cachedRead: 1000, cacheCreation: 500, output: 50, reasoningOutput: 0 },
      },
    };
    const driver = createDriver("fake", { script: { turns: [attempt, attempt, attempt] } });

    await advanceSession({
      sessionDir: dir, driver, repoRoot: root, runValidation: passingValidation,
      retryDelayMs: 0, sleep: () => {}, takeSnapshot: stableSnapshot,
    });
    const tick = await advanceSession({
      sessionDir: dir, driver, repoRoot: root, runValidation: passingValidation,
      retryDelayMs: 0, sleep: () => {}, takeSnapshot: stableSnapshot,
      deliveryConfig: { errors: { maxAutoRetries: 2 } },
    });

    expect(readEvents(dir).filter((e) => e.type === "retry.automatic")).toHaveLength(2);
    expect(tick.state.usage.total).toMatchObject({ input: 300, cachedRead: 3000, cacheCreation: 1500, output: 150 });
    expect(tick.state.usage.total.costUsd).toBeCloseTo(0.03, 4);
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

describe("advanceSession: per-phase driver mode override (BUD-11 root cause #1)", () => {
  it("resumes BUILDING with mode=build even though the ref was established readonly in DISCOVERY, without ever mutating the persisted ref's mode", async () => {
    const root = setupRepo();
    const { dir } = makePacketAndState(root);
    const driver = createDriver("fake", { script: happyPathScript() });

    // Spy on resume() to capture the override each phase actually asked for,
    // while still delegating to the real fake-driver behavior.
    const resumeCalls: Array<{ refMode: string; overrideMode: string | undefined }> = [];
    const originalResume = driver.resume.bind(driver);
    driver.resume = (ref: { mode: string }, overrides: { mode?: string } = {}) => {
      resumeCalls.push({ refMode: ref.mode, overrideMode: overrides.mode });
      return originalResume(ref, overrides);
    };

    let state = await drive(dir, driver, root, { runValidation: passingValidation });
    expect(state.state).toBe("SPEC_READY");
    expect(state.driver.ref.mode).toBe("readonly"); // DISCOVERY establishes readonly

    writeDecision(dir, 1, "spec", "approve");
    state = await drive(dir, driver, root, { runValidation: passingValidation });
    expect(state.state).toBe("PLAN_READY");

    writeDecision(dir, 2, "plan", "approve");
    state = await drive(dir, driver, root, { runValidation: passingValidation });
    expect(state.state).toBe("UAT_READY");

    // The persisted ref's mode never changes from its original DISCOVERY value...
    expect(state.driver.ref.mode).toBe("readonly");
    // ...but BUILDING must have resumed with an explicit "build" override, or
    // the write-capable tools would never have been offered to the agent
    // (the exact BUD-11 failure: 10 "build steps" that could only write
    // prose because the session was frozen in readonly mode).
    const buildOverrides = resumeCalls.filter((c) => c.overrideMode === "build");
    expect(buildOverrides.length).toBeGreaterThan(0);
    for (const call of buildOverrides) {
      expect(call.refMode).toBe("readonly");
    }
  });
});

describe("advanceSession: D10/DLV-11 lane-resolved validation ladder reaches handleValidating", () => {
  it("threads packet.lanePolicy.validationLadder's rungs and targeted changed files into the VALIDATING run", async () => {
    const root = setupRepo();
    const { dir } = makePacketAndState(root, null, {
      lane: "FAST",
      tier: "economy",
      effortByPhase: { discovery: "low", plan: "medium", building: "medium", review: "low" },
      budget: { maxUsd: 0.5, maxTokens: 500_000, warnPct: 0.8 },
      maxInternalTurns: 8,
      validationLadder: { rungs: ["typecheck", "test"], targetedTest: true },
    });
    const driver = createDriver("fake", { script: happyPathScript() });
    const calls: Array<{ rungs: string[] | null; targetedFiles: string[] | null }> = [];
    const capturingValidation = async (...args: unknown[]) => {
      const opts = args[0] as { rungs: string[] | null; targetedFiles: string[] | null };
      calls.push({ rungs: opts.rungs, targetedFiles: opts.targetedFiles });
      const full = passingValidation();
      if (!opts.rungs) return full;
      // Mirror runValidationCommands' own skip-recording so this fixture is a
      // faithful double, not just a value that happens to satisfy the assertion.
      const results: Record<string, unknown> = {};
      for (const key of Object.keys(full.results)) {
        results[key] = opts.rungs.includes(key)
          ? full.results[key as keyof typeof full.results]
          : { ok: true, skipped: true, reason: "not in this lane's validation ladder" };
      }
      return { ...full, results };
    };

    let state = await drive(dir, driver, root, { runValidation: capturingValidation });
    expect(state.state).toBe("SPEC_READY");
    writeDecision(dir, 1, "spec", "approve");
    state = await drive(dir, driver, root, { runValidation: capturingValidation });
    expect(state.state).toBe("PLAN_READY");

    writeDecision(dir, 2, "plan", "approve");
    // BUILDING -> VALIDATING -> REVIEWING -> UAT_READY happens inside this one drive() call.
    state = await drive(dir, driver, root, { runValidation: capturingValidation });
    expect(state.state).toBe("UAT_READY");

    expect(calls.length).toBeGreaterThan(0);
    for (const call of calls) {
      expect(call.rungs).toEqual(["typecheck", "test"]);
    }
    const validation = JSON.parse(readFileSync(join(dir, "artifacts", "validation.json"), "utf8"));
    // lint was never in the FAST ladder -- recorded as a governed skip, not silently absent.
    expect(validation.results.lint).toEqual({ ok: true, skipped: true, reason: "not in this lane's validation ladder" });
    const report = readFileSync(join(dir, "artifacts", "validation-report.md"), "utf8");
    expect(report).toContain("## lint\nSKIPPED — not in this lane's validation ladder");
  });

  it("omits rungs/targetedFiles entirely for a pre-D9 packet with no lanePolicy (unchanged: run everything)", async () => {
    const root = setupRepo();
    const { dir } = makePacketAndState(root); // no lanePolicy
    const driver = createDriver("fake", { script: happyPathScript() });
    const calls: Array<{ rungs: string[] | null }> = [];
    const capturingValidation = async (...args: unknown[]) => {
      const opts = args[0] as { rungs: string[] | null };
      calls.push({ rungs: opts.rungs });
      return passingValidation();
    };

    let state = await drive(dir, driver, root, { runValidation: capturingValidation });
    writeDecision(dir, 1, "spec", "approve");
    state = await drive(dir, driver, root, { runValidation: capturingValidation });
    writeDecision(dir, 2, "plan", "approve");
    state = await drive(dir, driver, root, { runValidation: capturingValidation });
    expect(state.state).toBe("UAT_READY");

    expect(calls.length).toBeGreaterThan(0);
    for (const call of calls) expect(call.rungs).toBeNull();
  });
});

describe("advanceSession: D9/DLV-6 lane-resolved maxInternalTurns reaches the driver", () => {
  it("threads packet.lanePolicy.maxInternalTurns onto the SDK-facing turn options via the driver ref", async () => {
    const root = setupRepo();
    const { dir } = makePacketAndState(root, null, {
      lane: "FAST",
      tier: "economy",
      effortByPhase: { discovery: "low", plan: "medium", building: "medium", review: "low" },
      budget: { maxUsd: 0.5, maxTokens: 500_000, warnPct: 0.8 },
      maxInternalTurns: 8,
    });
    const driver = createDriver("fake", { script: happyPathScript() });

    const state = await drive(dir, driver, root, { runValidation: passingValidation });
    expect(state.state).toBe("SPEC_READY");
    // fake.mjs stamps a per-turn maxTurns onto currentRef (mirrors model/effort
    // override tracking) -- proves the value travelled packet -> runGuardedTurn
    // -> driver.runTurn, not just that resolveLanePolicy computes it correctly.
    expect(state.driver.ref.maxTurns).toBe(8);
  });

  it("omits maxTurns entirely for a pre-D9 packet with no lanePolicy recorded (uncapped, unchanged behavior)", async () => {
    const root = setupRepo();
    const { dir } = makePacketAndState(root); // no lanePolicy
    const driver = createDriver("fake", { script: happyPathScript() });

    const state = await drive(dir, driver, root, { runValidation: passingValidation });
    expect(state.state).toBe("SPEC_READY");
    expect(state.driver.ref.maxTurns).toBeUndefined();
  });

  // DLV-45. The bug this guards: FAST differed from STANDARD in its turn cap
  // but not in what it asked the agent to read, so its own (tighter) cap was
  // spent on ceremony and DISCOVERY could never finish. Asserting on the real
  // prompt that reached the driver, not on the policy that computes it.
  describe("DLV-45: FAST narrows the mandated reading list", () => {
    /** Give the packet a realistic campaign-doc + skill payload for one lane. */
    function withContextPayload(dir: string, lane: string | null) {
      const packetPath = join(dir, "packet.json");
      const packet = JSON.parse(readFileSync(packetPath, "utf8"));
      packet.context = {
        campaignFiles: [
          "ERA Notes/10 - Project Management/Budget/1 - Feature State.md",
          "ERA Notes/10 - Project Management/Budget/2 - Vision & Roadmap.md",
          "ERA Notes/10 - Project Management/Budget/3 - Action Plan.md",
          "ERA Notes/10 - Project Management/Budget/4 - Checklist.md",
        ],
        relatedNotes: [],
      };
      packet.skills = [
        { capability: "code-review", path: ".claude/skills/finish-task/SKILL.md" },
        { capability: "frontend-impl", path: ".claude/skills/ui-guardrails/SKILL.md" },
      ];
      if (lane) {
        packet.lanePolicy = {
          lane,
          tier: lane === "FAST" ? "economy" : "standard",
          effortByPhase: { discovery: "low", plan: "medium", building: "medium", review: "low" },
          budget: { maxUsd: 0.5, maxTokens: 500_000, warnPct: 0.8 },
          maxInternalTurns: 12,
        };
      }
      atomicWriteJsonSync(packetPath, packet);
    }

    function discoveryPrompt(dir: string) {
      return readFileSync(join(dir, "transcript", "prompts", "0001.md"), "utf8");
    }

    it("drops campaign docs, the always-on skill, and the doctrine re-read on FAST", async () => {
      const root = setupRepo();
      const { dir } = makePacketAndState(root);
      withContextPayload(dir, "FAST");
      const driver = createDriver("fake", { script: happyPathScript() });

      await drive(dir, driver, root, { runValidation: passingValidation });
      const prompt = discoveryPrompt(dir);

      expect(prompt).not.toContain("Budget/1 - Feature State.md");
      expect(prompt).not.toContain("Budget/2 - Vision & Roadmap.md");
      expect(prompt).not.toContain("Budget/3 - Action Plan.md");
      expect(prompt).not.toContain("Campaign context files");
      // The item's own pmFile ("Budget/4 - Checklist.md") IS still in the packet
      // header — that is the work item, not campaign strategy reading.
      expect(prompt).toContain("Budget/4 - Checklist.md");
      // The always-on code-review row's skill belongs to REVIEWING, which reads
      // it by its own path — listing it here just read it a phase early.
      expect(prompt).not.toContain("finish-task/SKILL.md");
      // The risk-flag skill is exactly what must survive: it carries the UI hard rules.
      expect(prompt).toContain("ui-guardrails/SKILL.md");
      expect(prompt).not.toContain("read CLAUDE.md at the repository root");
      expect(prompt).toContain("FAST-lane session");
    });

    it("leaves STANDARD's reading list completely untouched", async () => {
      const root = setupRepo();
      const { dir } = makePacketAndState(root);
      withContextPayload(dir, "STANDARD");
      const driver = createDriver("fake", { script: happyPathScript() });

      await drive(dir, driver, root, { runValidation: passingValidation });
      const prompt = discoveryPrompt(dir);

      expect(prompt).toContain("1 - Feature State.md");
      expect(prompt).toContain("4 - Checklist.md");
      expect(prompt).toContain("finish-task/SKILL.md");
      expect(prompt).toContain("ui-guardrails/SKILL.md");
      expect(prompt).toContain("read CLAUDE.md at the repository root");
    });

    it("treats a pre-D9 packet with no lanePolicy as full-context (unchanged behavior)", async () => {
      const root = setupRepo();
      const { dir } = makePacketAndState(root);
      withContextPayload(dir, null);
      const driver = createDriver("fake", { script: happyPathScript() });

      await drive(dir, driver, root, { runValidation: passingValidation });
      expect(discoveryPrompt(dir)).toContain("1 - Feature State.md");
    });
  });
});

// DLV-53: a rejected plan used to be routed to DISCOVERY, whose prompt asks for
// a spec. The owner's re-plan instruction reached a phase that cannot produce a
// plan, the spec was needlessly re-authored, and the plan was never revised.
describe("advanceSession: rejecting a plan returns to the SPEC gate (DLV-53)", () => {
  it("re-arms the spec gate, keeps the approved spec, and carries the note into the next PLAN turn", async () => {
    const root = setupRepo();
    const { dir } = makePacketAndState(root);
    const driver = createDriver("fake", {
      script: {
        turns: [
          { finalText: SPEC_TEXT },
          { finalText: PLAN_TEXT },
          // The re-plan turn after the owner rejects. If the runner wrongly sent
          // this to DISCOVERY it would demand SPEC-shaped JSON and this
          // plan-shaped payload would fail to parse.
          { finalText: PLAN_TEXT },
        ],
      },
    });

    await drive(dir, driver, root, { runValidation: passingValidation });
    writeDecision(dir, 1, "spec", "approve");
    let state = await drive(dir, driver, root, { runValidation: passingValidation });
    expect(state.state).toBe("PLAN_READY");
    const specBefore = readFileSync(join(dir, "artifacts", "spec.md"), "utf8");

    writeDecision(dir, 2, "plan", "reject", { note: "Too many steps — re-plan with exactly one." });
    state = await drive(dir, driver, root, { runValidation: passingValidation });

    // Back on the SPEC gate, armed and labelled — not parked with awaiting: null,
    // and not thrown back into DISCOVERY.
    expect(state.state).toBe("SPEC_READY");
    expect(state.awaiting).toMatchObject({ gate: "spec", reason: "plan-rejected" });
    // The approved spec is untouched: rejecting a plan says nothing about the spec.
    expect(readFileSync(join(dir, "artifacts", "spec.md"), "utf8")).toBe(specBefore);
    // The rejection note must reach the turn that re-plans, or the owner's
    // instruction is silently dropped (the DLV-32 failure mode).
    expect(state.pendingGuidance).toContain("Too many steps — re-plan with exactly one.");

    // Approving again runs a fresh PLAN turn, which is what "revise the plan" means.
    writeDecision(dir, 3, "spec", "approve");
    state = await drive(dir, driver, root, { runValidation: passingValidation });
    expect(state.state).toBe("PLAN_READY");
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
    // DLV-37: state.usage is v2-shaped (cachedRead/cacheCreation), fed here
    // via fallbackUsageV2FromV1 since the fake driver only supplied v1 usage.
    expect(state.usage.perPhase.discovery).toMatchObject({ input: 7, cachedRead: 2, cacheCreation: 0, output: 3 });
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

  // Regression: a single advanceSession tick can take minutes (the validation
  // baseline runs a real test/lint suite). The old runLoop only wrote the
  // heartbeat *between* ticks, so it went stale during a long tick, the
  // dashboard reported the runner dead, and a Resume click spawned a duplicate
  // runner. runLoop now drives an interval-based heartbeat that beats
  // regardless of tick progress.
  it("beats the heartbeat on an interval independent of per-tick work", async () => {
    const root = setupRepo();
    const { dir } = makePacketAndState(root);
    // Park the session at a gate so every tick is a no-op (didWork:false) —
    // this isolates the interval heartbeat from any handler/driver work.
    const st = JSON.parse(readFileSync(join(dir, "state.json"), "utf8"));
    st.state = "SPEC_READY";
    atomicWriteJsonSync(join(dir, "state.json"), st);

    const seen = new Set<string>();
    let ticks = 0;
    await runLoop({
      sessionDir: dir,
      repoRoot: root,
      driverKind: "fake",
      heartbeatIntervalMs: 10,
      pollIntervalMs: 10,
      retryDelayMs: 0,
      shouldStop: () => {
        try {
          seen.add(JSON.parse(readFileSync(join(dir, "runner.json"), "utf8")).heartbeatAt);
        } catch {
          /* runner.json not written yet */
        }
        ticks += 1;
        return seen.size >= 3 || ticks > 500;
      },
    });

    // The heartbeat advanced multiple times while the loop sat at a gate doing
    // no tick work — proof the dashboard would keep seeing a live runner.
    expect(seen.size).toBeGreaterThanOrEqual(2);
  });
});

describe("runValidationCommands", () => {
  it("stops at the first failing command and captures its excerpt; later commands don't run", async () => {
    const calls: string[] = [];
    const run = async (_cmd: string, args: string[]) => {
      calls.push(args[0]);
      if (args[0] === "typecheck") return { status: 0, stdout: "ok\n", stderr: "", ms: 1, timedOut: false };
      if (args[0] === "lint") return { status: 1, stdout: "", stderr: "lint error\n", ms: 1, timedOut: false };
      return { status: 0, stdout: "", stderr: "", ms: 1, timedOut: false };
    };
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const result = await runValidationCommands({ cwd: "/repo", run: run as any });
    expect(result.ok).toBe(false);
    expect(calls).toEqual(["typecheck", "lint"]);
    expect(result.results.lint.ok).toBe(false);
    expect(result.results.lint.excerpt).toContain("lint error");
    // D10/DLV-11: never silently absent -- a fail-fast-skipped rung is a
    // structured, recorded skip, not a missing key.
    expect(result.results.test).toEqual({ ok: true, skipped: true, reason: "not run — an earlier validation command failed" });
  });

  it("passes when every command exits 0", async () => {
    const run = async () => ({ status: 0, stdout: "", stderr: "", ms: 1, timedOut: false });
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const result = await runValidationCommands({ cwd: "/repo", run: run as any });
    expect(result.ok).toBe(true);
    expect(result.results.typecheck.ok).toBe(true);
    expect(result.results.lint.ok).toBe(true);
    expect(result.results.test.ok).toBe(true);
  });

  it("treats a timed-out command as a failure and annotates the excerpt with the effective (per-command) timeout", async () => {
    const seenTimeouts: Record<string, number> = {};
    const run = async (_cmd: string, args: string[], opts: { timeoutMs: number }) => {
      seenTimeouts[args[0]] = opts.timeoutMs;
      return args[0] === "lint"
        ? { status: null, stdout: "", stderr: "", ms: 900_000, timedOut: true }
        : { status: 0, stdout: "", stderr: "", ms: 1, timedOut: false };
    };
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const result = await runValidationCommands({ cwd: "/repo", timeoutMs: 240_000, run: run as any });
    expect(result.ok).toBe(false);
    expect(result.results.lint.ok).toBe(false);
    expect(result.results.lint.timedOut).toBe(true);
    // lint carries its own 900s bound (real cost ~11 min); the caller's 240s
    // stays the fallback for commands without one (typecheck).
    expect(seenTimeouts.typecheck).toBe(240_000);
    expect(seenTimeouts.lint).toBe(900_000);
    expect(result.results.lint.excerpt).toContain("exceeded 900000ms");
    expect(result.results.test).toEqual({ ok: true, skipped: true, reason: "not run — an earlier validation command failed" });
  });

  it("emits per-command progress events via onEvent", async () => {
    const run = async (_cmd: string, args: string[]) =>
      args[0] === "lint"
        ? { status: 1, stdout: "lint error", stderr: "", ms: 5, timedOut: false }
        : { status: 0, stdout: "", stderr: "", ms: 1, timedOut: false };
    const events: Array<{ type: string; data: Record<string, unknown> }> = [];
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    await runValidationCommands({ cwd: "/repo", run: run as any, onEvent: (e: any) => events.push(e) });
    expect(events.map((e) => `${e.type}:${e.data.command}`)).toEqual([
      "validation.command.started:typecheck",
      "validation.command.finished:typecheck",
      "validation.command.started:lint",
      "validation.command.finished:lint",
      "validation.command.skipped:test",
    ]);
    expect(events[1].data.ok).toBe(true);
    expect(events[3].data.ok).toBe(false);
  });

  it("truncates output to the last 200 lines", async () => {
    const bigOutput = Array.from({ length: 500 }, (_, i) => `line ${i}`).join("\n");
    const run = async () => ({ status: 1, stdout: bigOutput, stderr: "", ms: 1, timedOut: false });
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const result = await runValidationCommands({ cwd: "/repo", run: run as any });
    const excerpt = result.results.typecheck.excerpt as string; // typecheck always runs (no rungs filter) in this test
    const lineCount = excerpt.split("\n").length;
    expect(lineCount).toBeLessThanOrEqual(200);
    expect(excerpt).toContain("line 499");
    expect(excerpt).not.toContain("line 0\n");
  });

  it("D10/DLV-11: a lane-ladder rung skip is recorded before any command runs, and never fails the overall result", async () => {
    const calls: string[] = [];
    const run = async (_cmd: string, args: string[]) => {
      calls.push(args[0]);
      return { status: 0, stdout: "", stderr: "", ms: 1, timedOut: false };
    };
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const result = await runValidationCommands({ cwd: "/repo", run: run as any, rungs: ["typecheck", "test"] });
    expect(result.ok).toBe(true);
    expect(calls).toEqual(["typecheck", "test"]); // lint never invoked at all
    expect(result.results.lint).toEqual({ ok: true, skipped: true, reason: "not in this lane's validation ladder" });
    expect(result.results.typecheck.ok).toBe(true);
    expect(result.results.test.ok).toBe(true);
  });

  it("D10/DLV-11: runs `vitest related <changed files>` for the test rung when targetedFiles is given", async () => {
    const invocations: Array<{ cmd: string; args: string[] }> = [];
    const run = async (cmd: string, args: string[]) => {
      invocations.push({ cmd, args });
      return { status: 0, stdout: "", stderr: "", ms: 1, timedOut: false };
    };
    const result = await runValidationCommands({
      cwd: "/repo",
      // Narrowing the real spawn signature would pull the whole child_process
      // surface into a test that only records cmd/args. (Directive must be a
      // single line — a multi-line // block makes "next line" the comment's own
      // second line, which is how this ended up reported as unused.)
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      run: run as any,
      rungs: ["typecheck", "test"],
      targetedFiles: ["scripts/delivery/recommendation.mjs"],
    });
    expect(result.results.test.targeted).toBe(true);
    const testInvocation = invocations.find((i) => i.args.includes("related"));
    expect(testInvocation).toEqual({
      cmd: "pnpm",
      args: ["exec", "vitest", "related", "scripts/delivery/recommendation.mjs", "--passWithNoTests"],
    });
    // typecheck is untouched by targeting -- only the "test" rung changes shape.
    expect(invocations[0]).toEqual({ cmd: "pnpm", args: ["typecheck"] });
  });

  it("D10/DLV-11: falls back to the full untargeted test command when targetedFiles is empty/omitted", async () => {
    const invocations: Array<{ cmd: string; args: string[] }> = [];
    const run = async (cmd: string, args: string[]) => {
      invocations.push({ cmd, args });
      return { status: 0, stdout: "", stderr: "", ms: 1, timedOut: false };
    };
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    await runValidationCommands({ cwd: "/repo", run: run as any, rungs: ["typecheck", "test"], targetedFiles: [] });
    expect(invocations.find((i) => i.args[0] === "test")).toEqual({ cmd: "pnpm", args: ["test"] });
  });
});
