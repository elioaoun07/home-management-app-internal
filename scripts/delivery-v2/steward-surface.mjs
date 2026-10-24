// scripts/delivery-v2/steward-surface.mjs
// The whole of what ERA Steward may do, in one place that both ends read: the
// tool layer (steward-tools.mjs) to decide what to offer, and entry.mjs to decide
// what to serve. A prompt that says "do not call Codex" is not a control; a route
// that answers 403 to everything outside this list is.
//
// Four operations. None of them runs a model, a shell or a checker:
//   start-delivery    POST /deliver   (one durable receipt, exact plan/Apply gates stay with the owner)
//   read-request      GET  /command   (the original receipt, never a new Start)
//   read-run          GET  /run       (+ /accounting)
//   wait-for-changes  bounded GETs of the two reads above
//
// Pure: no fs, no network, no clock.

export const STEWARD_OPERATIONS = Object.freeze(["start-delivery", "read-request", "read-run", "wait-for-changes"]);

export const STEWARD_REFUSALS = Object.freeze({
  NOT_PERMITTED: "steward-operation-not-permitted",
  GENERIC_DELEGATION: "generic-delegation-refused",
  SHELL: "shell-execution-refused",
  OWNER_ACTION: "owner-action-refused",
  UNKNOWN_OPERATION: "unknown-operation",
});

/** Method + path pairs the Steward credential may call. Everything else is a 403. */
export const STEWARD_ROUTES = Object.freeze([
  "GET /api/delivery/v2/session",
  "GET /api/delivery/v2/runs",
  "GET /api/delivery/v2/run",
  "GET /api/delivery/v2/run/events",
  "GET /api/delivery/v2/command",
  "GET /api/delivery/v2/accounting",
  "POST /api/delivery/v2/deliver",
  "POST /api/delivery/v2/session/revoke",
]);

/** Operation names that would hand the Steward a model or a process. */
const DELEGATION = /^(?:codex|claude|agent|delegate|dispatch|task|spawn|subagent|run[-_ ]?(?:agent|task|codex|claude)|ask[-_ ]?(?:codex|claude))/iu;
const SHELL = /^(?:shell|bash|powershell|pwsh|cmd|exec|execute|run[-_ ]?(?:command|shell|script)|terminal|docker|git|npm|pnpm|node)/iu;
const OWNER = /^(?:approve|apply|decide|decision|answer|message|cancel|control|check[-_ ]?readiness|refresh[-_ ]?readiness|renew|authorize|reconcile|retry|resume|rollback|support|allowance|test[-_ ]?gate)/iu;

/**
 * Why an operation name outside the four is refused. The code is the reason
 * category, so a log line says what kind of reach was attempted.
 *
 * @param {string} operation
 * @returns {{ok:true}|{ok:false, code:string, detail:string}}
 */
export function classifyStewardOperation(operation) {
  const name = String(operation || "").trim();
  if (STEWARD_OPERATIONS.includes(name)) return { ok: true };
  if (DELEGATION.test(name)) return { ok: false, code: STEWARD_REFUSALS.GENERIC_DELEGATION, detail: "ERA Steward cannot start a Codex or Claude task; owner-authorized support is recorded separately" };
  if (SHELL.test(name)) return { ok: false, code: STEWARD_REFUSALS.SHELL, detail: "ERA Steward has no terminal or Docker access; the four operations read or start through Command Center" };
  if (OWNER.test(name)) return { ok: false, code: STEWARD_REFUSALS.OWNER_ACTION, detail: "plan approval, Apply, readiness renewal and recovery stay with the owner" };
  return { ok: false, code: STEWARD_REFUSALS.UNKNOWN_OPERATION, detail: "allowed: " + STEWARD_OPERATIONS.join(", ") };
}

/** Is this method + path on the Steward credential's route allowlist? */
export function stewardRoutePermitted(method, path) {
  return STEWARD_ROUTES.includes(String(method).toUpperCase() + " " + String(path));
}
