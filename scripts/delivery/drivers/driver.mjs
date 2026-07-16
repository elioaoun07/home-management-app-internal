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
// }

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

/** Remove a registered driver (test isolation helper). */
export function unregisterDriver(kind) {
  REGISTRY.delete(kind);
}
