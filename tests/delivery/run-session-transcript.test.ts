// DW-1 acceptance tests: full-fidelity transcript capture + v2 usage/cost,
// layered on top of run-session.mjs's existing state-machine harness. Mirrors
// the fixture pattern in run-session.test.ts rather than importing its
// private helpers (that file exports none).
import { existsSync, mkdirSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { afterEach, describe, expect, it } from "vitest";

import { createDriver } from "../../scripts/delivery/drivers/driver.mjs";
import "../../scripts/delivery/drivers/fake.mjs";
import { atomicWriteJsonSync } from "../../scripts/delivery/fsx.mjs";
import { buildItemIdentity, buildPacket, makeSessionId } from "../../scripts/delivery/packet.mjs";
import { parseTurnRecords, parseTurns } from "../../scripts/delivery/transcript.mjs";

type BuildPacketArgs = Parameters<typeof buildPacket>[0];
function asPacketArgs(partial: object): BuildPacketArgs {
  return partial as unknown as BuildPacketArgs;
}

import { advanceSession, reconcileCrashedTurns } from "../../scripts/delivery/run-session.mjs";

const cleanupDirs: string[] = [];
afterEach(() => {
  while (cleanupDirs.length) {
    const dir = cleanupDirs.pop();
    if (dir) rmSync(dir, { recursive: true, force: true });
  }
});

function setupRepo(): string {
  const root = mkdtempSync(join(tmpdir(), "delivery-transcript-"));
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

function makePacketAndState(root: string, { model = "claude-sonnet-5" }: { model?: string } = {}) {
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
      agentConfig: { model, effort: { discovery: "medium", plan: "high", building: "high", review: "medium" } },
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

async function advanceOnce(dir: string, driver: object, repoRoot: string, deliveryConfig?: object) {
  return advanceSession({
    sessionDir: dir,
    driver,
    repoRoot,
    retryDelayMs: 0,
    sleep: () => {},
    takeSnapshot: stableSnapshot,
    readHead: () => "fixture-shipped-head",
    deliveryConfig,
  });
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

describe("DW-1: transcript capture during DISCOVERY", () => {
  it("writes the prompt file, a record shard with the prompt boundary + raw records, and a turns.ndjson entry", async () => {
    const root = setupRepo();
    const { dir } = makePacketAndState(root);
    const rawRecords = [
      { kind: "assistant.text", text: "thinking about the spec" },
      { kind: "tool.use", tool: "Read", input: { path: "foo.md" } },
    ];
    const driver = createDriver("fake", {
      script: {
        turns: [
          {
            finalText: SPEC_TEXT,
            usage: { input: 100, cachedInput: 10, output: 40, costUsd: 0.03 },
            usageV2: { input: 100, cachedRead: 10, cacheCreation: 5, output: 40, reasoningOutput: 0 },
            rawRecords,
          },
        ],
      },
    });

    await advanceOnce(dir, driver, root); // SELECTED -> DISCOVERY
    const result = await advanceOnce(dir, driver, root); // DISCOVERY turn

    expect(result.state.state).toBe("SPEC_READY");
    expect(result.state.turnCounter).toBe(1);

    const promptPath = join(dir, "transcript", "prompts", "0001.md");
    expect(existsSync(promptPath)).toBe(true);
    expect(readFileSync(promptPath, "utf8").length).toBeGreaterThan(0);

    const shardPath = join(dir, "transcript", "t-0001.ndjson");
    const records = parseTurnRecords(readFileSync(shardPath, "utf8"));
    expect(records).toHaveLength(3); // 1 prompt-boundary + 2 rawRecords
    expect(records[0].kind).toBe("prompt");
    expect(records[0].promptFile).toBe("transcript/prompts/0001.md");
    expect(records[1]).toMatchObject({ kind: "assistant.text", text: "thinking about the spec" });
    expect(records[2]).toMatchObject({ kind: "tool.use", tool: "Read" });
    // seq is monotonic within the shard
    expect(records.map((r: { seq: number }) => r.seq)).toEqual([1, 2, 3]);

    const turnsPath = join(dir, "transcript", "turns.ndjson");
    const turns = parseTurns(readFileSync(turnsPath, "utf8"));
    expect(turns).toHaveLength(1);
    const turn = turns[0];
    expect(turn.turnId).toBe("0001");
    expect(turn.phase).toBe("DISCOVERY");
    expect(turn.provider).toBe("claude");
    expect(turn.model).toBe("claude-sonnet-5");
    expect(turn.effort).toBe("medium");
    expect(turn.result).toBe("ok");
    expect(turn.strategy).toBe("start"); // no driver ref existed before this turn
    expect(turn.records).toBe(3);
    expect(turn.usage).toEqual({ input: 100, cachedRead: 10, cacheCreation: 5, output: 40, reasoningOutput: 0 });
    expect(turn.context.occupancyTokens).toBe(115); // input + cachedRead + cacheCreation
    expect(typeof turn.durationMs).toBe("number");
  });

  it("falls back to a v2-shaped usage record when the driver only reports v1 usage", async () => {
    const root = setupRepo();
    const { dir } = makePacketAndState(root);
    const driver = createDriver("fake", {
      script: { turns: [{ finalText: SPEC_TEXT, usage: { input: 50, cachedInput: 5, output: 20, costUsd: null } }] },
    });

    await advanceOnce(dir, driver, root);
    await advanceOnce(dir, driver, root);

    const turns = parseTurns(readFileSync(join(dir, "transcript", "turns.ndjson"), "utf8"));
    expect(turns[0].usage).toEqual({ input: 50, cachedRead: 5, cacheCreation: 0, output: 20, reasoningOutput: 0 });
  });

  it("computes costEstUsd from .delivery/config.json-shaped pricing when supplied", async () => {
    const root = setupRepo();
    const { dir } = makePacketAndState(root);
    const driver = createDriver("fake", {
      script: {
        turns: [
          { finalText: SPEC_TEXT, usage: { input: 1_000_000, cachedRead: 0, cacheCreation: 0, output: 1_000_000, reasoningOutput: 0 } },
        ],
      },
    });
    const deliveryConfig = {
      providers: {
        claude: {
          defaultModel: "claude-sonnet-5",
          efforts: ["low", "medium", "high", "xhigh", "max"],
          models: [
            { id: "claude-sonnet-5", pricing: { inPerMTok: 1, cachedReadPerMTok: 0.1, cacheWritePerMTok: 1.25, outPerMTok: 5 } },
          ],
        },
      },
    };

    await advanceOnce(dir, driver, root, deliveryConfig);
    await advanceOnce(dir, driver, root, deliveryConfig);

    const turns = parseTurns(readFileSync(join(dir, "transcript", "turns.ndjson"), "utf8"));
    expect(turns[0].costEstUsd).toBeCloseTo(1 + 5, 6); // 1M input @ $1/MTok + 1M output @ $5/MTok
  });
});

describe("DW-1: turnId increments across turns and strategy reflects resume", () => {
  it("second turn (PLAN) gets turnId 0002 and strategy resume-native", async () => {
    const root = setupRepo();
    const { dir } = makePacketAndState(root);
    const driver = createDriver("fake", {
      script: { turns: [{ finalText: SPEC_TEXT, usage: { input: 1, cachedRead: 0, cacheCreation: 0, output: 1, reasoningOutput: 0 } }, { finalText: PLAN_TEXT, usage: { input: 1, cachedRead: 0, cacheCreation: 0, output: 1, reasoningOutput: 0 } }] },
    });

    await advanceOnce(dir, driver, root); // SELECTED -> DISCOVERY
    await advanceOnce(dir, driver, root); // DISCOVERY turn -> SPEC_READY

    const decisionsDir = join(dir, "decisions");
    mkdirSync(decisionsDir, { recursive: true });
    atomicWriteJsonSync(join(decisionsDir, "0001-spec.json"), {
      seq: 1, gate: "spec", decision: "approve", note: null, confirmText: null, tickCheckbox: true, answer: null,
      capabilitiesDrop: null, at: new Date().toISOString(),
    });
    const result = await advanceOnce(dir, driver, root); // consumes spec decision -> runs PLAN turn

    expect(result.state.state).toBe("PLAN_READY");
    expect(result.state.turnCounter).toBe(2);

    const turns = parseTurns(readFileSync(join(dir, "transcript", "turns.ndjson"), "utf8"));
    expect(turns).toHaveLength(2);
    expect(turns[1].turnId).toBe("0002");
    expect(turns[1].phase).toBe("PLAN");
    expect(turns[1].strategy).toBe("resume-native"); // a driver ref was already established by turn 1
  });
});

describe("DW-1: crash-turn reconciliation", () => {
  it("seals an orphaned turn (prompt written, no closing turns.ndjson entry) as result:crashed", async () => {
    const root = setupRepo();
    const { dir } = makePacketAndState(root);
    // Simulate a runner that crashed mid-turn: wrote the prompt file but never
    // appended the closing turns.ndjson entry.
    mkdirSync(join(dir, "transcript", "prompts"), { recursive: true });
    writeFileSync(join(dir, "transcript", "prompts", "0001.md"), "assembled prompt text");
    writeFileSync(join(dir, "transcript", "t-0001.ndjson"), "");

    const sealed = reconcileCrashedTurns(dir);
    expect(sealed).toEqual(["0001"]);

    const turns = parseTurns(readFileSync(join(dir, "transcript", "turns.ndjson"), "utf8"));
    expect(turns).toHaveLength(1);
    expect(turns[0].turnId).toBe("0001");
    expect(turns[0].result).toBe("crashed");
    expect(turns[0].usage).toBeNull();
  });

  it("is a no-op when transcript/ doesn't exist (pre-DW-1 sessions)", async () => {
    const root = setupRepo();
    const { dir } = makePacketAndState(root);
    expect(reconcileCrashedTurns(dir)).toEqual([]);
    expect(existsSync(join(dir, "transcript"))).toBe(false);
  });

  it("is a no-op when every turn closed cleanly", async () => {
    const root = setupRepo();
    const { dir } = makePacketAndState(root);
    const driver = createDriver("fake", {
      script: { turns: [{ finalText: SPEC_TEXT, usage: { input: 1, cachedRead: 0, cacheCreation: 0, output: 1, reasoningOutput: 0 } }] },
    });
    await advanceOnce(dir, driver, root);
    await advanceOnce(dir, driver, root);
    expect(reconcileCrashedTurns(dir)).toEqual([]);
  });
});

describe("DW-1: v1 session back-compat", () => {
  it("a session with no .delivery/config.json still runs and defaults maxRecordBytes/pricing sanely", async () => {
    const root = setupRepo();
    const { dir } = makePacketAndState(root, { model: "unknown-model-not-in-any-catalog" });
    const driver = createDriver("fake", {
      script: { turns: [{ finalText: SPEC_TEXT, usage: { input: 1, cachedRead: 0, cacheCreation: 0, output: 1, reasoningOutput: 0 } }] },
    });
    await advanceOnce(dir, driver, root); // no deliveryConfig passed at all
    const result = await advanceOnce(dir, driver, root);
    expect(result.state.state).toBe("SPEC_READY");
    const turns = parseTurns(readFileSync(join(dir, "transcript", "turns.ndjson"), "utf8"));
    expect(turns[0].costEstUsd).toBeNull(); // no pricing catalog available -> no fabricated cost
  });
});
