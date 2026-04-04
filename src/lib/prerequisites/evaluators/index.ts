// src/lib/prerequisites/evaluators/index.ts
import type { PrerequisiteConditionType } from "@/types/prerequisites";
import type { ConditionEvaluator } from "../types";
import { evaluateCustomFormula } from "./custom-formula";
import { evaluateItemCompleted } from "./item-completed";
import { evaluateNfcState } from "./nfc-state";
import { evaluateSchedule } from "./schedule";
import { evaluateTimeWindow } from "./time-window";
import { evaluateWeather } from "./weather";

/** Registry mapping condition types to their evaluator functions */
export const evaluatorRegistry: Record<
  PrerequisiteConditionType,
  ConditionEvaluator
> = {
  nfc_state_change: evaluateNfcState,
  item_completed: evaluateItemCompleted,
  weather: evaluateWeather,
  time_window: evaluateTimeWindow,
  schedule: evaluateSchedule,
  custom_formula: evaluateCustomFormula,
};
