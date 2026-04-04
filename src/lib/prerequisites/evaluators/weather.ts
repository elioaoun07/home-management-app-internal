// src/lib/prerequisites/evaluators/weather.ts
import type { ConditionEvaluator } from "../types";

/**
 * Evaluates weather conditions. STUB — not yet implemented.
 * config: { condition: string, location: string }
 */
export const evaluateWeather: ConditionEvaluator = async () => {
  return {
    met: false,
    reason: "Weather condition evaluation not yet implemented",
  };
};
