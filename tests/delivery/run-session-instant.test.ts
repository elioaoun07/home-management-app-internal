// DLV-73 acceptance tests: the INSTANT lane.
//
// The claim INSTANT makes is narrow and checkable: **two model turns** for a
// one-line edit, against FAST's four-to-five, with all three gate decisions still
// recorded. The load-bearing assertions in this file are therefore turn counts
// and gate records — not artifact prose. The fake driver is scripted with exactly
// as many turns as the lane is allowed to spend, so a regression that
// reintroduces a REVIEWING or UAT_PREP model call fails by running out of script
// rather than by a soft assertion someone can talk themselves out of.
import { existsSync, mkdirSync, mkdtempSync, readFileSync, readdirSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { afterEach, describe, expect, it } from "vitest";

import { createDriver } from "../../scripts/delivery/drivers/driver.mjs";
import "../../scripts/delivery/drivers/fake.mjs";
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
  const root = mkdtempSync(join(tmpdir(), "delivery-instant-"));
  cleanupDirs.push(root);
  writeFileSync(join(root, "README.md"), "test repo\n");
  // The target has to actually exist: DLV-10's `resolveEvidence` only accepts an
  // AC evidence pointer that resolves against a file this session changed or a
  // file on disk, so a fixture without the file would park every session on an
  // unmet-acceptance question for a reason that has nothing to do with INSTANT.
  mkdirSync(join(root, "src", "components", "expense"), { recursive: true });
  writeFileSync(join(root, TARGET), 'const QUICK_AMOUNTS = ["5", "10", "25", "50", "100"];\n');
  return root;
}

const STABLE_SNAPSHOT = Object.freeze({
  status: "", head: "fixture-head", refs: "fixture-refs", indexDiff: "", trackedDiff: "", fingerprints: {},
});
function stableSnapshot() {
  return { ...STABLE_SNAPSHOT, fingerprints: {} };
}

const TARGET = "src/components/expense/MobileExpenseForm.tsx";

const INSTANT_LANE_POLICY = {
  lane: "INSTANT",
  tier: "economy",
  effortByPhase: { discovery: "low", plan: "low", building: "medium", review: "low" },
  budget: { maxUsd: 0.25, maxTokens: 250_000, warnPct: 0.8 },
  maxInternalTurns: 8,
  validationLadder: { rungs: ["typecheck", "test"], targetedTest: true },
  mergedDiscoveryPlan: true,
  mergedDiscoveryPlanReason: "INSTANT always produces the spec and plan in one turn",
};

function makePacketAndState(root: string, overrides: Record<string, unknown> = {}) {
  const raw = ["# Now", "", `- [ ] **N1** Replace the $25 preset with $20 → \`${TARGET}:1144\` _(annoyance - S)_`, ""].join("\n");
  const idResult = buildItemIdentity(raw, 0, "Budget/4 - Checklist.md");
  if (!idResult.ok) throw new Error("fixture setup failed");
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
      scopeHints: { keywords: [], globs: [TARGET], modules: ["Budget"], scopeSource: "item-paths" },
      capabilities: [
        { name: "automated-testing", reason: "always-on", source: "rule", blocking: true },
        { name: "code-review", reason: "always-on", source: "rule", blocking: true },
        { name: "uat-generation", reason: "always-on", source: "rule", blocking: true },
      ],
      skills: [], acceptanceCriteria: [],
      workspace: { baseHead: "HEAD", dirtyAtStart: false, baselineStatusHash: "x", changedFiles: [] },
      lanePolicy: { ...INSTANT_LANE_POLICY, ...overrides },
    }),
  );
  atomicWriteJsonSync(join(dir, "packet.json"), packet);
  const now = new Date().toISOString();
  atomicWriteJsonSync(join(dir, "state.json"), {
    schemaVersion: 1, sessionId, state: "SELECTED", awaiting: null,
    phaseHistory: [{ state: "SELECTED", enteredAt: now, exitedAt: null }],
    agent: "claude", driver: { ref: null, specialists: {} }, workspace: packet.workspace,
    build: null, fixLoop: 0,
    usage: { perPhase: {}, total: { input: 0, cachedInput: 0, output: 0, costUsd: null } },
    decisionsProcessed: 0, messagesProcessed: 0, lastError: null, createdAt: now, updatedAt: now,
  });
  return { dir };
}

function writeDecision(dir: string, seq: number, gate: string, decision: string, extra: Record<string, unknown> = {}) {
  const decisionsDir = join(dir, "decisions");
  mkdirSync(decisionsDir, { recursive: true });
  atomicWriteJsonSync(join(decisionsDir, `${String(seq).padStart(4, "0")}-${gate}.json`), {
    seq, gate, decision, note: null, confirmText: null, tickCheckbox: true,
    answer: null, capabilitiesDrop: null, at: new Date().toISOString(), ...extra,
  });
}

function readEvents(dir: string): Array<Record<string, unknown>> {
  return readFileSync(join(dir, "events.ndjson"), "utf8").trim().split("\n").filter(Boolean).map((l) => JSON.parse(l));
}
function turnPhases(dir: string): string[] {
  const file = join(dir, "transcript", "turns.ndjson");
  if (!existsSync(file)) return [];
  return readFileSync(file, "utf8").trim().split("\n").filter(Boolean).map((l) => JSON.parse(l).phase);
}
function passingValidation() {
  return { ok: true, results: { typecheck: { ok: true, ms: 1, excerpt: "" }, test: { ok: true, ms: 1, excerpt: "" } } };
}

/** A unified diff that changes exactly one line in the declared file. */
const CLEAN_DIFF = [
  `diff --git a/${TARGET} b/${TARGET}`,
  `--- a/${TARGET}`,
  `+++ b/${TARGET}`,
  "@@ -1144 +1144 @@",
  '-  const QUICK_AMOUNTS = ["5", "10", "25", "50", "100"];',
  '+  const QUICK_AMOUNTS = ["5", "10", "20", "50", "100"];',
].join("\n");

async function drive(
  dir: string,
  driver: object,
  repoRoot: string,
  opts: { diff?: string; changedFiles?: string[]; readDiff?: (root: string, paths?: string[]) => string } = {},
) {
  let last;
  for (let i = 0; i < 50; i++) {
    const { didWork, state } = await advanceSession({
      sessionDir: dir, driver, repoRoot, runValidation: passingValidation,
      retryDelayMs: 0, sleep: () => {}, takeSnapshot: stableSnapshot, readHead: () => "fixture-head",
      readDiff: opts.readDiff || (() => (opts.diff !== undefined ? opts.diff : CLEAN_DIFF)),
    });
    last = state;
    if (!didWork) return last;
  }
  throw new Error("drive() exceeded iteration budget");
}

const PLAN_OBJECT = {
  steps: [{ id: "S1", description: "change the preset", paths: [TARGET], validationHint: "pnpm test" }],
  testPlan: "targeted", riskFlags: [], rollbackSketch: "revert the line", noNewDeps: true, openQuestions: [],
};
const SPEC_FIELDS = {
  problem: "the chip offers 25", currentBehavior: "shows 25", proposedBehavior: "shows 20",
  acceptanceCriteria: [{ id: "AC1", text: "the chip shows 20" }],
  affectedPaths: [TARGET],
  riskFlags: [], openQuestions: [],
  scopeEstimate: { files: 1, occurrences: 1, modules: 1 },
};
const DECLARED_EDIT = {
  path: TARGET,
  anchor: 1144,
  before: 'const QUICK_AMOUNTS = ["5", "10", "25", "50", "100"];',
  after: 'const QUICK_AMOUNTS = ["5", "10", "20", "50", "100"];',
};
const MANUAL_STEPS = [{ action: "Open /expense on mobile", expected: "the chip row reads 20, not 25" }];

function instantText(over: Record<string, unknown> = {}) {
  return JSON.stringify({ ...SPEC_FIELDS, plan: PLAN_OBJECT, declaredEdit: DECLARED_EDIT, manualSteps: MANUAL_STEPS, ...over });
}
const USAGE = { input: 1, cachedInput: 0, output: 1, costUsd: null };
/** BUILDING has no output schema — free text plus the runner's own sentinels. */
const BUILD_TEXT = "Replaced the preset. Done.";

// ============================================================

describe("DLV-73: the INSTANT lane end to end", () => {
  it("reaches UAT_READY on exactly TWO model turns", async () => {
    const root = setupRepo();
    const { dir } = makePacketAndState(root);
    // Exactly two scripted turns. A REVIEWING or UAT_PREP model call would run
    // the script dry and strand the session — which is the point.
    const driver = createDriver("fake", {
      script: { turns: [{ finalText: instantText(), usage: USAGE }, { finalText: BUILD_TEXT, usage: USAGE }] },
    });

    let state = await drive(dir, driver, root);
    expect(state.state).toBe("SPEC_READY");
    expect(state.turnCounter).toBe(1);

    writeDecision(dir, 1, "spec", "approve");
    state = await drive(dir, driver, root);
    // The merged turn already wrote the plan, so the plan gate arrives with no
    // second turn spent.
    expect(state.state).toBe("PLAN_READY");
    expect(state.turnCounter).toBe(1);

    writeDecision(dir, 2, "plan", "approve");
    state = await drive(dir, driver, root);

    expect(state.state).toBe("UAT_READY");
    expect(state.awaiting.gate).toBe("uat");
    // TWO turns total: the merged spec+plan, and the build.
    expect(state.turnCounter).toBe(2);
    expect(turnPhases(dir)).toEqual(["DISCOVERY", "BUILDING"]);
    expect(turnPhases(dir)).not.toContain("REVIEWING");
    expect(turnPhases(dir)).not.toContain("UAT_PREP");
  });

  it("records the deterministic verification instead of a review turn", async () => {
    const root = setupRepo();
    const { dir } = makePacketAndState(root);
    const driver = createDriver("fake", {
      script: { turns: [{ finalText: instantText(), usage: USAGE }, { finalText: BUILD_TEXT, usage: USAGE }] },
    });
    await drive(dir, driver, root);
    writeDecision(dir, 1, "spec", "approve");
    await drive(dir, driver, root);
    writeDecision(dir, 2, "plan", "approve");
    await drive(dir, driver, root);

    const events = readEvents(dir);
    expect(events.some((e) => e.type === "instant.verified")).toBe(true);
    expect(events.some((e) => e.type === "instant.escalated")).toBe(false);

    const verification = JSON.parse(readFileSync(join(dir, "artifacts", "instant-verification.json"), "utf8"));
    expect(verification.ok).toBe(true);
    expect(verification.changedLines).toBe(2);
    expect(verification.declaredPath).toBe(TARGET);

    // "No review turn ran" must be a stated fact in the record, not an absence.
    expect(readFileSync(join(dir, "artifacts", "review-self.md"), "utf8")).toContain("deterministic");
    // The UAT package is structurally identical to every other lane's.
    for (const f of ["summary.md", "manual-test-script.md", "changes.md", "rollback.md", "notes.md"]) {
      expect(existsSync(join(dir, "artifacts", "uat", f))).toBe(true);
    }
    expect(readFileSync(join(dir, "artifacts", "uat", "manual-test-script.md"), "utf8")).toContain("the chip row reads 20");
  });

  it("still records all three gate decisions", async () => {
    const root = setupRepo();
    const { dir } = makePacketAndState(root);
    const driver = createDriver("fake", {
      script: { turns: [{ finalText: instantText(), usage: USAGE }, { finalText: BUILD_TEXT, usage: USAGE }] },
    });
    await drive(dir, driver, root);
    writeDecision(dir, 1, "spec", "approve");
    await drive(dir, driver, root);
    writeDecision(dir, 2, "plan", "approve");
    await drive(dir, driver, root);
    writeDecision(dir, 3, "uat", "accept");
    const state = await drive(dir, driver, root);

    expect(state.state).toBe("ACCEPTED");
    const gates = readdirSync(join(dir, "decisions")).map((f) => f.replace(/^\d+-|\.json$/g, "")).sort();
    expect(gates).toEqual(["plan", "spec", "uat"]);
  });
});

// Regression, s-20260801-094951-jx8o. That session made a correct two-line edit
// and was still judged a 1326-line, 20-file overreach, because the verifier was
// handed an unscoped `git diff` of a working tree the owner had left dirty. It
// escalated to the REVIEWING and UAT_PREP turns INSTANT exists to avoid, the
// REVIEWING turn then died on max-turns, and the session exhausted its budget
// and parked at NEEDS_DECISION. On a repo that is normally dirty — this one —
// the bug meant INSTANT could essentially never take its own fast path.
describe("DLV-73: the diff INSTANT verifies is scoped to the session's own files", () => {
  // Stands in for real git: unscoped reads report the whole tree, a pathspec
  // narrows it. The pre-existing hunks are what the owner had in flight.
  const OWNER_DIRTY = [
    "diff --git a/migrations/drop.sql b/migrations/drop.sql",
    "--- a/migrations/drop.sql",
    "+++ /dev/null",
    "@@ -1,2 +0,0 @@",
    "--- WHAT: unrelated work the owner had in flight",
    "--- WHY:  it has nothing to do with this session",
    "diff --git a/scripts/pm/bridge.mjs b/scripts/pm/bridge.mjs",
    "--- a/scripts/pm/bridge.mjs",
    "+++ b/scripts/pm/bridge.mjs",
    "@@ -1 +1 @@",
    "-const a = 1;",
    "+const a = 2;",
  ].join("\n");

  function gitLike(seen: string[][]) {
    return (_root: string, paths: string[] = []) => {
      seen.push(paths);
      const scoped = paths.length && paths.every((p) => p === TARGET);
      return scoped ? CLEAN_DIFF : `${OWNER_DIRTY}\n${CLEAN_DIFF}`;
    };
  }

  it("passes deterministically even when the rest of the tree is dirty", async () => {
    const root = setupRepo();
    const { dir } = makePacketAndState(root);
    const seen: string[][] = [];
    const driver = createDriver("fake", {
      script: { turns: [{ finalText: instantText(), usage: USAGE }, { finalText: BUILD_TEXT, usage: USAGE }] },
    });
    const opts = { readDiff: gitLike(seen) };

    await drive(dir, driver, root, opts);
    writeDecision(dir, 1, "spec", "approve");
    await drive(dir, driver, root, opts);
    writeDecision(dir, 2, "plan", "approve");
    const state = await drive(dir, driver, root, opts);

    // The whole point: two turns, no escalation, despite the dirty tree.
    expect(state.state).toBe("UAT_READY");
    expect(state.turnCounter).toBe(2);
    expect(turnPhases(dir)).toEqual(["DISCOVERY", "BUILDING"]);

    const verification = JSON.parse(readFileSync(join(dir, "artifacts", "instant-verification.json"), "utf8"));
    expect(verification.ok).toBe(true);
    expect(verification.failures).toEqual([]);
    // 2, not 1326: the owner's hunks were never in the numerator.
    expect(verification.changedLines).toBe(2);

    // And the read really was scoped, rather than the diff happening to be small.
    expect(seen.filter((p) => p.length).length).toBeGreaterThan(0);
    for (const paths of seen.filter((p) => p.length)) expect(paths).toEqual([TARGET]);
  });

  it("still catches an undeclared file inside the scoped read", async () => {
    const root = setupRepo();
    const { dir } = makePacketAndState(root);
    const driver = createDriver("fake", {
      script: {
        turns: [
          { finalText: instantText(), usage: USAGE },
          { finalText: BUILD_TEXT, usage: USAGE },
          { finalText: JSON.stringify({ verdict: "PASS", findings: [] }), usage: USAGE },
          {
            finalText: JSON.stringify({
              summary: "ok", acceptanceCriteria: [{ id: "AC1", status: "met", evidence: `${TARGET}:1144` }],
              manualSteps: MANUAL_STEPS, deviations: [], followUps: [],
            }),
            usage: USAGE,
          },
        ],
      },
    });
    // A file the session itself touched but never declared is still in the
    // scoped read, so scoping cannot be used to smuggle an edit past review.
    const sneaky = `${CLEAN_DIFF}\n${[
      "diff --git a/src/lib/other.ts b/src/lib/other.ts",
      "--- a/src/lib/other.ts",
      "+++ b/src/lib/other.ts",
      "@@ -1 +1 @@",
      "-const x = 1;",
      "+const x = 2;",
    ].join("\n")}`;
    const opts = { readDiff: () => sneaky };

    await drive(dir, driver, root, opts);
    writeDecision(dir, 1, "spec", "approve");
    await drive(dir, driver, root, opts);
    writeDecision(dir, 2, "plan", "approve");
    await drive(dir, driver, root, opts);

    const verification = JSON.parse(readFileSync(join(dir, "artifacts", "instant-verification.json"), "utf8"));
    expect(verification.ok).toBe(false);
    expect(verification.failures.map((f: { code: string }) => f.code)).toContain("undeclared-file");
    expect(readEvents(dir).some((e) => e.type === "instant.escalated")).toBe(true);
  });
});

describe("DLV-73: escalation — the thing that makes skipping review safe", () => {
  async function runToReview(diff: string, changedFilesFromDiff: string[] = [TARGET]) {
    const root = setupRepo();
    const { dir } = makePacketAndState(root);
    // Four turns scripted: two for INSTANT, plus the REVIEWING and UAT_PREP turns
    // an escalation must fall back to.
    const driver = createDriver("fake", {
      script: {
        turns: [
          { finalText: instantText(), usage: USAGE },
          { finalText: BUILD_TEXT, usage: USAGE },
          { finalText: JSON.stringify({ verdict: "PASS", findings: [] }), usage: USAGE },
          {
            finalText: JSON.stringify({
              // Evidence must be a pointer the runner can resolve (DLV-10), not
              // prose — a real review turn cites the file it read.
              summary: "ok", acceptanceCriteria: [{ id: "AC1", status: "met", evidence: `${TARGET}:1144` }],
              manualSteps: MANUAL_STEPS, deviations: [], followUps: [],
            }),
            usage: USAGE,
          },
        ],
      },
    });
    void changedFilesFromDiff;
    await drive(dir, driver, root, { diff });
    writeDecision(dir, 1, "spec", "approve");
    await drive(dir, driver, root, { diff });
    writeDecision(dir, 2, "plan", "approve");
    const state = await drive(dir, driver, root, { diff });
    return { dir, state };
  }

  it("escalates to the real review turns when the diff is larger than the lane allows", async () => {
    const big = [
      `--- a/${TARGET}`,
      `+++ b/${TARGET}`,
      ...Array.from({ length: 15 }, (_, i) => `-old line ${i}`),
      ...Array.from({ length: 15 }, (_, i) => `+new line ${i}`),
    ].join("\n");
    const { dir, state } = await runToReview(big);

    const events = readEvents(dir);
    const escalated = events.find((e) => e.type === "instant.escalated");
    expect(escalated).toBeTruthy();
    expect((escalated as { data: { failures: string[] } }).data.failures).toContain("diff-too-large");
    // The review it turned out to need actually ran.
    expect(turnPhases(dir)).toContain("REVIEWING");
    expect(turnPhases(dir)).toContain("UAT_PREP");
    expect(state.state).toBe("UAT_READY");
  });

  it("escalates when the diff does not match the approved declaredEdit", async () => {
    const wrong = [
      `--- a/${TARGET}`,
      `+++ b/${TARGET}`,
      '-  const QUICK_AMOUNTS = ["5", "10", "25", "50", "100"];',
      '+  const QUICK_AMOUNTS = ["5", "10", "99", "50", "100"];',
    ].join("\n");
    const { dir } = await runToReview(wrong);
    const escalated = readEvents(dir).find((e) => e.type === "instant.escalated");
    expect((escalated as { data: { failures: string[] } }).data.failures).toContain("after-not-added");
    expect(turnPhases(dir)).toContain("REVIEWING");
  });

  it("escalates when the working tree shows no change at all", async () => {
    const { dir } = await runToReview("");
    const escalated = readEvents(dir).find((e) => e.type === "instant.escalated");
    const failures = (escalated as { data: { failures: string[] } }).data.failures;
    expect(failures).toContain("after-not-added");
    expect(turnPhases(dir)).toContain("REVIEWING");
  });
});

describe("DLV-73: a clarifying question does not cost a second turn", () => {
  it("ships a complete proposal alongside its questions, and answer+approve reaches BUILDING", async () => {
    const root = setupRepo();
    const { dir } = makePacketAndState(root);
    // Two turns only: if answering re-ran DISCOVERY, the build turn would be
    // consumed by the re-run and the session would strand before BUILDING.
    const driver = createDriver("fake", {
      script: {
        turns: [
          { finalText: instantText({ openQuestions: [{ text: "Should the 100 preset stay?" }] }), usage: USAGE },
          { finalText: BUILD_TEXT, usage: USAGE },
        ],
      },
    });

    let state = await drive(dir, driver, root);
    expect(state.state).toBe("NEEDS_DECISION");
    expect(state.awaiting.gate).toBe("question");
    // The proposal is on disk and advertised, which is what makes one-action
    // answer+approve legitimate rather than a blind approval.
    expect(state.awaiting.proposalReady).toBe(true);
    expect(existsSync(join(dir, "artifacts", "plan.md"))).toBe(true);
    expect(state.turnCounter).toBe(1);

    writeDecision(dir, 1, "question", "answer", { answer: "yes, keep it", acceptProposal: true });
    state = await drive(dir, driver, root);
    // Resumed at the spec gate — no second DISCOVERY turn.
    expect(state.state).toBe("SPEC_READY");
    expect(state.turnCounter).toBe(1);

    writeDecision(dir, 2, "spec", "approve");
    await drive(dir, driver, root);
    writeDecision(dir, 3, "plan", "approve");
    state = await drive(dir, driver, root);
    expect(state.state).toBe("UAT_READY");
    expect(state.turnCounter).toBe(2);
  });

  it("without acceptProposal, answering still re-runs DISCOVERY as before", async () => {
    const root = setupRepo();
    const { dir } = makePacketAndState(root);
    const driver = createDriver("fake", {
      script: {
        turns: [
          { finalText: instantText({ openQuestions: [{ text: "Should the 100 preset stay?" }] }), usage: USAGE },
          { finalText: instantText(), usage: USAGE },
          { finalText: BUILD_TEXT, usage: USAGE },
        ],
      },
    });
    await drive(dir, driver, root);
    writeDecision(dir, 1, "question", "answer", { answer: "yes, keep it" });
    const state = await drive(dir, driver, root);
    // Re-ran the phase: a second turn, and back at the spec gate with a fresh spec.
    expect(state.state).toBe("SPEC_READY");
    expect(state.turnCounter).toBe(2);
  });
});

describe("DLV-73: the declaredEdit contract", () => {
  it("blocks the session rather than reaching BUILDING with an unverifiable edit", async () => {
    const root = setupRepo();
    const { dir } = makePacketAndState(root);
    const driver = createDriver("fake", {
      script: { turns: [{ finalText: JSON.stringify({ ...SPEC_FIELDS, plan: PLAN_OBJECT, manualSteps: MANUAL_STEPS }), usage: USAGE }] },
    });
    const state = await drive(dir, driver, root);
    // Caught at DISCOVERY, before the owner approves anything — not at review
    // time, when there would be no way forward and no way back.
    expect(state.state).toBe("BLOCKED");
    expect(String(state.lastError.message)).toContain("declaredEdit");
  });
});
