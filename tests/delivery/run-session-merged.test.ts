// DLV-62 acceptance tests: the FAST merged DISCOVERY+PLAN turn.
//
// The owner authorized options (a)+(b) only. (b) halves the *traversals* — two
// full-context turns become one — and (c), collapsing the SPEC and PLAN
// approvals into one, was explicitly NOT authorized. So the load-bearing
// assertion in this file is that all three gates still fire.
import { existsSync, mkdirSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { afterEach, describe, expect, it } from "vitest";

import { createDriver } from "../../scripts/delivery/drivers/driver.mjs";
import "../../scripts/delivery/drivers/fake.mjs";
import { atomicWriteJsonSync } from "../../scripts/delivery/fsx.mjs";
import { buildItemIdentity, buildPacket, makeSessionId } from "../../scripts/delivery/packet.mjs";
import { advanceSession } from "../../scripts/delivery/run-session.mjs";
import { resolveMergedDiscoveryPlan } from "../../scripts/delivery/recommendation.mjs";

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
  const root = mkdtempSync(join(tmpdir(), "delivery-merged-"));
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

const FAST_LANE_POLICY = {
  lane: "FAST",
  tier: "economy",
  effortByPhase: { discovery: "low", plan: "low", building: "medium", review: "low" },
  budget: { maxUsd: 0.5, maxTokens: 500_000, warnPct: 0.8 },
  maxInternalTurns: 12,
  validationLadder: { rungs: ["typecheck", "test"], targetedTest: true },
};

function makePacketAndState(root: string, { merged = true } = {}) {
  const raw = ["# Now", "", "- [ ] **N1** Change the quick-amount chip _(friction - S)_", ""].join("\n");
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
      scopeHints: { keywords: [], globs: ["src/components/expense/MobileExpenseForm.tsx"], modules: ["Budget"], scopeSource: "item-paths" },
      capabilities: [
        { name: "automated-testing", reason: "always-on", source: "rule", blocking: true },
        { name: "code-review", reason: "always-on", source: "rule", blocking: true },
        { name: "uat-generation", reason: "always-on", source: "rule", blocking: true },
      ],
      skills: [], acceptanceCriteria: [],
      workspace: { baseHead: "HEAD", dirtyAtStart: false, baselineStatusHash: "x", changedFiles: [] },
      lanePolicy: { ...FAST_LANE_POLICY, mergedDiscoveryPlan: merged, mergedDiscoveryPlanReason: merged ? "test fixture" : "test fixture (disabled)" },
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
function readPrompt(dir: string, turnId: string): string {
  return readFileSync(join(dir, "transcript", "prompts", `${turnId}.md`), "utf8");
}
function passingValidation() {
  return { ok: true, results: { typecheck: { ok: true, ms: 1, excerpt: "" }, test: { ok: true, ms: 1, excerpt: "" } } };
}

async function drive(dir: string, driver: object, repoRoot: string) {
  let last;
  for (let i = 0; i < 50; i++) {
    const { didWork, state } = await advanceSession({
      sessionDir: dir, driver, repoRoot, runValidation: passingValidation,
      retryDelayMs: 0, sleep: () => {}, takeSnapshot: stableSnapshot, readHead: () => "fixture-head",
    });
    last = state;
    if (!didWork) return last;
  }
  throw new Error("drive() exceeded iteration budget");
}

const PLAN_OBJECT = {
  steps: [{ id: "S1", description: "change the preset", paths: ["src/components/expense/MobileExpenseForm.tsx"], validationHint: "pnpm test" }],
  testPlan: "targeted", riskFlags: [], rollbackSketch: "revert the line", noNewDeps: true, openQuestions: [],
};
const SPEC_FIELDS = {
  problem: "the chip is wrong", currentBehavior: "shows 25", proposedBehavior: "shows 20",
  acceptanceCriteria: [{ id: "AC1", text: "the chip shows 20" }],
  affectedPaths: ["src/components/expense/MobileExpenseForm.tsx"],
  riskFlags: [], openQuestions: [],
  scopeEstimate: { files: 1, occurrences: 1, modules: 1 },
};
const MERGED_TEXT = JSON.stringify({ ...SPEC_FIELDS, plan: PLAN_OBJECT });
const SPEC_ONLY_TEXT = JSON.stringify(SPEC_FIELDS);
const USAGE = { input: 1, cachedInput: 0, output: 1, costUsd: null };

// ============================================================
describe("DLV-62: resolveMergedDiscoveryPlan", () => {
  const single = { scopeSource: "item-paths", globs: ["src/a.ts"] };

  it("merges on FAST when the item names exactly one file", () => {
    expect(resolveMergedDiscoveryPlan({ lane: "FAST", scopeHints: single })).toMatchObject({ merged: true });
  });

  it("never merges on STANDARD or DEEP", () => {
    expect(resolveMergedDiscoveryPlan({ lane: "STANDARD", scopeHints: single }).merged).toBe(false);
    expect(resolveMergedDiscoveryPlan({ lane: "DEEP", scopeHints: single }).merged).toBe(false);
  });

  it("never merges when scope is broader than one named file", () => {
    expect(resolveMergedDiscoveryPlan({ lane: "FAST", scopeHints: { scopeSource: "item-paths", globs: ["a.ts", "b.ts"] } }).merged).toBe(false);
    // Campaign-glob scope is not evidence about this item (DLV-42), so it can
    // never justify merging.
    expect(resolveMergedDiscoveryPlan({ lane: "FAST", scopeHints: { globs: ["src/features/**"] } }).merged).toBe(false);
  });

  it("respects the owner's config switch", () => {
    const off = { pipeline: { mergeDiscoveryPlanOnFastSingleFile: false } };
    expect(resolveMergedDiscoveryPlan({ lane: "FAST", scopeHints: single, config: off }).merged).toBe(false);
  });

  it("always states why", () => {
    expect(resolveMergedDiscoveryPlan({ lane: "DEEP", scopeHints: single }).reason).toContain("DEEP");
  });
});

describe("DLV-62: the merged turn", () => {
  it("produces spec AND plan in one turn, and still stops at the spec gate", async () => {
    const root = setupRepo();
    const { dir } = makePacketAndState(root);
    const driver = createDriver("fake", { script: { turns: [{ finalText: MERGED_TEXT, usage: USAGE }] } });

    const state = await drive(dir, driver, root);

    // Gate 1 fires exactly as before.
    expect(state.state).toBe("SPEC_READY");
    expect(state.awaiting.gate).toBe("spec");
    // Both artifacts exist after ONE turn.
    expect(state.turnCounter).toBe(1);
    expect(existsSync(join(dir, "artifacts", "spec.md"))).toBe(true);
    expect(existsSync(join(dir, "artifacts", "plan.md"))).toBe(true);
    expect(state.mergedPlanPending).toBe(true);
    expect(readEvents(dir).some((e) => e.type === "plan.merged")).toBe(true);
    expect(readPrompt(dir, "0001")).toContain("DISCOVERY + PLAN (merged)");
  });

  it("approving the spec reaches the plan gate WITHOUT a second turn", async () => {
    const root = setupRepo();
    const { dir } = makePacketAndState(root);
    // A single scripted turn: if a separate PLAN turn ran, the fake driver
    // would run out of script and the session would stop instead of gating.
    const driver = createDriver("fake", { script: { turns: [{ finalText: MERGED_TEXT, usage: USAGE }] } });
    await drive(dir, driver, root);

    writeDecision(dir, 1, "spec", "approve");
    const state = await drive(dir, driver, root);

    // Gate 2 fires — the plan is approved separately, exactly as in every lane.
    expect(state.state).toBe("PLAN_READY");
    expect(state.awaiting.gate).toBe("plan");
    expect(state.turnCounter).toBe(1); // still one turn, not two
    expect(state.mergedPlanPending).toBe(false);
    expect(state.lastError).toBeNull();
  });

  it("still runs all three gates through to UAT — (c) was not authorized", async () => {
    const root = setupRepo();
    const { dir } = makePacketAndState(root);
    const driver = createDriver("fake", {
      script: {
        turns: [
          { finalText: MERGED_TEXT, usage: USAGE },
          { finalText: "built it", usage: USAGE },
          { finalText: JSON.stringify({ verdict: "PASS", findings: [] }), usage: USAGE },
          {
            finalText: JSON.stringify({
              summary: "done",
              acceptanceCriteria: [{ id: "AC1", status: "met", evidence: "test" }],
              manualSteps: [{ action: "a", expected: "e" }], deviations: [], followUps: [],
            }),
            usage: USAGE,
          },
        ],
      },
    });

    let state = await drive(dir, driver, root);
    expect(state.state).toBe("SPEC_READY"); // gate 1
    writeDecision(dir, 1, "spec", "approve");
    state = await drive(dir, driver, root);
    expect(state.state).toBe("PLAN_READY"); // gate 2
    writeDecision(dir, 2, "plan", "approve");
    state = await drive(dir, driver, root);
    expect(state.state).toBe("UAT_READY"); // gate 3
    // Four turns total (merged discovery+plan, build, review, uat) where the
    // unmerged shape would have needed five.
    expect(state.turnCounter).toBe(4);
  });

  it("a rejected plan runs a REAL plan turn, never re-approving the merged one", async () => {
    const root = setupRepo();
    const { dir } = makePacketAndState(root);
    const revisedPlan = { ...PLAN_OBJECT, testPlan: "revised targeted" };
    const driver = createDriver("fake", {
      script: {
        turns: [
          { finalText: MERGED_TEXT, usage: USAGE },
          { finalText: JSON.stringify(revisedPlan), usage: USAGE }, // the real PLAN turn
        ],
      },
    });
    await drive(dir, driver, root);
    writeDecision(dir, 1, "spec", "approve");
    await drive(dir, driver, root);

    writeDecision(dir, 2, "plan", "reject", { note: "one step, fold the verification in" });
    let state = await drive(dir, driver, root);
    // DLV-53: a rejected plan returns to the SPEC gate with the gate re-armed.
    expect(state.state).toBe("SPEC_READY");
    expect(state.mergedPlanPending).toBe(false);

    writeDecision(dir, 3, "spec", "approve");
    state = await drive(dir, driver, root);
    expect(state.state).toBe("PLAN_READY");
    expect(state.turnCounter).toBe(2); // a genuine second turn ran this time
    expect(JSON.parse(readFileSync(join(dir, "artifacts", "plan.json"), "utf8")).testPlan).toBe("revised targeted");
  });

  it("blocks rather than half-accepting a merged turn that omits the plan", async () => {
    const root = setupRepo();
    const { dir } = makePacketAndState(root);
    const driver = createDriver("fake", { script: { turns: [{ finalText: SPEC_ONLY_TEXT, usage: USAGE }] } });

    const state = await drive(dir, driver, root);
    expect(state.state).toBe("BLOCKED");
    expect(state.lastError.message).toContain("plan");
    expect(existsSync(join(dir, "artifacts", "plan.json"))).toBe(false);
  });

  it("an unmerged FAST session keeps the two-turn shape untouched", async () => {
    const root = setupRepo();
    const { dir } = makePacketAndState(root, { merged: false });
    const driver = createDriver("fake", {
      script: {
        turns: [
          { finalText: SPEC_ONLY_TEXT, usage: USAGE },
          { finalText: JSON.stringify(PLAN_OBJECT), usage: USAGE },
        ],
      },
    });

    let state = await drive(dir, driver, root);
    expect(state.state).toBe("SPEC_READY");
    expect(state.mergedPlanPending).toBeUndefined();
    expect(existsSync(join(dir, "artifacts", "plan.md"))).toBe(false);

    writeDecision(dir, 1, "spec", "approve");
    state = await drive(dir, driver, root);
    expect(state.state).toBe("PLAN_READY");
    expect(state.turnCounter).toBe(2);
  });
});
