// src/lib/prerequisites/evaluators/schedule.ts
import type { ConditionEvaluator } from "../types";

/**
 * Evaluates a cron-like schedule condition. STUB — not yet implemented.
 * config: { cron: string }
 */
export const evaluateSchedule: ConditionEvaluator = async () => {
  return { met: false, reason: "Schedule evaluation not yet implemented" };
};
