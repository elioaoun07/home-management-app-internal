// DLV-18: the failure-injection scenario suite.
//
// The M1/M3 governance behaviours all exist to make specific real failures
// impossible, and every one of those failures happened at least once in
// BUD-11's forensics. This file drives each of them deliberately, on the fake
// driver, and asserts the session ends up somewhere an owner can recover from —
// never dead, never silently continuing, never lying about what happened.
//
// Scenarios: quota-hit · budget cap-hit · config corruption · retry storm ·
// provider unreachable · crash recovery · finish package on every exit.
import { existsSync, mkdirSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { afterEach, describe, expect, it } from "vitest";

import { createDriver } from "../../scripts/delivery/drivers/driver.mjs";
import { createFakeDriver } from "../../scripts/delivery/drivers/fake.mjs";
import { atomicWriteJsonSync } from "../../scripts/delivery/fsx.mjs";
import { buildItemIdentity, buildPacket, makeSessionId } from "../../scripts/delivery/packet.mjs";
import { advanceSession, reconcileCrashedTurns } from "../../scripts/delivery/run-session.mjs";
import { loadConfig, getConfigStatus } from "../../scripts/delivery/config.mjs";

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
  const root = mkdtempSync(join(tmpdir(), "delivery-failure-"));
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

function makeSession(root: string, { budget = null as Record<string, unknown> | null } = {}) {
  const raw = ["# Now", "", "- [ ] **N1** Fix rounding drift _(blocker - M)_", ""].join("\n");
  const idResult = buildItemIdentity(raw, 0, "Budget/4 - Checklist.md");
  if (!idResult.ok) throw new Error("fixture setup failed");
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
      budget,
    }),
  );
  atomicWriteJsonSync(join(dir, "packet.json"), packet);
  const now = new Date().toISOString();
  atomicWriteJsonSync(join(dir, "state.json"), {
    schemaVersion: 1, sessionId, state: "SELECTED", awaiting: null,
    phaseHistory: [{ state: "SELECTED", enteredAt: now, exitedAt: null }],
    agent: "claude", driver: { ref: null, specialists: {} }, workspace: packet.workspace,
    build: null, fixLoop: 0,
    usage: { perPhase: {}, total: { input: 0, cachedRead: 0, cacheCreation: 0, output: 0, costUsd: null } },
    ...(budget ? { budget: { current: budget, warned: [], exhaustedAt: null } } : {}),
    decisionsProcessed: 0, messagesProcessed: 0, lastError: null, createdAt: now, updatedAt: now,
  });
  return { dir, sessionId };
}

function readEvents(dir: string): Array<Record<string, unknown>> {
  if (!existsSync(join(dir, "events.ndjson"))) return [];
  return readFileSync(join(dir, "events.ndjson"), "utf8").trim().split("\n").filter(Boolean).map((l) => JSON.parse(l));
}

function passingValidation() {
  return { ok: true, results: { typecheck: { ok: true, ms: 1, excerpt: "" }, lint: { ok: true, ms: 1, excerpt: "" }, test: { ok: true, ms: 1, excerpt: "" } } };
}

async function drive(dir: string, driver: object, repoRoot: string, opts: { deliveryConfig?: object } = {}) {
  let last;
  for (let i = 0; i < 60; i++) {
    const { didWork, state } = await advanceSession({
      sessionDir: dir, driver, repoRoot, runValidation: passingValidation,
      retryDelayMs: 0, sleep: () => {}, takeSnapshot: stableSnapshot, readHead: () => "fixture-head",
      deliveryConfig: opts.deliveryConfig,
    });
    last = state;
    if (!didWork) return last;
  }
  throw new Error("drive() exceeded iteration budget");
}

const SPEC_TEXT = JSON.stringify({
  problem: "p", currentBehavior: "c", proposedBehavior: "pb",
  acceptanceCriteria: [{ id: "AC1", text: "works" }],
  affectedPaths: [], riskFlags: [], openQuestions: [],
});
const BIG_USAGE = { input: 10, cachedRead: 400_000, cacheCreation: 200_000, output: 10, costUsd: 5 };

/** Every recoverable stop must leave the owner something to act on. */
function expectRecoverable(state: Record<string, never>) {
  const s = state as unknown as { state: string; awaiting: Record<string, unknown> | null };
  expect(["BLOCKED", "NEEDS_DECISION"]).toContain(s.state);
  expect(s.awaiting).not.toBeNull();
}

// ============================================================
describe("DLV-18 scenario: provider quota exhausted", () => {
  it("stops immediately without burning a single retry, and says why", async () => {
    const root = setupRepo();
    const { dir } = makeSession(root);
    // The exact string shape that went unmatched in BUD-11 and was therefore
    // retried into a dead session (DLV-4).
    const driver = createDriver("fake", {
      script: { turns: [{ throws: "You've hit your monthly spend limit for Claude" }] },
    });

    const state = await drive(dir, driver, root);

    expectRecoverable(state);
    expect((state as unknown as { awaiting: { reason?: string } }).awaiting.reason).toBe("quota-paused");
    expect((state as unknown as { lastError: { errorKind: string } }).lastError.errorKind).toBe("quota");
    // Zero retries: a spend limit does not get better by asking again.
    expect(readEvents(dir).filter((e) => e.type === "retry.attempt").length).toBe(0);
    expect(existsSync(join(dir, "artifacts", "finish", "summary.md"))).toBe(true);
  });
});

describe("DLV-18 scenario: budget cap hit", () => {
  it("pauses gracefully at the boundary with a finish package, never mid-turn", async () => {
    const root = setupRepo();
    const { dir } = makeSession(root, { budget: { maxUsd: 1, maxTokens: 100_000, warnPct: 0.8 } });
    const driver = createDriver("fake", { script: { turns: [{ finalText: SPEC_TEXT, usage: BIG_USAGE, usageV2: BIG_USAGE }] } });

    const state = await drive(dir, driver, root);

    const s = state as unknown as { awaiting: { gate: string; reason: string; priorAwaiting: unknown }; execution: { paused: boolean } };
    expect(s.awaiting.gate).toBe("budget");
    expect(s.awaiting.reason).toBe("budget-exhausted");
    expect(s.execution.paused).toBe(true);
    // DLV-29: the phase gate underneath is preserved, not clobbered.
    expect(s.awaiting.priorAwaiting).toMatchObject({ gate: "spec" });
    // The completed turn's artifacts survive the pause.
    expect(existsSync(join(dir, "artifacts", "spec.md"))).toBe(true);
    expect(existsSync(join(dir, "artifacts", "finish", "budget.json"))).toBe(true);
    expect(existsSync(join(dir, "artifacts", "finish", "remaining-work.json"))).toBe(true);
    expect(readEvents(dir).some((e) => e.type === "budget.exhausted")).toBe(true);
  });
});

describe("DLV-18 scenario: corrupted .delivery/config.json", () => {
  it("falls back to safe config, records the fault, and keeps working", async () => {
    const root = setupRepo();
    mkdirSync(join(root, ".delivery"), { recursive: true });
    writeFileSync(join(root, ".delivery", "config.json"), "{ not valid json at all");
    const { dir } = makeSession(root);
    const driver = createDriver("fake", { script: { turns: [{ finalText: SPEC_TEXT, usage: { input: 1, cachedRead: 0, cacheCreation: 0, output: 1 } }] } });

    // loadConfig itself degrades rather than throwing...
    const config = loadConfig(root);
    expect(getConfigStatus(config).healthy).toBe(false);
    expect(config.budgets.maxSessionTokens).toBeGreaterThan(0);

    // ...and the session survives it, reaching its gate normally.
    const state = await drive(dir, driver, root);
    expect((state as unknown as { state: string }).state).toBe("SPEC_READY");
    const invalid = readEvents(dir).filter((e) => e.type === "config-invalid");
    expect(invalid.length).toBe(1); // recorded once, not on every tick
  });
});

describe("DLV-18 scenario: retry storm", () => {
  it("escalates to an owner decision after the configured retry limit, not forever", async () => {
    const root = setupRepo();
    const { dir } = makeSession(root);
    // Driver-level: every turn fails identically, so this fixture cannot
    // accidentally become a script-exhaustion test if maxAutoRetries changes.
    const driver = createFakeDriver({ throwsEvery: "transient upstream hiccup" });

    const state = await drive(dir, driver, root, { deliveryConfig: { errors: { maxAutoRetries: 2 } } });

    const s = state as unknown as { state: string; awaiting: { gate: string; reason: string; questions: { text: string }[] } };
    expect(s.state).toBe("NEEDS_DECISION");
    expect(s.awaiting.reason).toBe("retry-exhausted");
    expect(s.awaiting.questions[0].text).toMatch(/retries are exhausted/i);
    // Exactly one notification for the one state change (DLV-16's contract).
    expect(readEvents(dir).filter((e) => e.type === "notification.requested").length).toBe(1);
    expect(existsSync(join(dir, "artifacts", "finish", "summary.md"))).toBe(true);
  });
});

describe("DLV-18 scenario: provider unreachable at session setup", () => {
  it("blocks with the setup error visible instead of crashing the runner", async () => {
    const root = setupRepo();
    const { dir } = makeSession(root);
    const driver = createFakeDriver({ failStartSession: "authentication preflight failed — no credentials" });

    const state = await drive(dir, driver, root);

    expectRecoverable(state);
    expect((state as unknown as { lastError: { message: string } }).lastError.message).toMatch(/preflight failed/);
  });
});

describe("DLV-18 scenario: crash recovery", () => {
  it("seals turns that were allocated but never closed, so the transcript has no silent holes", async () => {
    const root = setupRepo();
    const { dir } = makeSession(root);
    // A prompt written with no matching closed turn is exactly what a runner
    // killed mid-turn leaves behind.
    mkdirSync(join(dir, "transcript", "prompts"), { recursive: true });
    writeFileSync(join(dir, "transcript", "prompts", "0001.md"), "an interrupted turn's prompt");

    const sealed = reconcileCrashedTurns(dir);

    expect(sealed).toEqual(["0001"]);
    const turns = readFileSync(join(dir, "transcript", "turns.ndjson"), "utf8").trim().split("\n").map((l) => JSON.parse(l));
    expect(turns[0]).toMatchObject({ turnId: "0001", result: "crashed" });
  });

  it("is idempotent — a second reconciliation seals nothing new", async () => {
    const root = setupRepo();
    const { dir } = makeSession(root);
    mkdirSync(join(dir, "transcript", "prompts"), { recursive: true });
    writeFileSync(join(dir, "transcript", "prompts", "0001.md"), "prompt");

    expect(reconcileCrashedTurns(dir)).toEqual(["0001"]);
    expect(reconcileCrashedTurns(dir)).toEqual([]);
  });
});

describe("DLV-18: every recoverable exit leaves a finish package", () => {
  // DLV-12's whole claim is exhaustiveness. This asserts it across the failure
  // shapes above rather than trusting that each call site was wired.
  const cases: Array<[string, () => object]> = [
    ["quota", () => createDriver("fake", { script: { turns: [{ throws: "monthly spend limit reached" }] } })],
    ["retry storm", () => createFakeDriver({ throwsEvery: "transient failure" })],
    ["setup failure", () => createFakeDriver({ failStartSession: "provider unreachable" })],
  ];

  for (const [label, makeDriver] of cases) {
    it(`writes artifacts/finish/ for the ${label} exit`, async () => {
      const root = setupRepo();
      const { dir } = makeSession(root);
      await drive(dir, makeDriver(), root, { deliveryConfig: { errors: { maxAutoRetries: 1 } } });

      for (const file of ["summary.md", "manifest.json", "acceptance.json", "remaining-work.json", "recovery.md", "risks.md"]) {
        expect(existsSync(join(dir, "artifacts", "finish", file))).toBe(true);
      }
      // The recovery file is guidance the owner reads, never a script anything runs.
      expect(readFileSync(join(dir, "artifacts", "finish", "recovery.md"), "utf8")).toContain("never performs a git write");
    });
  }
});
