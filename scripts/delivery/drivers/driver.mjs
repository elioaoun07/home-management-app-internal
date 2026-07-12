// scripts/delivery/drivers/driver.mjs
// Provider-neutral agent driver interface + factory registry.
// See ERA Notes/10 - Project Management/Agentic Delivery Workspace/4 - Agent Drivers & Security.md §1.
//
// This module defines the seam only. Real SDK-backed drivers (`codex.mjs`,
// `claude.mjs`) are added in a later slice as devDependencies, dynamic-
// import()ed inside their own driver module only — this file and every other
// pure module stay zero-dependency. Only `fake.mjs` is registered today.
//
// createDriver(kind) → {
//   startSession({cwd, mode: "build" | "readonly", model?}) → handle
//   resume(ref)                                             → handle
//   runTurn(handle, prompt, {outputSchema?, onEvent})        → {finalText, usage}
// }

export class DriverError extends Error {}

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
 * registered factory — in slice S1 that is every kind except "fake".
 */
export function createDriver(kind, options = {}) {
  const factory = REGISTRY.get(kind);
  if (!factory) {
    throw new DriverError(
      `no driver registered for kind "${kind}" — real SDK-backed drivers ` +
        'arrive in a later slice; only "fake" is available today',
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
