// DW-8 acceptance tests: provider handoff (Claude <-> Codex) driven through
// run-session.mjs's state machine. A fake driver factory is injected via
// advanceSession's `createDriver` option so the "new provider" side of the
// handoff never touches a real SDK or the shared driver registry — see the
// module header of drivers/driver.mjs for the registry, and driver.mjs's own
// register/unregister test seam for why that global registry isn't used here
// (it would leak the override across every test in this worker).
import { existsSync, mkdirSync, mkdtempSync, readFileSync, readdirSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { afterEach, describe, expect, it } from "vitest";

import { createDriver as createRealDriver } from "../../scripts/delivery/drivers/driver.mjs";
import "../../scripts/delivery/drivers/fake.mjs";
import { createFakeDriver } from "../../scripts/delivery/drivers/fake.mjs";
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
  const root = mkdtempSync(join(tmpdir(), "delivery-handoff-"));
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
      sessionId, agent: "claude",
      agentConfig: { model: "claude-sonnet-5", effort: { discovery: "medium", plan: "high", building: "high", review: "medium" } },
      item,
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

/** A fake driver factory usable as advanceSession's `createDriver` override — every kind resolves to a fake driver. */
function fakeCreateDriver(scriptsByKind: Record<string, { turns: Array<Record<string, unknown>> }>) {
  return (kind: string) => {
    if (kind === "fake" || !scriptsByKind[kind]) return createRealDriver("fake", { script: scriptsByKind.fake || { turns: [] } });
    return createFakeDriver({ script: scriptsByKind[kind] });
  };
}

async function advanceOnce(dir: string, driver: object, repoRoot: string, createDriverOverride?: (kind: string) => object) {
  return advanceSession({
    sessionDir: dir, driver, repoRoot, retryDelayMs: 0, sleep: () => {}, takeSnapshot: stableSnapshot,
    readHead: () => "fixture-shipped-head",
    createDriver: createDriverOverride,
  });
}

const SPEC_TEXT = JSON.stringify({
  problem: "p", currentBehavior: "c", proposedBehavior: "pb",
  acceptanceCriteria: [{ id: "AC1", text: "works" }], affectedPaths: [], riskFlags: [], openQuestions: [],
});
const GOOD_VERIFICATION = JSON.stringify({
  understandingSummary: "Fixing a rounding drift in allocation splits.", currentPhase: "SPEC_READY", nextAction: "Approve the spec.", gaps: [],
});
const GAPPY_VERIFICATION = JSON.stringify({
  understandingSummary: "Not fully sure what this is about.", currentPhase: "SPEC_READY", nextAction: "Clarify.",
  gaps: ["Unclear what 'rounding drift' means in this codebase"],
});

describe("DW-8: successful handoff", () => {
  it("switches provider/model, writes a handoffs record, and continues without a new gate", async () => {
    const root = setupRepo();
    const { dir } = makePacketAndState(root);
    const originalDriver = createRealDriver("fake", { script: { turns: [{ finalText: SPEC_TEXT, usage: { input: 1, cachedRead: 0, cacheCreation: 0, output: 1, reasoningOutput: 0 } }] } });

    await advanceOnce(dir, originalDriver, root); // SELECTED -> DISCOVERY
    await advanceOnce(dir, originalDriver, root); // DISCOVERY turn -> SPEC_READY

    writeControl(dir, 1, "set-config", { provider: "codex", model: "gpt-5.2-codex" });
    const createDriverOverride = fakeCreateDriver({ codex: { turns: [{ finalText: GOOD_VERIFICATION, usage: { input: 5, cachedRead: 0, cacheCreation: 0, output: 5, reasoningOutput: 2 } }] } });
    const tick = await advanceOnce(dir, originalDriver, root, createDriverOverride);

    expect(tick.state.execution.provider).toBe("codex");
    expect(tick.state.execution.model).toBe("gpt-5.2-codex");
    expect(tick.state.execution.pendingConfig).toBeNull();
    expect(tick.state.driver.ref).toBeTruthy(); // new provider's ref
    expect(tick.state.driver.priorRefs).toHaveLength(1); // old claude ref archived
    // the pre-existing spec gate is preserved — a clean handoff never clears
    // an owner approval the session was already waiting on.
    expect(tick.state.awaiting).toEqual({ gate: "spec" });

    const events = readEvents(dir);
    expect(events.some((e) => e.type === "handoff.started")).toBe(true);
    expect(events.some((e) => e.type === "handoff.completed")).toBe(true);
    expect(events.some((e) => e.type === "handoff.gaps")).toBe(false);

    const handoffFiles = existsSync(join(dir, "handoffs")) ? readdirSync(join(dir, "handoffs")) : [];
    expect(handoffFiles).toContain("0001.json");
    const record = JSON.parse(readFileSync(join(dir, "handoffs", "0001.json"), "utf8"));
    expect(record.from.provider).toBe("claude");
    expect(record.to.provider).toBe("codex");
    expect(record.verification.ok).toBe(true);
    expect(record.outcome).toBe("continued");

    // a rotation (digest + snapshot) happened as part of the handoff
    expect(existsSync(join(dir, "context", "snapshots", "0001.json"))).toBe(true);
    const snapshot = JSON.parse(readFileSync(join(dir, "context", "snapshots", "0001.json"), "utf8"));
    expect(snapshot.reason).toBe("handoff");
  });

  it("translates effort via config.effortMap when the owner didn't specify explicit overrides", async () => {
    const root = setupRepo();
    const { dir } = makePacketAndState(root);
    const originalDriver = createRealDriver("fake", { script: { turns: [{ finalText: SPEC_TEXT, usage: { input: 1, cachedRead: 0, cacheCreation: 0, output: 1, reasoningOutput: 0 } }] } });
    await advanceOnce(dir, originalDriver, root);
    await advanceOnce(dir, originalDriver, root);

    writeControl(dir, 1, "set-config", { provider: "codex" }); // no effortByPhase override
    const createDriverOverride = fakeCreateDriver({ codex: { turns: [{ finalText: GOOD_VERIFICATION, usage: { input: 1, cachedRead: 0, cacheCreation: 0, output: 1, reasoningOutput: 0 } }] } });
    const tick = await advanceOnce(dir, originalDriver, root, createDriverOverride);

    // claude "high" (plan/building) has no direct codex equivalent named "high"
    // in the identity map beyond same-name passthrough — the default map keeps
    // same-named levels identical, so "high" stays "high" and "medium" stays
    // "medium"; only claude's "max" has a real remap (-> codex "xhigh").
    expect(tick.state.execution.effortByPhase.discovery).toBe("medium");
    expect(tick.state.execution.effortByPhase.plan).toBe("high");
  });
});

describe("DW-8: handoff verification finds gaps", () => {
  it("raises a blocking question instead of silently continuing", async () => {
    const root = setupRepo();
    const { dir } = makePacketAndState(root);
    const originalDriver = createRealDriver("fake", { script: { turns: [{ finalText: SPEC_TEXT, usage: { input: 1, cachedRead: 0, cacheCreation: 0, output: 1, reasoningOutput: 0 } }] } });
    await advanceOnce(dir, originalDriver, root);
    await advanceOnce(dir, originalDriver, root);

    writeControl(dir, 1, "set-config", { provider: "codex" });
    const createDriverOverride = fakeCreateDriver({ codex: { turns: [{ finalText: GAPPY_VERIFICATION, usage: { input: 1, cachedRead: 0, cacheCreation: 0, output: 1, reasoningOutput: 0 } }] } });
    const tick = await advanceOnce(dir, originalDriver, root, createDriverOverride);

    expect(tick.state.state).toBe("NEEDS_DECISION");
    expect(tick.state.awaiting.gate).toBe("question");
    expect(tick.state.awaiting.questions[0].text).toMatch(/rounding drift/);
    // the provider switch still applied — the gap is a warning, not a rollback
    expect(tick.state.execution.provider).toBe("codex");

    const record = JSON.parse(readFileSync(join(dir, "handoffs", "0001.json"), "utf8"));
    expect(record.verification.ok).toBe(false);
    expect(record.outcome).toBe("paused");
    expect(readEvents(dir).some((e) => e.type === "handoff.gaps")).toBe(true);
  });
});

describe("DW-8: handoff turn failure", () => {
  it("blocks the session (does not silently keep the old provider active) when the verification turn errors", async () => {
    const root = setupRepo();
    const { dir } = makePacketAndState(root);
    const originalDriver = createRealDriver("fake", { script: { turns: [{ finalText: SPEC_TEXT, usage: { input: 1, cachedRead: 0, cacheCreation: 0, output: 1, reasoningOutput: 0 } }] } });
    await advanceOnce(dir, originalDriver, root);
    await advanceOnce(dir, originalDriver, root);

    writeControl(dir, 1, "set-config", { provider: "codex" });
    const createDriverOverride = fakeCreateDriver({ codex: { turns: [{ throws: "simulated codex outage" }] } });
    const tick = await advanceOnce(dir, originalDriver, root, createDriverOverride);

    expect(tick.state.state).toBe("BLOCKED");
    expect(readEvents(dir).some((e) => e.type === "handoff.failed")).toBe(true);
  });
});
