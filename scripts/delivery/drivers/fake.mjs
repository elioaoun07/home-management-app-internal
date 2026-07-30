// scripts/delivery/drivers/fake.mjs
// Scripted, fully deterministic driver implementation for tests (and the
// runner/dashboard smoke path). Never touches a real SDK, a real process, or
// the filesystem. Extended in DW-1 (the durable-memory campaign, now merged into Delivery) to also
// support the seam v2 shape — an `onRaw` full-fidelity record feed, v2 usage
// passthrough, per-turn model/effort tracking, and `turnMeta` — so every
// slice downstream of the flight recorder is testable without a live SDK.
// See ERA Notes/10 - Project Management/Delivery/Delivery — Master Book.md
// and ERA Notes/10 - Project Management/Delivery/Delivery — Master Book.md for the v2 seam.

import { DriverAbortedError, DriverError, registerDriver, withObservedUsage } from "./driver.mjs";

/**
 * `throwsUsage` (DLV-43) scripts a turn that fails *after* the provider already
 * answered — the case real sessions hit and the runner used to record as $0.00.
 * Pair it with `throws`; the real drivers attach exactly this shape to the
 * error they raise.
 * @typedef {{finalText?:string, usage?:object, usageV2?:object, events?:object[],
 *   rawRecords?:object[], turnMeta?:object, throws?:string,
 *   throwsUsage?:{usage?:object, usageV2?:object}, delayMs?:number}} ScriptedTurn
 */

/**
 * Create a fake driver instance.
 *
 * DLV-18 adds two driver-level failure modes, both of which exist because
 * enumerating them turn-by-turn in a script is impossible or absurd:
 *
 *  - `throwsEvery`: every turn fails with the same message, which is what a
 *    retry storm actually looks like. Scripting it as N identical entries
 *    couples the fixture to `errors.maxAutoRetries`, so a config change would
 *    silently turn a retry-storm test into a script-exhaustion test.
 *  - `failStartSession`: `startSession` itself throws — a provider that is
 *    unreachable or unauthenticated before any turn exists to script.
 *
 * @param {{script?:{turns:ScriptedTurn[]}, sessionId?:string,
 *   throwsEvery?:(string|null), throwsEveryUsage?:(object|null),
 *   failStartSession?:(string|null)}} [options]
 */
export function createFakeDriver(options = {}) {
  const turns = (options.script && options.script.turns) || [];
  const throwsEvery = options.throwsEvery || null;
  const failStartSession = options.failStartSession || null;
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
    if (failStartSession) {
      throw new DriverError(failStartSession);
    }
    if (mode !== "build" && mode !== "readonly") {
      throw new DriverError(`fake driver: unknown mode "${mode}"`);
    }
    started = true;
    currentRef = { id: options.sessionId || `fake-${turnIndex}-${Date.now()}`, cwd, mode, model: model || null };
    return { ref: currentRef, cwd, mode };
  }

  // Mirrors the real drivers' `overrides.mode` seam so tests can assert a
  // resumed session actually switches modes across phases (see claude.mjs).
  function resume(ref, overrides = {}) {
    if (!ref || !ref.id) {
      throw new DriverError("fake driver: resume requires a ref with an id");
    }
    started = true;
    currentRef = ref;
    const mode = (overrides && overrides.mode) || ref.mode;
    return { ref: currentRef, cwd: ref.cwd, mode };
  }

  // DLV-31: the runner reuses one driver instance across a whole process
  // lifetime (runLoop creates it once, outside the tick loop — see
  // run-session.mjs). Rotation and the quota-paused retry both null
  // `state.driver.ref` to force the *next* `getHandle` call to start fresh,
  // but never told this in-memory instance to forget it was already
  // started — so `startSession` threw "session already started" forever
  // after. `getHandle` now calls `reset()` right before any `startSession`.
  function reset() {
    started = false;
    currentRef = null;
  }

  function runTurn(handle, prompt, { outputSchema, onEvent, onRaw, effort, model, maxTurns, signal } = {}) {
    if (!started) {
      throw new DriverError("fake driver: cannot run a turn before startSession/resume");
    }
    if (typeof prompt !== "string" || !prompt.trim()) {
      throw new DriverError("fake driver: prompt must be a non-empty string");
    }
    // DLV-18: checked before the script bounds so a retry-storm fixture needs
    // no script at all, and cannot be mistaken for script exhaustion.
    if (throwsEvery) {
      throw withObservedUsage(new DriverError(throwsEvery), options.throwsEveryUsage || null);
    }
    if (turnIndex >= turns.length) {
      throw new DriverError(`fake driver: script exhausted at turn ${turnIndex}`);
    }
    const turn = turns[turnIndex];
    turnIndex += 1;

    // Real drivers rebuild their per-turn options (incl. model/effort/maxTurns)
    // on every call — mirror that so resume-with-overrides and D9's lane-driven
    // maxTurns are both testable here too.
    if (currentRef) {
      if (model) currentRef.model = model;
      if (effort) currentRef.effort = effort;
      if (maxTurns != null) currentRef.maxTurns = maxTurns;
    }

    for (const event of turn.events || []) {
      if (typeof onEvent === "function") onEvent(event);
    }

    for (const record of turn.rawRecords || []) {
      if (typeof onRaw === "function") onRaw(record);
    }

    if (turn.throws) {
      throw withObservedUsage(new DriverError(turn.throws), turn.throwsUsage || null);
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
    reset,
  };
}

registerDriver("fake", createFakeDriver);
