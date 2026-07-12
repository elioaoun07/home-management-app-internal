// scripts/delivery/drivers/fake.mjs
// Scripted, fully deterministic driver implementation for tests (and, in a
// later slice, the S2 runner/dashboard smoke path). Never touches a real SDK,
// a real process, or the filesystem.
// See ERA Notes/10 - Project Management/Agentic Delivery Workspace/4 - Agent Drivers & Security.md §1.

import { DriverError, registerDriver } from "./driver.mjs";

/**
 * @typedef {{finalText?:string, usage?:object, events?:object[], throws?:string}} ScriptedTurn
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

  function runTurn(handle, prompt, { outputSchema, onEvent } = {}) {
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

    for (const event of turn.events || []) {
      if (typeof onEvent === "function") onEvent(event);
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

    return {
      finalText: turn.finalText != null ? turn.finalText : "",
      usage: turn.usage || { input: 0, cachedInput: 0, output: 0, costUsd: null },
    };
  }

  return {
    kind: "fake",
    startSession,
    resume,
    runTurn,
  };
}

registerDriver("fake", createFakeDriver);
