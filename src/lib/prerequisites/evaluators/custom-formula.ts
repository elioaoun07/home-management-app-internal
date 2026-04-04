// src/lib/prerequisites/evaluators/custom-formula.ts
import type { ConditionEvaluator } from "../types";

/**
 * Evaluates a custom user-defined expression. STUB — not yet implemented.
 * config: { expression: string }
 */
export const evaluateCustomFormula: ConditionEvaluator = async () => {
  return {
    met: false,
    reason: "Custom formula evaluation not yet implemented",
  };
};
