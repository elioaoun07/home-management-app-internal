// DLV-7 / DLV-9 acceptance tests: the scope contract end-to-end through the
// runner — measured estimate stamped on the SPEC gate, decomposition proposal
// on a mismatch, slice narrowing vs full-scope acknowledgment, the post-PLAN
// scope lock, and the post-discovery model-fit guard.
//
// Own file, matching the house split (run-session-handoff / -fork / -context /
// -memory each own one concern) rather than growing run-session.test.ts.
import { existsSync, mkdirSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from "node:fs";
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
  const root = mkdtempSync(join(tmpdir(), "delivery-scope-"));
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

/** A snapshot fn whose *second and later* calls report `changed` as modified, so the git guard sees a real delta. */
function snapshotWith(changed: string[]) {
  let calls = 0;
  return () => {
    calls += 1;
    const status = calls > 1 ? changed.map((p) => ` M ${p}`).join("\n") : "";
    return { ...STABLE_SNAPSHOT, status, fingerprints: {} };
  };
}

/** `effort` picks the item's declared size class — "M" by default, matching run-session.test.ts's fixture. */
function makePacketAndState(root: string, { effort = "M", model = null as string | null } = {}) {
  const raw = ["# Now", "", `- [ ] **N1** Fix rounding drift _(blocker - ${effort})_`, ""].join("\n");
  const idResult = buildItemIdentity(raw, 0, "Budget/4 - Checklist.md");
  if (!idResult.ok) throw new Error(`fixture setup failed: ${(idResult as { reason: string }).reason}`);
  const item = (idResult as { ok: true; item: Record<string, unknown> }).item;
  const sessionId = makeSessionId(new Date(2026, 0, 1), () => 0.42);
  const dir = join(root, ".delivery", "sessions", sessionId);
  mkdirSync(dir, { recursive: true });
  const packet = buildPacket(
    asPacketArgs({
      sessionId,
      agent: "claude",
      ...(model ? { agentConfig: { model } } : {}),
      item,
      context: { campaignFiles: [], relatedNotes: [] },
      scopeHints: { keywords: ["rounding"], globs: [], modules: ["Budget"] },
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
  atomicWriteJsonSync(join(dir, "state.json"), {
    schemaVersion: 1, sessionId, state: "SELECTED", awaiting: null,
    phaseHistory: [{ state: "SELECTED", enteredAt: now, exitedAt: null }],
    agent: "claude", driver: { ref: null, specialists: {} }, workspace: packet.workspace,
    build: null, fixLoop: 0,
    usage: { perPhase: {}, total: { input: 0, cachedInput: 0, output: 0, costUsd: null } },
    decisionsProcessed: 0, messagesProcessed: 0, lastError: null, createdAt: now, updatedAt: now,
  });
  return { dir, packet };
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

function passingValidation() {
  return { ok: true, results: { typecheck: { ok: true, ms: 1, excerpt: "" }, lint: { ok: true, ms: 1, excerpt: "" }, test: { ok: true, ms: 1, excerpt: "" } } };
}

async function drive(
  dir: string,
  driver: object,
  repoRoot: string,
  opts: { takeSnapshot?: () => Record<string, unknown>; deliveryConfig?: object } = {},
) {
  let last;
  for (let i = 0; i < 50; i++) {
    const { didWork, state } = await advanceSession({
      sessionDir: dir, driver, repoRoot,
      runValidation: passingValidation,
      retryDelayMs: 0, sleep: () => {},
      takeSnapshot: opts.takeSnapshot || stableSnapshot,
      readHead: () => "fixture-shipped-head",
      deliveryConfig: opts.deliveryConfig,
    });
    last = state;
    if (!didWork) return last;
  }
  throw new Error("drive() exceeded iteration budget — likely an infinite loop");
}

const PLAN_TEXT = JSON.stringify({
  steps: [{ id: "S1", description: "do it", paths: [], validationHint: "pnpm test" }],
  testPlan: "t", riskFlags: [], rollbackSketch: "r", noNewDeps: true,
});
const PLAN_SCOPED = JSON.stringify({
  steps: [{ id: "S1", description: "do it", paths: ["src/lib/money.ts"], validationHint: "pnpm test" }],
  testPlan: "t", riskFlags: [], rollbackSketch: "r", noNewDeps: true,
});
const USAGE = { input: 1, cachedInput: 0, output: 1, costUsd: null };

function specWith(extra: object) {
  return JSON.stringify({
    problem: "p", currentBehavior: "c", proposedBehavior: "pb",
    acceptanceCriteria: [
      { id: "AC1", text: "slice one behaviour" },
      { id: "AC2", text: "slice two behaviour" },
    ],
    affectedPaths: [], riskFlags: [], openQuestions: [],
    ...extra,
  });
}
function scriptOf(...finalTexts: string[]) {
  return { turns: finalTexts.map((finalText) => ({ finalText, usage: USAGE })) };
}

const BIG_SCOPE = { files: 25, occurrences: 72, modules: 4 };
const TWO_SLICES = [
  { title: "Slice one", rationale: "smallest shippable", acceptanceCriteriaIds: ["AC1"] },
  { title: "Slice two", rationale: "the rest", acceptanceCriteriaIds: ["AC2"] },
];

// ============================================================
describe("DLV-7: scope measured at the SPEC gate", () => {
  it("stamps a matching measured scope without raising a mismatch", async () => {
    const root = setupRepo();
    const { dir } = makePacketAndState(root); // M-effort item
    const driver = createDriver("fake", { script: scriptOf(specWith({ scopeEstimate: { files: 3, occurrences: 10, modules: 2 } }), PLAN_TEXT) });

    const state = await drive(dir, driver, root);
    expect(state.state).toBe("SPEC_READY");
    expect(state.awaiting.scope.sizeClass).toBe("M");
    expect(state.awaiting.scope.mismatch).toBe(false);
    expect(state.awaiting.warnings).toBeUndefined();

    expect(JSON.parse(readFileSync(join(dir, "artifacts", "scope.json"), "utf8")).sizeClass).toBe("M");
    expect(readEvents(dir).some((e) => e.type === "scope.measured")).toBe(true);
    // Reaches the human-readable artifact, not only state.json.
    expect(readFileSync(join(dir, "artifacts", "spec.md"), "utf8")).toContain("## Measured scope");
  });

  it("raises a mismatch with the agent's decomposition when an M item measures L", async () => {
    const root = setupRepo();
    const { dir } = makePacketAndState(root);
    const driver = createDriver("fake", { script: scriptOf(specWith({ scopeEstimate: BIG_SCOPE, decomposition: TWO_SLICES }), PLAN_TEXT) });

    const state = await drive(dir, driver, root);
    expect(state.awaiting.scope.mismatch).toBe(true);
    expect(state.awaiting.scope.sizeClass).toBe("L");
    expect(state.awaiting.scope.itemSizeClass).toBe("M");
    expect(state.awaiting.scope.decomposition).toHaveLength(2);
    expect(state.awaiting.warnings[0]).toContain("25 file(s)");
    expect(readEvents(dir).some((e) => e.type === "scope.mismatch")).toBe(true);
  });

  it("narrows this session's ACs to the chosen slice and records the rest as candidates", async () => {
    const root = setupRepo();
    const { dir } = makePacketAndState(root);
    const driver = createDriver("fake", { script: scriptOf(specWith({ scopeEstimate: BIG_SCOPE, decomposition: TWO_SLICES }), PLAN_TEXT) });
    await drive(dir, driver, root);

    writeDecision(dir, 1, "spec", "approve", { scopeSlice: 1 });
    const state = await drive(dir, driver, root);

    expect(state.state).toBe("PLAN_READY");
    expect(JSON.parse(readFileSync(join(dir, "packet.json"), "utf8")).acceptanceCriteria).toEqual([
      { id: "AC1", text: "slice one behaviour" },
    ]);

    const proposal = JSON.parse(readFileSync(join(dir, "artifacts", "decomposition-proposal.json"), "utf8"));
    expect(proposal.selected).toMatchObject({ index: 1, title: "Slice one" });
    expect(proposal.deferred).toHaveLength(1);
    expect(proposal.deferred[0].title).toBe("Slice two");
    // The full list survives the narrowing, so nothing is lost by slicing.
    expect(proposal.fullAcceptanceCriteria).toHaveLength(2);
    expect(readEvents(dir).some((e) => e.type === "scope.decomposed")).toBe(true);

    const scope = JSON.parse(readFileSync(join(dir, "artifacts", "scope.json"), "utf8"));
    expect(scope.acknowledged).toBe(true);
    expect(scope.selectedSlice).toMatchObject({ index: 1 });
  });

  it("keeps the full AC list when the owner acknowledges the mismatch instead", async () => {
    const root = setupRepo();
    const { dir } = makePacketAndState(root);
    const driver = createDriver("fake", { script: scriptOf(specWith({ scopeEstimate: BIG_SCOPE, decomposition: TWO_SLICES }), PLAN_TEXT) });
    await drive(dir, driver, root);

    writeDecision(dir, 1, "spec", "approve", { scopeAck: "FULL SCOPE" });
    const state = await drive(dir, driver, root);

    expect(state.state).toBe("PLAN_READY");
    expect(JSON.parse(readFileSync(join(dir, "packet.json"), "utf8")).acceptanceCriteria).toHaveLength(2);
    expect(existsSync(join(dir, "artifacts", "decomposition-proposal.json"))).toBe(false);
    expect(readEvents(dir).some((e) => e.type === "scope.mismatch.acknowledged")).toBe(true);
  });

  it("blocks on a malformed scopeEstimate rather than reading it as zero", async () => {
    const root = setupRepo();
    const { dir } = makePacketAndState(root);
    const driver = createDriver("fake", { script: scriptOf(specWith({ scopeEstimate: { files: "lots" } })) });

    const state = await drive(dir, driver, root);
    expect(state.state).toBe("BLOCKED");
    expect(state.lastError.message).toContain("scopeEstimate");
  });

  it("degrades to 'not reported' — never a fabricated zero — when the spec omits the estimate", async () => {
    // Every pre-DLV-7 spec and every legacy fixture is this shape.
    const root = setupRepo();
    const { dir } = makePacketAndState(root);
    const driver = createDriver("fake", { script: scriptOf(specWith({}), PLAN_TEXT) });

    const state = await drive(dir, driver, root);
    expect(state.state).toBe("SPEC_READY");
    expect(state.awaiting).toEqual({ gate: "spec" });
    expect(state.scope.sizeClass).toBeNull();
    expect(state.scope.mismatch).toBe(false);
  });

  it("honours owner-tightened thresholds from .delivery/config.json", async () => {
    const root = setupRepo();
    const { dir } = makePacketAndState(root, { effort: "S" });
    const driver = createDriver("fake", { script: scriptOf(specWith({ scopeEstimate: { files: 2, occurrences: 2, modules: 1 } }), PLAN_TEXT) });

    // Default thresholds would call 2/2/1 an S — matching the S item. Tightened
    // to 1 file, the same measurement becomes M and trips the gate.
    const state = await drive(dir, driver, root, {
      deliveryConfig: { scope: { thresholds: { S: { files: 1, occurrences: 1, modules: 1 }, M: { files: 4, occurrences: 4, modules: 2 } } } },
    });
    expect(state.awaiting.scope.sizeClass).toBe("M");
    expect(state.awaiting.scope.mismatch).toBe(true);
  });
});

// ============================================================
describe("DLV-7: post-PLAN scope lock", () => {
  async function driveToBuilding(root: string, dir: string, driver: object, buildTurns: string[] = [], takeSnapshot?: () => Record<string, unknown>) {
    void buildTurns;
    await drive(dir, driver, root);
    writeDecision(dir, 1, "spec", "approve");
    await drive(dir, driver, root);
    writeDecision(dir, 2, "plan", "approve");
    return drive(dir, driver, root, { takeSnapshot });
  }

  it("freezes the approved plan's declared paths and AC ids onto state", async () => {
    const root = setupRepo();
    const { dir } = makePacketAndState(root);
    const driver = createDriver("fake", { script: scriptOf(specWith({}), PLAN_SCOPED) });

    const state = await driveToBuilding(root, dir, driver);
    expect(state.scopeLock.paths).toEqual(["src/lib/money.ts"]);
    expect(state.scopeLock.acceptanceCriteriaIds).toEqual(["AC1", "AC2"]);
    expect(state.scopeLock.stepIds).toEqual(["S1"]);
    expect(readEvents(dir).some((e) => e.type === "scope.locked")).toBe(true);
  });

  it("turns a write outside the locked scope into an owner decision, not a silent sprawl", async () => {
    const root = setupRepo();
    const { dir } = makePacketAndState(root);
    const driver = createDriver("fake", { script: scriptOf(specWith({}), PLAN_SCOPED, "edited something else entirely") });

    const state = await driveToBuilding(root, dir, driver, [], snapshotWith(["src/components/Elsewhere.tsx"]));

    expect(state.state).toBe("NEEDS_DECISION");
    expect(state.awaiting.reason).toBe("scope-expanded");
    expect(state.awaiting.returnTo).toBe("BUILDING");
    expect(state.awaiting.questions[0].text).toContain("src/components/Elsewhere.tsx");
    const expanded = readEvents(dir).find((e) => e.type === "scope.expanded");
    expect((expanded as { data: { outside: string[] } }).data.outside).toEqual(["src/components/Elsewhere.tsx"]);
  });

  it("lets a write INSIDE the locked scope through untouched", async () => {
    const root = setupRepo();
    const { dir } = makePacketAndState(root);
    const driver = createDriver("fake", { script: scriptOf(specWith({}), PLAN_SCOPED, "edited the planned file") });

    const state = await driveToBuilding(root, dir, driver, [], snapshotWith(["src/lib/money.ts"]));
    // Deliberately asserting the *absence of the scope stop*, not a specific
    // end state: this fixture's script runs out of turns at REVIEWING, which
    // DLV-4 escalates to NEEDS_DECISION for its own unrelated reason. Pinning
    // a state name here would make the test pass or fail on that instead.
    expect(state.awaiting?.reason).not.toBe("scope-expanded");
    expect(readEvents(dir).some((e) => e.type === "scope.expanded")).toBe(false);
  });
});

// ============================================================
describe("DLV-10: AC coverage matrix gates UAT_READY", () => {
  const PASS_REVIEW = JSON.stringify({ verdict: "PASS", findings: [] });
  const uatClaiming = (claims: object[]) =>
    JSON.stringify({
      summary: "done", acceptanceCriteria: claims,
      manualSteps: [{ action: "a", expected: "e" }], deviations: [], followUps: [],
    });

  /**
   * `buildSnapshot` is applied only to the final drive — the one that runs
   * BUILDING. Handing a "files are modified" snapshot to the read-only
   * DISCOVERY and PLAN turns would trip the git guard and block the session
   * before any of this is reached.
   */
  async function driveToUat(dir: string, root: string, driver: object, buildSnapshot?: () => Record<string, unknown>) {
    await drive(dir, driver, root);
    writeDecision(dir, 1, "spec", "approve");
    await drive(dir, driver, root);
    writeDecision(dir, 2, "plan", "approve");
    return drive(dir, driver, root, { takeSnapshot: buildSnapshot });
  }

  it("seeds every AC as unmet at spec approval", async () => {
    const root = setupRepo();
    const { dir } = makePacketAndState(root);
    const driver = createDriver("fake", { script: scriptOf(specWith({}), PLAN_TEXT) });
    await drive(dir, driver, root);
    writeDecision(dir, 1, "spec", "approve");
    const state = await drive(dir, driver, root);

    expect(state.acceptance).toHaveLength(2);
    expect(state.acceptance.every((r: { status: string }) => r.status === "unmet")).toBe(true);
    expect(existsSync(join(dir, "artifacts", "acceptance.md"))).toBe(true);
  });

  it("confirms a claim whose evidence is a file this session actually changed", async () => {
    const root = setupRepo();
    const { dir } = makePacketAndState(root);
    const driver = createDriver("fake", {
      script: scriptOf(
        specWith({}), PLAN_SCOPED, "built it", PASS_REVIEW,
        uatClaiming([
          { id: "AC1", status: "met", evidence: "src/lib/money.ts" },
          { id: "AC2", status: "met", evidence: "test" },
        ]),
      ),
    });

    const state = await driveToUat(dir, root, driver, snapshotWith(["src/lib/money.ts"]));
    expect(state.state).toBe("UAT_READY");
    expect(state.awaiting.acceptance).toEqual({ total: 2, met: 2, waived: 0, unmet: 0, failed: 0 });
    const matrix = JSON.parse(readFileSync(join(dir, "artifacts", "acceptance.json"), "utf8"));
    expect(matrix.find((r: { id: string }) => r.id === "AC1").evidenceKind).toBe("diff");
    expect(matrix.find((r: { id: string }) => r.id === "AC2").evidenceKind).toBe("validation");
  });

  it("refuses UAT_READY when a claim cannot be evidenced, and says which", async () => {
    const root = setupRepo();
    const { dir } = makePacketAndState(root);
    const driver = createDriver("fake", {
      script: scriptOf(
        specWith({}), PLAN_SCOPED, "built it", PASS_REVIEW,
        uatClaiming([
          { id: "AC1", status: "met", evidence: "src/lib/money.ts" },
          { id: "AC2", status: "met", evidence: "I checked it by hand" },
        ]),
      ),
    });

    const state = await driveToUat(dir, root, driver, snapshotWith(["src/lib/money.ts"]));
    expect(state.state).toBe("NEEDS_DECISION");
    expect(state.awaiting.reason).toBe("acceptance-incomplete");
    expect(state.awaiting.unsatisfiedAcceptance).toEqual(["AC2"]);
    expect(state.awaiting.questions[0].text).toContain("AC2");

    const rejected = readEvents(dir).find((e) => e.type === "acceptance.claim.rejected");
    expect(rejected).toBeTruthy();
    expect((rejected as { data: { id: string } }).data.id).toBe("AC2");
    expect(readEvents(dir).some((e) => e.type === "acceptance.incomplete")).toBe(true);
  });

  it("an audited waiver resumes at UAT_READY without re-running the paid turns", async () => {
    const root = setupRepo();
    const { dir } = makePacketAndState(root);
    // Deliberately NO extra scripted turns after UAT: if the waiver returned to
    // REVIEWING it would need a fresh review turn AND a fresh UAT turn, the fake
    // driver would run out of script, and this test would fail.
    const driver = createDriver("fake", {
      script: scriptOf(
        specWith({}), PLAN_SCOPED, "built it", PASS_REVIEW,
        uatClaiming([
          { id: "AC1", status: "met", evidence: "src/lib/money.ts" },
          { id: "AC2", status: "unmet" },
        ]),
      ),
    });
    await driveToUat(dir, root, driver, snapshotWith(["src/lib/money.ts"]));

    writeDecision(dir, 3, "question", "answer", { answer: "waive — AC2 is deferred to the follow-up item" });
    const state = await drive(dir, driver, root, { takeSnapshot: snapshotWith(["src/lib/money.ts"]) });

    expect(state.state).toBe("UAT_READY");
    expect(state.awaiting.gate).toBe("uat");
    const matrix = JSON.parse(readFileSync(join(dir, "artifacts", "acceptance.json"), "utf8"));
    const ac2 = matrix.find((r: { id: string }) => r.id === "AC2");
    expect(ac2.status).toBe("waived");
    expect(ac2.updatedBy).toBe("owner");
    expect(readEvents(dir).some((e) => e.type === "acceptance.waived")).toBe(true);
  });

  it("any answer other than 'waive' sends the session back to finish the work", async () => {
    const root = setupRepo();
    const { dir } = makePacketAndState(root);
    const driver = createDriver("fake", {
      script: scriptOf(
        specWith({}), PLAN_SCOPED, "built it", PASS_REVIEW,
        uatClaiming([{ id: "AC1", status: "met", evidence: "src/lib/money.ts" }, { id: "AC2", status: "unmet" }]),
        "second review", PASS_REVIEW,
      ),
    });
    await driveToUat(dir, root, driver, snapshotWith(["src/lib/money.ts"]));

    writeDecision(dir, 3, "question", "answer", { answer: "No — please finish AC2 properly." });
    const state = await drive(dir, driver, root, { takeSnapshot: snapshotWith(["src/lib/money.ts"]) });

    expect(state.state).not.toBe("UAT_READY");
    const matrix = JSON.parse(readFileSync(join(dir, "artifacts", "acceptance.json"), "utf8"));
    expect(matrix.find((r: { id: string }) => r.id === "AC2").status).toBe("unmet");
  });
});

// ============================================================
describe("DLV-9: model-fit guard re-run against measured scope", () => {
  // A catalog is required for a tier comparison to mean anything — an
  // uncatalogued model has no tier, and the guard correctly says nothing.
  const CONFIG_WITH_CATALOG = {
    providers: {
      claude: {
        defaultModel: "haiku-x",
        efforts: ["low", "medium", "high", "xhigh", "max"],
        models: [
          { id: "haiku-x", tier: "economy" },
          { id: "sonnet-x", tier: "standard" },
          { id: "opus-x", tier: "premium" },
        ],
      },
      codex: { defaultModel: null, efforts: ["low", "medium", "high"], models: [] },
    },
  };

  it("warns when an economy model meets a measured L scope — the BUD-11 shape", async () => {
    const root = setupRepo();
    const { dir } = makePacketAndState(root, { effort: "S", model: "haiku-x" });
    const driver = createDriver("fake", { script: scriptOf(specWith({ scopeEstimate: BIG_SCOPE, decomposition: TWO_SLICES }), PLAN_TEXT) });

    const state = await drive(dir, driver, root, { deliveryConfig: CONFIG_WITH_CATALOG });
    expect(state.awaiting.scope.fit.mismatch).toBe(true);
    expect(state.awaiting.scope.fit.currentTier).toBe("economy");
    expect(state.awaiting.scope.fit.recommendedTier).toBe("premium");
    expect(state.awaiting.scope.fit.recommendedModel).toBe("opus-x");
    expect(state.awaiting.warnings.some((w: string) => w.includes("opus-x"))).toBe(true);
    expect(readEvents(dir).some((e) => e.type === "recommendation.updated")).toBe(true);
  });

  it("stays silent when the running model already matches the measured scope", async () => {
    const root = setupRepo();
    const { dir } = makePacketAndState(root, { effort: "S", model: "opus-x" });
    const driver = createDriver("fake", { script: scriptOf(specWith({ scopeEstimate: BIG_SCOPE, decomposition: TWO_SLICES }), PLAN_TEXT) });

    const state = await drive(dir, driver, root, { deliveryConfig: CONFIG_WITH_CATALOG });
    expect(state.awaiting.scope.fit.mismatch).toBe(false);
    // The scope mismatch is still reported — the two guards are independent.
    expect(state.awaiting.scope.mismatch).toBe(true);
    expect(state.awaiting.warnings.every((w: string) => !w.includes("tier"))).toBe(true);
  });

  it("says nothing at all when the model is not in the owner's catalog", async () => {
    const root = setupRepo();
    const { dir } = makePacketAndState(root, { effort: "S", model: "some-unlisted-model" });
    const driver = createDriver("fake", { script: scriptOf(specWith({ scopeEstimate: BIG_SCOPE, decomposition: TWO_SLICES }), PLAN_TEXT) });

    const state = await drive(dir, driver, root, { deliveryConfig: CONFIG_WITH_CATALOG });
    expect(state.awaiting.scope.fit.mismatch).toBe(false);
    expect(state.awaiting.scope.fit.currentTier).toBeNull();
  });

  it("records the acknowledgment when the owner approves the spec through the warning", async () => {
    const root = setupRepo();
    const { dir } = makePacketAndState(root, { effort: "S", model: "haiku-x" });
    const driver = createDriver("fake", { script: scriptOf(specWith({ scopeEstimate: BIG_SCOPE, decomposition: TWO_SLICES }), PLAN_TEXT) });
    await drive(dir, driver, root, { deliveryConfig: CONFIG_WITH_CATALOG });

    writeDecision(dir, 1, "spec", "approve", { scopeAck: "FULL SCOPE" });
    await drive(dir, driver, root, { deliveryConfig: CONFIG_WITH_CATALOG });

    expect(readEvents(dir).some((e) => e.type === "recommendation.acknowledged")).toBe(true);
    expect(JSON.parse(readFileSync(join(dir, "artifacts", "scope.json"), "utf8")).fitAcknowledgedAt).toBeTruthy();
  });
});
