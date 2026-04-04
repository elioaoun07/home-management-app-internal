// src/lib/prerequisites/evaluators/time-window.ts
import type { ConditionEvaluator } from "../types";

/**
 * Evaluates whether the current time falls within a specified window. STUB — not yet implemented.
 * config: { start: "HH:MM", end: "HH:MM", days?: string[] }
 */
export const evaluateTimeWindow: ConditionEvaluator = async () => {
  return { met: false, reason: "Time window evaluation not yet implemented" };
};
