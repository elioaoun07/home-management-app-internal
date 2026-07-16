// scripts/delivery/drivers/fake.mjs
// Scripted, fully deterministic driver implementation for tests (and the
// runner/dashboard smoke path). Never touches a real SDK, a real process, or
// the filesystem. Extended in DW-1 (Delivery Workspace enhancement) to also
// support the seam v2 shape — an `onRaw` full-fidelity record feed, v2 usage
// passthrough, per-turn model/effort tracking, and `turnMeta` — so every
// slice downstream of the flight recorder is testable without a live SDK.
// See ERA Notes/10 - Project Management/Agentic Delivery Workspace/4 - Agent Drivers & Security.md §1
// and ERA Notes/10 - Project Management/Delivery Workspace/ for the v2 seam.

import { DriverAbortedError, DriverError, registerDriver } from "./driver.mjs";

/**
 * @typedef {{finalText?:string, usage?:object, usageV2?:object, events?:object[],
 *   rawRecords?:object[], turnMeta?:object, throws?:string, delayMs?:number}} ScriptedTurn
 */

/**
 * Create a fake driver instance.
 * @param {{script?:{turns:ScriptedTurn[]}, sessionId?:string}} [options]
 */
export function createFakeDriver(options = {}) {
  const turns = (options.script && options.script.turns) || [];
  let turnIndex = 0;
  let started = false;
  let currentRef = null;

  /** Pure-data capability manifest (seam v2) — see driver.mjs header. */
  function manifest() {
    return {
      provider: "fake",
      efforts: ["low", "medium", "high"],
      effortDefault: "medium",
      supportsPerTurnModel: true,
      supportsPerTurnEffort: true,
      supportsAbort: true,
      supportsNativeFork: false,
      usage: { cacheCreation: true, reasoning: true, costReported: true },
      sandbox: "fake",
    };
  }

  function startSession({ cwd, mode, model } = {}) {
    if (started) {
      throw new DriverError("fake driver: session already started");
    }
    if (mode !== "build" && mode !== "readonly") {
      throw new DriverError(`fake driver: unknown mode "${mode}"`);
    }
    started = true;
    currentRef = { id: options.sessionId || `fake-${turnIndex}-${Date.now()}`, cwd, mode, model: model || null };
    return { ref: currentRef, cwd, mode };
  }

  function resume(ref) {
    if (!ref || !ref.id) {
      throw new DriverError("fake driver: resume requires a ref with an id");
    }
    started = true;
    currentRef = ref;
    return { ref: currentRef, cwd: ref.cwd, mode: ref.mode };
  }

  function runTurn(handle, prompt, { outputSchema, onEvent, onRaw, effort, model, signal } = {}) {
    if (!started) {
      throw new DriverError("fake driver: cannot run a turn before startSession/resume");
    }
    if (typeof prompt !== "string" || !prompt.trim()) {
      throw new DriverError("fake driver: prompt must be a non-empty string");
    }
    if (turnIndex >= turns.length) {
      throw new DriverError(`fake driver: script exhausted at turn ${turnIndex}`);
    }
    const turn = turns[turnIndex];
    turnIndex += 1;

    // Real drivers rebuild their per-turn options (incl. model/effort) on
    // every call — mirror that so resume-with-overrides is testable here too.
    if (currentRef) {
      if (model) currentRef.model = model;
      if (effort) currentRef.effort = effort;
    }

    for (const event of turn.events || []) {
      if (typeof onEvent === "function") onEvent(event);
    }

    for (const record of turn.rawRecords || []) {
      if (typeof onRaw === "function") onRaw(record);
    }

    if (turn.throws) {
      throw new DriverError(turn.throws);
    }

    if (outputSchema && turn.finalText != null) {
      try {
        JSON.parse(turn.finalText);
      } catch {
        throw new DriverError("fake driver: finalText is not valid JSON for the given outputSchema");
      }
    }

    const result = {
      finalText: turn.finalText != null ? turn.finalText : "",
      usage: turn.usage || { input: 0, cachedInput: 0, output: 0, costUsd: null },
      // v2 usage (cacheCreation/reasoningOutput) is only present when a test
      // scripts it explicitly — `usage` stays the v1 shape real drivers
      // always return, matching the seam v2 contract (runGuardedTurn falls
      // back to deriving v2 from v1 when this is absent).
      usageV2: turn.usageV2 || null,
      turnMeta: turn.turnMeta || {
        modelUsed: (currentRef && currentRef.model) || model || null,
        numTurns: 1,
        durationMs: turn.durationMs != null ? turn.durationMs : 0,
        compactBoundaries: turn.compactBoundaries || [],
      },
    };

    // DW-10: scripted turns only become abortable when the test opts in via
    // `delayMs` (a real turn's driver call takes real wall-clock time; a
    // synchronous scripted turn never gives an in-flight abort a chance to
    // land, so every existing test — none of which sets delayMs — keeps its
    // original synchronous return value unchanged).
    if (!turn.delayMs) return result;
    return new Promise((resolve, reject) => {
      if (signal && signal.aborted) {
        reject(new DriverAbortedError("fake driver: turn aborted"));
        return;
      }
      const timer = setTimeout(() => {
        cleanup();
        resolve(result);
      }, turn.delayMs);
      function onAbort() {
        clearTimeout(timer);
        cleanup();
        reject(new DriverAbortedError("fake driver: turn aborted"));
      }
      function cleanup() {
        if (signal) signal.removeEventListener("abort", onAbort);
      }
      if (signal) signal.addEventListener("abort", onAbort, { once: true });
    });
  }

  return {
    kind: "fake",
    manifest,
    startSession,
    resume,
    runTurn,
  };
}

registerDriver("fake", createFakeDriver);
