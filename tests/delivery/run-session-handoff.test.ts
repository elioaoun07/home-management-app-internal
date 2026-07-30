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
import { advanceSession, resolveProviderDriver } from "../../scripts/delivery/run-session.mjs";

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

async function advanceOnce(
  dir: string,
  driver: object,
  repoRoot: string,
  createDriverOverride?: (kind: string) => object,
  providerDriverCache?: Map<string, object>,
) {
  return advanceSession({
    sessionDir: dir, driver, repoRoot, retryDelayMs: 0, sleep: () => {}, takeSnapshot: stableSnapshot,
    readHead: () => "fixture-shipped-head",
    createDriver: createDriverOverride,
    providerDriverCache,
  });
}

/**
 * A fake driver wearing a real provider's `kind`. DLV-34's resolution is by
 * driver kind, and it deliberately refuses to swap a driver whose kind is not a
 * real provider name — otherwise any fake-driver test would be one handoff away
 * from instantiating a live SDK driver. So exercising the swap needs a fake that
 * claims to be the provider the packet names.
 */
function fakeWearingKind(kind: string, script: { turns: Array<Record<string, unknown>> }) {
  return { ...createFakeDriver({ script }), kind };
}

function writeDecision(dir: string, seq: number, gate: string, decision: string) {
  const decisionsDir = join(dir, "decisions");
  mkdirSync(decisionsDir, { recursive: true });
  atomicWriteJsonSync(join(decisionsDir, `${String(seq).padStart(4, "0")}-${gate}.json`), {
    seq, gate, decision, note: null, confirmText: null, tickCheckbox: true,
    answer: null, capabilitiesDrop: null, at: new Date().toISOString(),
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
const PLAN_TEXT = JSON.stringify({
  steps: [{ id: "STEP-1", description: "Fix the rounding", paths: ["src/x.ts"], validationHint: "pnpm test" }],
  testPlan: "unit", riskFlags: [], rollbackSketch: "revert", noNewDeps: true, openQuestions: [],
});
const USAGE = { input: 1, cachedRead: 0, cacheCreation: 0, output: 1, reasoningOutput: 0 };

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
  // This asserted `BLOCKED` until DLV-4 gave retry-exhaustion its own escalation
  // path, after which an exhausted handoff-verification turn lands in
  // NEEDS_DECISION instead. Both are owner-facing stop states, and the retry
  // that either one offers re-establishes the provider from scratch (the ref was
  // already archived by performRotation), so the change is benign — but the
  // assertion was pinned to the *state name* rather than to the contract the
  // test is named for. It now asserts that contract directly, so a future
  // taxonomy change can't quietly turn "stopped and asked" into "carried on".
  //
  // (This is the failure the PM notes carried as "the pre-existing DLV-34
  // handoff failure". It is not DLV-34 — that item is about the *success* path
  // writing back the new provider's ref onto the old provider's driver, which
  // this test never exercises. Mislabelling it hid a green suite behind a red one.)
  it("stops and asks the owner, never silently switching provider, when the verification turn errors", async () => {
    const root = setupRepo();
    const { dir } = makePacketAndState(root);
    const originalDriver = createRealDriver("fake", { script: { turns: [{ finalText: SPEC_TEXT, usage: { input: 1, cachedRead: 0, cacheCreation: 0, output: 1, reasoningOutput: 0 } }] } });
    await advanceOnce(dir, originalDriver, root);
    await advanceOnce(dir, originalDriver, root);

    writeControl(dir, 1, "set-config", { provider: "codex" });
    const createDriverOverride = fakeCreateDriver({ codex: { turns: [{ throws: "simulated codex outage" }] } });
    const tick = await advanceOnce(dir, originalDriver, root, createDriverOverride);

    // 1. The session stopped in a state that waits for the owner, whichever of
    //    the two stop states the error taxonomy routes it to.
    expect(["BLOCKED", "NEEDS_DECISION"]).toContain(tick.state.state);
    expect(tick.state.awaiting).not.toBeNull();
    // 2. The failure is on the record, not swallowed. Deliberately not asserting
    //    the message text: DLV-4 retries the verification turn, so the recorded
    //    message is the LAST attempt's, and the single-turn fixture makes that
    //    the fake driver's own "script exhausted" — an artifact of the fixture,
    //    not of the product.
    expect(readEvents(dir).some((e) => e.type === "handoff.failed")).toBe(true);
    expect(tick.state.lastError).toMatchObject({ phase: expect.any(String), message: expect.any(String) });
    // 3. The provider switch did NOT silently take effect on a provider that
    //    never verified — the actual point of the test.
    expect(tick.state.execution?.provider ?? "fake").not.toBe("codex");
    // 4. No stale ref survives, so whichever recovery the owner picks
    //    re-establishes a provider session from scratch.
    expect(tick.state.driver.ref).toBeNull();
  });
});

describe("DLV-34: the phase after a handoff runs on the new provider's driver", () => {
  it("resumes the new ref on the new provider's instance, not the outgoing one", async () => {
    const root = setupRepo();
    const { dir } = makePacketAndState(root);

    // The outgoing driver's script holds exactly ONE turn — DISCOVERY's. If the
    // post-handoff PLAN turn is still routed here (the DLV-34 bug), the fake
    // throws "script exhausted" and the session blocks instead of planning.
    const claudeDriver = fakeWearingKind("claude", { turns: [{ finalText: SPEC_TEXT, usage: USAGE }] });
    const codexDriver = fakeWearingKind("codex", {
      turns: [
        { finalText: GOOD_VERIFICATION, usage: USAGE }, // handoff verification
        { finalText: PLAN_TEXT, usage: USAGE },          // the PLAN turn that must land here
      ],
    });
    const cache = new Map<string, object>();
    const createDriverOverride = (kind: string) => (kind === "codex" ? codexDriver : claudeDriver);

    await advanceOnce(dir, claudeDriver, root, createDriverOverride, cache); // SELECTED -> DISCOVERY
    await advanceOnce(dir, claudeDriver, root, createDriverOverride, cache); // DISCOVERY -> SPEC_READY

    writeControl(dir, 1, "set-config", { provider: "codex", model: "gpt-5.2-codex" });
    const handoffTick = await advanceOnce(dir, claudeDriver, root, createDriverOverride, cache);
    expect(handoffTick.state.execution.provider).toBe("codex");
    expect(cache.get("codex")).toBe(codexDriver);

    // Approving the spec runs a fresh PLAN turn — the first real phase work
    // after the provider changed.
    writeDecision(dir, 1, "spec", "approve");
    const planTick = await advanceOnce(dir, claudeDriver, root, createDriverOverride, cache);

    expect(planTick.state.state).toBe("PLAN_READY");
    expect(planTick.state.lastError).toBeNull();
    expect(existsSync(join(dir, "artifacts", "plan.md"))).toBe(true);
  });

  it("never swaps a non-provider (fake/test) driver, whatever the packet names", () => {
    const fake = createRealDriver("fake", { script: { turns: [] } });
    const resolved = resolveProviderDriver({
      driver: fake,
      state: { execution: { provider: "codex" } },
      packet: { agent: "claude", constraints: { forbiddenPaths: [] } },
      sessionDir: "/tmp/nope",
      createDriver: () => {
        throw new Error("must not build a real provider driver for a fake");
      },
    });
    expect(resolved).toBe(fake);
  });

  it("returns the same instance when the provider never changed", () => {
    const claude = fakeWearingKind("claude", { turns: [] });
    const resolved = resolveProviderDriver({
      driver: claude,
      state: { execution: { provider: "claude" } },
      packet: { agent: "claude", constraints: { forbiddenPaths: [] } },
      sessionDir: "/tmp/nope",
      createDriver: () => {
        throw new Error("must not rebuild a driver that already matches");
      },
    });
    expect(resolved).toBe(claude);
  });

  it("builds the replacement with the packet's forbiddenPaths and the session dir", () => {
    const claude = fakeWearingKind("claude", { turns: [] });
    const seen: Array<{ kind: string; options: Record<string, unknown> }> = [];
    const replacement = fakeWearingKind("codex", { turns: [] });
    const resolved = resolveProviderDriver({
      driver: claude,
      state: { execution: { provider: "codex" } },
      packet: { agent: "claude", constraints: { forbiddenPaths: ["src/components/ui/**"] } },
      sessionDir: "/tmp/session-x",
      createDriver: (kind: string, options: Record<string, unknown>) => {
        seen.push({ kind, options });
        return replacement;
      },
    });
    expect(resolved).toBe(replacement);
    expect(seen).toEqual([
      { kind: "codex", options: { sessionDir: "/tmp/session-x", forbiddenPaths: ["src/components/ui/**"] } },
    ]);
  });
});
