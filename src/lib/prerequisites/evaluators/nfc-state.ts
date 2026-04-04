// src/lib/prerequisites/evaluators/nfc-state.ts
import type { ConditionEvaluator } from "../types";

/**
 * Evaluates whether an NFC tag is currently in the target state.
 * config: { tag_id: string, target_state: string }
 */
export const evaluateNfcState: ConditionEvaluator = async (config, context) => {
  const tagId = config.tag_id as string;
  const targetState = config.target_state as string;

  if (!tagId || !targetState) {
    return { met: false, reason: "Missing tag_id or target_state in config" };
  }

  const { data: tag, error } = await context.supabase
    .from("nfc_tags")
    .select("current_state, label")
    .eq("id", tagId)
    .maybeSingle();

  if (error || !tag) {
    return { met: false, reason: `NFC tag not found: ${tagId}` };
  }

  const met = tag.current_state === targetState;
  return {
    met,
    reason: met
      ? `${tag.label} is ${targetState}`
      : `${tag.label} is ${tag.current_state ?? "unset"}, expected ${targetState}`,
  };
};
