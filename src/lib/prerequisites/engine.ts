// src/lib/prerequisites/engine.ts
// Prerequisite evaluation engine — evaluates conditions and activates dormant items

import type {
  ConditionResult,
  PrerequisiteConditionType,
  TriggerEvent,
} from "@/types/prerequisites";
import type { SupabaseClient } from "@supabase/supabase-js";
import { evaluatorRegistry } from "./evaluators";
import type { EvaluationContext } from "./types";

interface PrerequisiteRow {
  id: string;
  item_id: string;
  condition_type: PrerequisiteConditionType;
  condition_config: Record<string, unknown>;
  logic_group: number;
  is_active: boolean;
}

interface TriggeredItemResult {
  id: string;
  title: string;
  type: string;
  priority: string;
  subtasks: Array<{
    id: string;
    title: string;
    done_at: string | null;
    order_index: number;
  }>;
}

/**
 * Evaluate all prerequisites for a specific item.
 * Logic: prerequisites in the same logic_group are ANDed;
 * different groups are ORed.
 * Returns true if ANY group has ALL conditions met.
 */
export async function evaluateItemPrerequisites(
  itemId: string,
  supabase: SupabaseClient,
  userId: string,
): Promise<{ met: boolean; results: ConditionResult[] }> {
  const { data: prerequisites } = await supabase
    .from("item_prerequisites")
    .select("*")
    .eq("item_id", itemId)
    .eq("is_active", true);

  if (!prerequisites || prerequisites.length === 0) {
    return { met: true, results: [] };
  }

  const context: EvaluationContext = { supabase, userId };
  const results: ConditionResult[] = [];

  // Group by logic_group
  const groups = new Map<number, PrerequisiteRow[]>();
  for (const prereq of prerequisites as PrerequisiteRow[]) {
    const group = groups.get(prereq.logic_group) ?? [];
    group.push(prereq);
    groups.set(prereq.logic_group, group);
  }

  // OR across groups, AND within each group
  let anyGroupMet = false;

  for (const [, groupPrereqs] of groups) {
    let allInGroupMet = true;

    for (const prereq of groupPrereqs) {
      const evaluator = evaluatorRegistry[prereq.condition_type];
      if (!evaluator) {
        const result: ConditionResult = {
          prerequisite_id: prereq.id,
          condition_type: prereq.condition_type,
          met: false,
          reason: `Unknown condition type: ${prereq.condition_type}`,
        };
        results.push(result);
        allInGroupMet = false;
        continue;
      }

      const evalResult = await evaluator(prereq.condition_config, context);
      const result: ConditionResult = {
        prerequisite_id: prereq.id,
        condition_type: prereq.condition_type,
        met: evalResult.met,
        reason: evalResult.reason,
      };
      results.push(result);

      // Update last_evaluated_at and last_result
      await supabase
        .from("item_prerequisites")
        .update({
          last_evaluated_at: new Date().toISOString(),
          last_result: evalResult.met,
          updated_at: new Date().toISOString(),
        })
        .eq("id", prereq.id);

      if (!evalResult.met) {
        allInGroupMet = false;
      }
    }

    if (allInGroupMet) {
      anyGroupMet = true;
      // Short-circuit: at least one group passed (OR logic)
      break;
    }
  }

  return { met: anyGroupMet, results };
}

/**
 * Given a trigger event, find all dormant items whose prerequisites
 * are now met, activate them, and return the activated items with subtasks.
 */
export async function findAndActivateTriggeredItems(
  event: TriggerEvent,
  supabase: SupabaseClient,
  userId: string,
): Promise<TriggeredItemResult[]> {
  // Find dormant items that have a prerequisite matching this event type
  let conditionType: PrerequisiteConditionType;
  let configFilter: Record<string, unknown>;

  switch (event.type) {
    case "nfc_state_change":
      conditionType = "nfc_state_change";
      configFilter = { tag_id: event.tag_id, target_state: event.new_state };
      break;
    case "item_completed":
      conditionType = "item_completed";
      configFilter = { prerequisite_item_id: event.item_id };
      break;
    default:
      return [];
  }

  // Find prerequisites matching this event
  // We need to find item_prerequisites where condition_type matches
  // and the condition_config contains the relevant keys
  const { data: matchingPrereqs } = await supabase
    .from("item_prerequisites")
    .select("item_id")
    .eq("condition_type", conditionType)
    .eq("is_active", true)
    .containedBy("condition_config", configFilter);

  // Also try contains filter (containedBy may be too strict)
  const { data: matchingPrereqs2 } = await supabase
    .from("item_prerequisites")
    .select("item_id")
    .eq("condition_type", conditionType)
    .eq("is_active", true)
    .contains("condition_config", configFilter);

  // Merge unique item IDs
  const preReqItems = matchingPrereqs2 ?? matchingPrereqs ?? [];
  const candidateItemIds = [
    ...new Set(preReqItems.map((p: { item_id: string }) => p.item_id)),
  ];

  if (candidateItemIds.length === 0) {
    return [];
  }

  // Filter to only dormant items owned by user or household
  const { data: dormantItems } = await supabase
    .from("items")
    .select("id")
    .in("id", candidateItemIds)
    .eq("status", "dormant");

  if (!dormantItems || dormantItems.length === 0) {
    return [];
  }

  // Fully evaluate all prerequisites for each dormant candidate
  const activatedIds: string[] = [];
  for (const item of dormantItems) {
    const evaluation = await evaluateItemPrerequisites(
      item.id,
      supabase,
      userId,
    );
    if (evaluation.met) {
      activatedIds.push(item.id);
    }
  }

  if (activatedIds.length === 0) {
    return [];
  }

  // Activate: dormant → pending
  await supabase
    .from("items")
    .update({
      status: "pending",
      updated_at: new Date().toISOString(),
    })
    .in("id", activatedIds);

  // Fetch activated items with subtasks for the response
  const { data: activatedItems } = await supabase
    .from("items")
    .select("id, title, type, priority")
    .in("id", activatedIds);

  if (!activatedItems) return [];

  const results: TriggeredItemResult[] = [];
  for (const item of activatedItems) {
    const { data: subtasks } = await supabase
      .from("item_subtasks")
      .select("id, title, done_at, order_index")
      .eq("parent_item_id", item.id)
      .order("order_index", { ascending: true });

    results.push({
      id: item.id,
      title: item.title,
      type: item.type,
      priority: item.priority,
      subtasks: subtasks ?? [],
    });
  }

  return results;
}

/**
 * When a prerequisite-backed item is completed, reset it to dormant
 * so it can be triggered again next time.
 */
export async function resetCompletedPrerequisiteItem(
  itemId: string,
  supabase: SupabaseClient,
): Promise<boolean> {
  // Check if this item has any active prerequisites
  const { data: prereqs } = await supabase
    .from("item_prerequisites")
    .select("id")
    .eq("item_id", itemId)
    .eq("is_active", true)
    .limit(1);

  if (!prereqs || prereqs.length === 0) {
    return false; // Not a prerequisite-backed item
  }

  // Reset status to dormant
  await supabase
    .from("items")
    .update({
      status: "dormant",
      updated_at: new Date().toISOString(),
    })
    .eq("id", itemId);

  // Reset subtask completions for this item (so checklist is fresh next trigger)
  await supabase
    .from("item_subtasks")
    .update({
      done_at: null,
      updated_at: new Date().toISOString(),
    })
    .eq("parent_item_id", itemId);

  return true;
}
