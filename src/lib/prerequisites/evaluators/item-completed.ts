// src/lib/prerequisites/evaluators/item-completed.ts
import type { ConditionEvaluator } from "../types";

/**
 * Evaluates whether a prerequisite item has been completed.
 * config: { prerequisite_item_id: string }
 */
export const evaluateItemCompleted: ConditionEvaluator = async (
  config,
  context,
) => {
  const itemId = config.prerequisite_item_id as string;

  if (!itemId) {
    return { met: false, reason: "Missing prerequisite_item_id in config" };
  }

  const { data: item, error } = await context.supabase
    .from("items")
    .select("status, title")
    .eq("id", itemId)
    .maybeSingle();

  if (error || !item) {
    return { met: false, reason: `Prerequisite item not found: ${itemId}` };
  }

  const met = item.status === "completed";
  return {
    met,
    reason: met
      ? `"${item.title}" is completed`
      : `"${item.title}" is ${item.status}`,
  };
};
