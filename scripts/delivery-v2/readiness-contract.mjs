// Browser-safe projection vocabulary. No Node imports or execution capability.
export const READINESS_SCHEMA = "delivery-v2/readiness@1";
export const LAUNCH_GATES = Object.freeze(["policy", "selection", "source", "coordination", "runtime", "authentication", "modelAvailability", "environment", "qualification", "checks", "budget"]);
export const LOCAL_LAUNCH_GATES = Object.freeze(["source", "authentication", "environment"]);
export const LOCAL_ADVISORIES = Object.freeze(["coordination", "modelAvailability", "budget"]);
// Settled by passive inspection alone. The other gates need a live observation,
// which an explicit refresh — or Start itself — collects.
export const PASSIVE_GATES = Object.freeze(["policy", "selection", "source", "coordination", "checks"]);
