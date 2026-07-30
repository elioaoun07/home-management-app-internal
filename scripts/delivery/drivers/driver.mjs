// scripts/delivery/drivers/driver.mjs
// Provider-neutral agent driver interface + factory registry.
// See ERA Notes/10 - Project Management/Agentic Delivery Workspace/4 - Agent Drivers & Security.md §1.
//
// This module defines the seam only. SDK-backed drivers register themselves
// when their modules are imported by the runner; each driver still dynamic-
// imports its SDK only when a real session starts, so this registry remains
// zero-dependency and dashboard startup never performs provider I/O.
//
// createDriver(kind) → {
//   startSession({cwd, mode: "build" | "readonly", model?}) → handle
//   resume(ref)                                             → handle
//   runTurn(handle, prompt, {outputSchema?, onEvent})        → {finalText, usage}
//   reset()                                                  → void
// }
//
// `reset()` (DLV-31): the runner creates one driver instance per process and
// reuses it across every tick (see run-session.mjs's runLoop). A driver's
// `startSession` refuses to run twice — that guard is real and should stay —
// but a rotation or a quota-paused retry nulls `state.driver.ref` to force
// the *next* `getHandle` call to start fresh, without the driver instance
// ever being told its previous logical session ended. `getHandle` calls
// `driver.reset()` right before any `startSession`, so implementations must
// clear whatever internal state makes `startSession` throw "already
// started" (idempotent — safe to call even when never started).

export class DriverError extends Error {}

/** Thrown by a driver's `runTurn` when the turn was stopped via the `signal`
 * passed in (DW-10: owner-initiated mid-turn abort) rather than failing on
 * its own — `runGuardedTurn` treats this as a distinct, non-retried outcome. */
export class DriverAbortedError extends DriverError {}

const REGISTRY = new Map();

/** Register a driver factory under `kind` (e.g. "fake", later "codex"/"claude"). */
export function registerDriver(kind, factory) {
  if (!kind || typeof factory !== "function") {
    throw new DriverError("registerDriver requires a kind and a factory function");
  }
  REGISTRY.set(kind, factory);
}

/**
 * Build a driver instance for `kind`. Throws clearly for any kind that has no
 * registered factory.
 */
export function createDriver(kind, options = {}) {
  const factory = REGISTRY.get(kind);
  if (!factory) {
    throw new DriverError(
      `no driver registered for kind "${kind}"`,
    );
  }
  return factory(options);
}

/** Kinds currently registered (test/introspection helper). */
export function listRegisteredDrivers() {
  return Array.from(REGISTRY.keys());
}

/**
 * Race `promise` against a `ms` timeout. On timeout, calls `onTimeout()` (e.g.
 * abort the in-flight SDK call so it doesn't keep running orphaned) and
 * rejects with a `DriverError` instead of hanging forever.
 *
 * Preflight calls in claude.mjs/codex.mjs are the one driver-boundary
 * operation that used to run with no timeout and no abort wiring at all —
 * unlike real turns (which are abortable mid-flight via the owner's Pause
 * control), a hang here previously left the runner process alive but stuck
 * forever in the SELECTED state, unrecoverable by Pause/Resume.
 * @param {Promise<any>} promise
 * @param {number} ms
 * @param {() => void} [onTimeout]
 */
export function withTimeout(promise, ms, onTimeout) {
  let timer;
  const timeout = new Promise((_, reject) => {
    timer = setTimeout(() => {
      if (typeof onTimeout === "function") onTimeout();
      reject(new DriverError(`operation timed out after ${ms}ms`));
    }, ms);
    if (timer && typeof timer.unref === "function") timer.unref();
  });
  return Promise.race([promise, timeout]).finally(() => clearTimeout(timer));
}

/**
 * DLV-43: tag a driver error with the usage its dead turn had already spent.
 *
 * A turn that ends in a provider error rather than a clean result is not a
 * free turn — `s-20260729-121840-pdhx` recorded $0.00 / 0 tokens for a
 * DISCOVERY phase whose raw SDK transcript shows 512,752 processed tokens
 * (~$0.34 at Haiku 4.5 pricing), already past that lane's own 500,000-token
 * cap. `enforceBudgetBoundary` only ever saw usage from turns that completed,
 * so a runaway or crashing phase — precisely the scenario a hard cap exists
 * for — was invisible to it.
 *
 * Attached as non-enumerable properties so the error still serializes and
 * prints exactly as before (nothing that logs or compares error shapes
 * changes behavior); `readObservedUsage` is the only intended reader.
 * @param {Error} error
 * @param {{usage?:object, usageV2?:object}|null} observed - normalized usage the driver saw before failing
 */
export function withObservedUsage(error, observed) {
  if (!error || !observed) return error;
  const { usage = null, usageV2 = null } = observed;
  if (!usage && !usageV2) return error;
  Object.defineProperty(error, "observedUsage", { value: usage, enumerable: false, configurable: true });
  Object.defineProperty(error, "observedUsageV2", { value: usageV2, enumerable: false, configurable: true });
  return error;
}

/**
 * Read back whatever `withObservedUsage` attached, for a caller that must bank
 * a failed turn's spend. Returns `null` when the error carries no usage (an
 * error thrown before the provider was ever reached genuinely cost nothing).
 * @param {unknown} error
 * @returns {{usage:({costUsd?:(number|null)}|null), usageV2:({costUsd?:(number|null)}|null)}|null}
 */
export function readObservedUsage(error) {
  if (!error || typeof error !== "object") return null;
  const usage = error.observedUsage || null;
  const usageV2 = error.observedUsageV2 || null;
  if (!usage && !usageV2) return null;
  return { usage, usageV2 };
}

/** Remove a registered driver (test isolation helper). */
export function unregisterDriver(kind) {
  REGISTRY.delete(kind);
}
