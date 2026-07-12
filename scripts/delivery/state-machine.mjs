// scripts/delivery/state-machine.mjs
// Pure delivery-session transition table.
// See ERA Notes/10 - Project Management/Agentic Delivery Workspace/3 - State Machine, Packet & Classifier.md §2.
//
// Zero-dependency: `next(state, event, context)` is a pure function that either
// returns `{to, effects}` (effects are opaque string tokens for the runner to
// interpret in a later slice) or throws a StateMachineError. Nothing here reads
// files, spawns processes, or touches state.json — that orchestration is S2+.

export const STATES = Object.freeze([
  "SELECTED",
  "DISCOVERY",
  "SPEC_READY",
  "PLAN_READY",
  "BUILDING",
  "VALIDATING",
  "REVIEWING",
  "UAT_READY",
  "ACCEPTED",
  "SHIPPED",
  "BLOCKED",
  "NEEDS_DECISION",
  "FAILED",
  "CANCELLED",
]);

/** Hard-coded human gates — not configurable off (doc 3 §2). */
export const GATES = Object.freeze({
  SPEC_READY: "spec",
  PLAN_READY: "plan",
  UAT_READY: "uat",
});

/** Terminal states: no transition ever leaves them. */
export const TERMINAL_STATES = Object.freeze(["SHIPPED", "CANCELLED", "FAILED"]);

/**
 * States eligible for the universal `question.raised` / `error.fatal` events —
 * i.e. every state where the session is doing (or waiting on) real work.
 * Deliberately excludes BLOCKED/NEEDS_DECISION (already paused) and every
 * terminal state.
 */
export const ACTIVE_STATES = Object.freeze([
  "SELECTED",
  "DISCOVERY",
  "SPEC_READY",
  "PLAN_READY",
  "BUILDING",
  "VALIDATING",
  "REVIEWING",
  "UAT_READY",
  "ACCEPTED",
]);

/** States eligible for `decision.cancel` — everything short of a terminal state. */
export const NON_TERMINAL_STATES = Object.freeze([
  ...ACTIVE_STATES,
  "BLOCKED",
  "NEEDS_DECISION",
]);

/** Risk flags that require the owner to type `APPROVE` at the plan gate (doc 3 §2, doc 4 §4). */
export const TYPED_APPROVAL_RISK_FLAGS = Object.freeze(["db-migration", "security"]);

export class StateMachineError extends Error {
  constructor(message, code) {
    super(message);
    this.name = "StateMachineError";
    this.code = code || "ILLEGAL_TRANSITION";
  }
}

function requiresTypedApproval(context) {
  const riskFlags = (context && context.riskFlags) || [];
  return riskFlags.some((f) => TYPED_APPROVAL_RISK_FLAGS.includes(f));
}

function fixLoopExhausted(context) {
  const loopCount = (context && context.loopCount) || 0;
  const maxFixLoops = context && context.maxFixLoops != null ? context.maxFixLoops : 3;
  return loopCount >= maxFixLoops;
}

/** Per-state event handlers. Each returns `{to, effects}` or throws. */
const PRIMARY = {
  SELECTED: {
    "baseline.captured": () => ({
      to: "DISCOVERY",
      effects: ["snapshotBaseline", "startPrimaryThread"],
    }),
    "baseline.failed": () => ({ to: "FAILED", effects: ["recordSetupFailure"] }),
  },
  DISCOVERY: {
    "spec.written": () => ({
      to: "SPEC_READY",
      effects: ["writeArtifact:spec.md", "awaitGate:spec"],
    }),
  },
  SPEC_READY: {
    "decision.approve": () => ({
      to: "PLAN_READY",
      effects: ["confirmCapabilities", "startPlanTurn", "awaitGate:plan"],
    }),
    "decision.reject": () => ({ to: "DISCOVERY", effects: ["reviseSpec"] }),
  },
  PLAN_READY: {
    "decision.approve": (context) => {
      if (requiresTypedApproval(context) && (context || {}).confirmText !== "APPROVE") {
        throw new StateMachineError(
          "plan approval requires typed confirmText \"APPROVE\" when riskFlags include db-migration or security",
          "APPROVAL_TEXT_REQUIRED",
        );
      }
      return { to: "BUILDING", effects: ["startBuilding"] };
    },
    "decision.reject": () => ({ to: "DISCOVERY", effects: ["revisePlan"] }),
  },
  BUILDING: {
    "build.step.done": () => ({ to: "BUILDING", effects: ["appendBuildLog"] }),
    "build.complete": () => ({ to: "VALIDATING", effects: ["runValidation"] }),
  },
  VALIDATING: {
    "validation.pass": () => ({
      to: "REVIEWING",
      effects: ["writeValidationReport", "startReview"],
    }),
    "validation.fail": (context) => {
      if (fixLoopExhausted(context)) {
        return { to: "BLOCKED", effects: ["awaitGate:blocked"] };
      }
      return { to: "BUILDING", effects: ["fixTurn", "incrementFixLoop"] };
    },
  },
  REVIEWING: {
    "reviews.pass": () => ({ to: "UAT_READY", effects: ["assembleUat", "awaitGate:uat"] }),
    "reviews.blocking": (context) => {
      if (fixLoopExhausted(context)) {
        return { to: "BLOCKED", effects: ["awaitGate:blocked"] };
      }
      return { to: "BUILDING", effects: ["fixTurn", "incrementFixLoop"] };
    },
  },
  UAT_READY: {
    "decision.accept": () => ({ to: "ACCEPTED", effects: ["writebackCheckbox"] }),
    "decision.reject": () => ({
      to: "BUILDING",
      effects: ["fixTurn", "incrementFixLoop"],
    }),
  },
  ACCEPTED: {
    "decision.shipped": () => ({ to: "SHIPPED", effects: ["recordShippedHead"] }),
  },
  NEEDS_DECISION: {
    "decision.answer": (context) => {
      const returnTo = context && context.returnTo;
      if (!returnTo || !STATES.includes(returnTo)) {
        throw new StateMachineError(
          "decision.answer requires a valid context.returnTo state",
          "MISSING_RETURN_TO",
        );
      }
      return { to: returnTo, effects: ["injectAnswer"] };
    },
  },
  BLOCKED: {
    "decision.retry": (context) => {
      const returnTo = context && context.returnTo;
      if (!returnTo || !STATES.includes(returnTo)) {
        throw new StateMachineError(
          "decision.retry requires a valid context.returnTo state",
          "MISSING_RETURN_TO",
        );
      }
      return { to: returnTo, effects: ["reenterPhase"] };
    },
  },
};

/**
 * Universal events, checked only when no state-specific handler matched.
 * Returns `{to, effects}` or null if the event isn't universally legal from this state.
 */
function universal(state, event) {
  if (event === "question.raised" && ACTIVE_STATES.includes(state)) {
    return {
      to: "NEEDS_DECISION",
      effects: ["writeQuestionArtifact", "awaitGate:question"],
      returnTo: state,
    };
  }
  if (event === "error.fatal" && ACTIVE_STATES.includes(state)) {
    return { to: "BLOCKED", effects: ["recordError", "awaitGate:blocked"], returnTo: state };
  }
  if (event === "decision.cancel" && NON_TERMINAL_STATES.includes(state)) {
    return { to: "CANCELLED", effects: ["listChangedFiles", "showRevertInstructions"] };
  }
  if (event === "runner.crashed" && NON_TERMINAL_STATES.includes(state)) {
    // State is kept as-is; the dashboard shows a stale badge + Resume affordance.
    return { to: state, effects: ["staleBadge"] };
  }
  return null;
}

/**
 * Pure transition function.
 * @param {string|null} state - current state, or null only for the initial `session.start` event.
 * @param {string} event
 * @param {object} [context] - extra data some transitions need (riskFlags, confirmText, loopCount,
 *   maxFixLoops, returnTo).
 * @returns {{to: string, effects: string[]}}
 * @throws {StateMachineError} on any (state, event) pair that isn't a legal transition.
 */
export function next(state, event, context = {}) {
  if (state == null) {
    if (event === "session.start") {
      return { to: "SELECTED", effects: ["createPacket", "createSessionDir", "spawnRunner"] };
    }
    throw new StateMachineError(
      `illegal event "${event}" with no session started (only "session.start" is legal)`,
      "ILLEGAL_TRANSITION",
    );
  }
  if (!STATES.includes(state)) {
    throw new StateMachineError(`unknown state: ${state}`, "UNKNOWN_STATE");
  }

  const handler = PRIMARY[state] && PRIMARY[state][event];
  if (handler) {
    const result = handler(context);
    return { to: result.to, effects: result.effects };
  }

  const universalResult = universal(state, event);
  if (universalResult) {
    return { to: universalResult.to, effects: universalResult.effects };
  }

  throw new StateMachineError(
    `illegal transition: (${state}, ${event})`,
    "ILLEGAL_TRANSITION",
  );
}

export function isTerminal(state) {
  return TERMINAL_STATES.includes(state);
}

export function isGate(state) {
  return Object.prototype.hasOwnProperty.call(GATES, state);
}

export function gateFor(state) {
  return GATES[state] || null;
}
