// scripts/delivery/controls.mjs
// Owner-command channel: pm-server writes numbered control files
// (`controls/NNNN-<type>.json`), the runner drains them at the next boundary
// — the exact same numbered-file discipline as `decisions/` and `messages/`
// (see run-session.mjs's `pendingDecisions`/`pendingMessages`), just for
// commands that aren't tied to a specific approval gate: pause/resume-run,
// same-provider model/effort change, rotate, fork, pin/unpin, and owner-side
// Q&A (`answer`/`ask`). See ERA Notes/10 - Project Management/Delivery Workspace/
// (DW-4 introduces this channel for pause + set-config; DW-5/DW-7/DW-9 reuse
// it for answer/ask, rotate/pin/unpin, and fork).
//
// Pure schema/validation only — file I/O stays in server-routes.mjs (writer)
// and run-session.mjs (reader/consumer), matching every other numbered-file
// channel in this codebase.

export class ControlsError extends Error {}

export const CONTROL_TYPES = Object.freeze([
  "pause",
  "resume-run",
  "set-config",
  "set-budget",
  "rotate",
  "fork",
  "pin",
  "unpin",
  "answer",
  "ask",
]);

/**
 * Build one control record. `payload` shape depends on `type` — see
 * `validateControlPayload` for the per-type contract.
 * @param {{seq:number, type:string, payload?:object, at?:string}} fields
 */
export function buildControl({ seq, type, payload = {}, at }) {
  if (typeof seq !== "number") throw new ControlsError("control.seq must be a number");
  if (!type || !CONTROL_TYPES.includes(type)) throw new ControlsError(`unknown control type "${type}"`);
  validateControlPayload(type, payload);
  return { seq, type, at: at || new Date().toISOString(), payload };
}

/** File name for a control record, matching `decisions/NNNN-<gate>.json`'s convention. */
export function controlFileName(control) {
  return `${String(control.seq).padStart(4, "0")}-${control.type}.json`;
}

/**
 * Validate a control's payload shape for its `type`. Throws `ControlsError`
 * with a clear reason; never mutates. Types not yet consumed by a shipped
 * slice (`rotate`/`fork`/`pin`/`unpin`/`answer`/`ask`) still get a basic
 * shape check here so the channel is ready before their runner-side logic
 * lands (DW-5/DW-7/DW-9) — this file is the single schema owner for all of
 * them, not just DW-4's pause/set-config.
 * @param {string} type
 * @param {object} payload
 */
export function validateControlPayload(type, payload) {
  const p = payload || {};
  switch (type) {
    case "pause":
      if (p.abortInFlight != null && typeof p.abortInFlight !== "boolean") {
        throw new ControlsError('pause.payload.abortInFlight must be a boolean when present');
      }
      return;
    case "resume-run":
      return;
    case "set-config":
      if (p.provider != null && p.provider !== "claude" && p.provider !== "codex") {
        throw new ControlsError('set-config.payload.provider must be "claude" or "codex" when present');
      }
      if (p.model != null && typeof p.model !== "string") {
        throw new ControlsError("set-config.payload.model must be a string when present");
      }
      if (p.effortByPhase != null && typeof p.effortByPhase !== "object") {
        throw new ControlsError("set-config.payload.effortByPhase must be an object when present");
      }
      if (p.provider == null && p.model == null && p.effortByPhase == null) {
        throw new ControlsError("set-config.payload must set at least one of provider/model/effortByPhase");
      }
      return;
    case "set-budget":
      if (p.maxUsd == null && p.maxTokens == null) {
        throw new ControlsError("set-budget.payload must set maxUsd and/or maxTokens");
      }
      if (p.maxUsd != null && (typeof p.maxUsd !== "number" || !Number.isFinite(p.maxUsd) || p.maxUsd <= 0)) {
        throw new ControlsError("set-budget.payload.maxUsd must be a positive number when present");
      }
      if (
        p.maxTokens != null &&
        (typeof p.maxTokens !== "number" || !Number.isInteger(p.maxTokens) || p.maxTokens <= 0)
      ) {
        throw new ControlsError("set-budget.payload.maxTokens must be a positive integer when present");
      }
      if (typeof p.reason !== "string" || !p.reason.trim()) {
        throw new ControlsError("set-budget.payload.reason is required");
      }
      return;
    case "rotate":
      return;
    case "fork":
      if (p.atTurnId != null && typeof p.atTurnId !== "string") {
        throw new ControlsError("fork.payload.atTurnId must be a string when present");
      }
      return;
    case "pin":
      if (typeof p.turnId !== "string" || !p.turnId) throw new ControlsError("pin.payload.turnId is required");
      if (typeof p.seqFrom !== "number" || typeof p.seqTo !== "number") {
        throw new ControlsError("pin.payload.seqFrom/seqTo are required numbers");
      }
      return;
    case "unpin":
      if (typeof p.turnId !== "string" || !p.turnId) throw new ControlsError("unpin.payload.turnId is required");
      return;
    case "answer":
      if (typeof p.questionId !== "string" || !p.questionId) throw new ControlsError("answer.payload.questionId is required");
      if (typeof p.text !== "string" || !p.text.trim()) throw new ControlsError("answer.payload.text is required");
      return;
    case "ask":
      if (typeof p.text !== "string" || !p.text.trim()) throw new ControlsError("ask.payload.text is required");
      return;
    default:
      throw new ControlsError(`unknown control type "${type}"`);
  }
}

/** Does `set-config`'s payload request a provider switch (a handoff, DW-8) rather than an in-place override? */
export function isProviderSwitch(control, currentProvider) {
  return control.type === "set-config" && control.payload.provider != null && control.payload.provider !== currentProvider;
}
