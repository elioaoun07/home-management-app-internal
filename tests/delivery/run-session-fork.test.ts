// DW-9 acceptance tests: forking a session into an independent sibling
// directory, driven through run-session.mjs's state machine.
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
  const root = mkdtempSync(join(tmpdir(), "delivery-fork-"));
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
  return { dir, packet, sessionId };
}

function writeControl(dir: string, seq: number, type: string, payload: object = {}) {
  const controlsDir = join(dir, "controls");
  mkdirSync(controlsDir, { recursive: true });
  const control = buildControl({ seq, type, payload });
  atomicWriteJsonSync(join(controlsDir, controlFileName(control)), control);
}

async function advanceOnce(dir: string, driver: object, repoRoot: string) {
  return advanceSession({
    sessionDir: dir, driver, repoRoot, retryDelayMs: 0, sleep: () => {}, takeSnapshot: stableSnapshot,
    readHead: () => "fixture-shipped-head",
  });
}

const SPEC_TEXT = JSON.stringify({
  problem: "p", currentBehavior: "c", proposedBehavior: "pb",
  acceptanceCriteria: [{ id: "AC1", text: "works" }], affectedPaths: [], riskFlags: [], openQuestions: [],
});

describe("DW-9: fork creates an independent sibling session", () => {
  it("copies packet identity (with parentSession), artifacts, and the ledger; starts the child at the parent's current state", async () => {
    const root = setupRepo();
    const { dir, sessionId } = makePacketAndState(root);
    const driver = createDriver("fake", { script: { turns: [{ finalText: SPEC_TEXT, usage: { input: 1, cachedRead: 0, cacheCreation: 0, output: 1, reasoningOutput: 0 } }] } });

    await advanceOnce(dir, driver, root); // SELECTED -> DISCOVERY
    await advanceOnce(dir, driver, root); // DISCOVERY turn -> SPEC_READY (writes artifacts/spec.md + ledger)

    writeControl(dir, 1, "fork", {});
    const tick = await advanceOnce(dir, driver, root);

    expect(tick.state.forks).toEqual([`${sessionId}-f1`]);
    expect(tick.state.execution.paused).toBe(true); // parent pauses so both lineages don't touch git at once

    const forkDir = join(root, ".delivery", "sessions", `${sessionId}-f1`);
    expect(existsSync(forkDir)).toBe(true);

    const forkPacket = JSON.parse(readFileSync(join(forkDir, "packet.json"), "utf8"));
    expect(forkPacket.sessionId).toBe(`${sessionId}-f1`);
    expect(forkPacket.parentSession).toBe(sessionId);
    expect(forkPacket.item.text).toBe("Fix rounding drift"); // same work item identity

    expect(existsSync(join(forkDir, "artifacts", "spec.md"))).toBe(true);
    expect(existsSync(join(forkDir, "artifacts", "spec.json"))).toBe(true);

    const forkLedger = JSON.parse(readFileSync(join(forkDir, "memory", "ledger.json"), "utf8"));
    expect(forkLedger.objective.itemText).toBe("Fix rounding drift");

    const forkState = JSON.parse(readFileSync(join(forkDir, "state.json"), "utf8"));
    expect(forkState.state).toBe("SPEC_READY");
    expect(forkState.awaiting).toEqual({ gate: "spec" });
    expect(forkState.parentSession).toBe(sessionId);
    expect(forkState.driver.ref).toBeNull(); // fresh — never resumes the parent's provider session
    expect(forkState.turnCounter).toBe(0);
  });

  it("the fork's own transcript starts empty — no turns.ndjson copied from the parent", async () => {
    const root = setupRepo();
    const { dir, sessionId } = makePacketAndState(root);
    const driver = createDriver("fake", { script: { turns: [{ finalText: SPEC_TEXT, usage: { input: 1, cachedRead: 0, cacheCreation: 0, output: 1, reasoningOutput: 0 } }] } });
    await advanceOnce(dir, driver, root);
    await advanceOnce(dir, driver, root);

    writeControl(dir, 1, "fork", {});
    await advanceOnce(dir, driver, root);

    const forkDir = join(root, ".delivery", "sessions", `${sessionId}-f1`);
    expect(existsSync(join(forkDir, "transcript"))).toBe(false); // no turns.ndjson/records copied
    // events.ndjson does exist — the "fork.created" event is written
    // directly into the new session as its first record.
    const events = readFileSync(join(forkDir, "events.ndjson"), "utf8").trim().split("\n").map((l) => JSON.parse(l));
    expect(events).toHaveLength(1);
    expect(events[0].type).toBe("fork.created");
    expect(events[0].data.parentSession).toBe(sessionId);
  });

  it("second fork from the same parent gets a distinct id (-f2)", async () => {
    const root = setupRepo();
    const { dir, sessionId } = makePacketAndState(root);
    const driver = createDriver("fake", { script: { turns: [{ finalText: SPEC_TEXT, usage: { input: 1, cachedRead: 0, cacheCreation: 0, output: 1, reasoningOutput: 0 } }] } });
    await advanceOnce(dir, driver, root);
    await advanceOnce(dir, driver, root);

    writeControl(dir, 1, "fork", {});
    await advanceOnce(dir, driver, root); // creates -f1, pauses parent

    writeControl(dir, 2, "resume-run"); // un-pause so the parent can fork again
    await advanceOnce(dir, driver, root);
    writeControl(dir, 3, "fork", {});
    const tick = await advanceOnce(dir, driver, root);

    expect(tick.state.forks).toEqual([`${sessionId}-f1`, `${sessionId}-f2`]);
    expect(existsSync(join(root, ".delivery", "sessions", `${sessionId}-f2`))).toBe(true);
  });

  it("forking a session with no ledger yet (before DISCOVERY) still succeeds, just without a memory/ dir", async () => {
    const root = setupRepo();
    const { dir, sessionId } = makePacketAndState(root);
    const driver = createDriver("fake", { script: { turns: [] } });

    writeControl(dir, 1, "fork", {});
    const tick = await advanceOnce(dir, driver, root);

    expect(tick.state.forks).toEqual([`${sessionId}-f1`]);
    const forkDir = join(root, ".delivery", "sessions", `${sessionId}-f1`);
    expect(existsSync(join(forkDir, "memory"))).toBe(false);
    const forkState = JSON.parse(readFileSync(join(forkDir, "state.json"), "utf8"));
    expect(forkState.state).toBe("SELECTED");
  });
});
