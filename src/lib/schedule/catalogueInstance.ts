// Build the create input for a one-off item instantiated from a Catalogue
// template at a chosen due time. Shared by the general Assign view and Chores
// so both create the same shape: template fields copied, `is_chore` carried
// over, and one push alert at the due time.

import type { CatalogueItem } from "@/types/catalogue";
import type {
  CreateReminderInput,
  CreateSubtaskInput,
  CreateTaskInput,
  ItemPriority,
} from "@/types/items";
import type { CreatePrerequisiteInput } from "@/types/prerequisites";

/** Fallback when a template has no preferred time (existing Assign default). */
export const TEMPLATE_DEFAULT_TIME = "09:00";

export function parseTemplateSubtasks(
  text: string | null | undefined,
): CreateSubtaskInput[] {
  if (!text) return [];
  return text
    .split("\n")
    .map((line) => line.trim())
    .filter(Boolean)
    .map((line, index) => ({
      title: line.replace(/^[-*•]\s*|\d+\.\s*/g, "").trim(),
      order_index: index,
    }))
    .filter((subtask) => subtask.title.length > 0);
}

export function templateItemType(
  type: CatalogueItem["item_type"],
): "reminder" | "task" {
  return type === "reminder" ? "reminder" : "task";
}

function toItemPriority(priority: CatalogueItem["priority"]): ItemPriority {
  return priority === "critical" ? "urgent" : priority;
}

export function buildTemplateInstanceInput(
  tpl: CatalogueItem,
  dueAtIso: string,
  responsibleUserId: string | undefined,
  options: { allDay?: boolean } = {},
): CreateReminderInput | CreateTaskInput {
  const subtasks = parseTemplateSubtasks(tpl.subtasks_text);
  const duration =
    typeof tpl.preferred_duration_minutes === "number" &&
    tpl.preferred_duration_minutes > 0
      ? tpl.preferred_duration_minutes
      : undefined;
  const base = {
    title: tpl.name,
    description: tpl.description || undefined,
    priority: toItemPriority(tpl.priority),
    is_public: tpl.is_public,
    responsible_user_id: responsibleUserId,
    due_at: dueAtIso,
    estimate_minutes: duration,
    // All-day placements carry no time, so nothing to alert at
    alerts: options.allDay
      ? []
      : [
          {
            kind: "absolute" as const,
            trigger_at: dueAtIso,
            channel: "push" as const,
          },
        ],
    metadata_json: options.allDay ? { all_day: true } : undefined,
    category_ids: tpl.item_category_ids?.length
      ? tpl.item_category_ids
      : undefined,
    location_context: tpl.location_context ?? undefined,
    location_text: tpl.location_url ?? undefined,
    prerequisites:
      (tpl.metadata_json?.trigger_conditions as
        | CreatePrerequisiteInput[]
        | undefined) || undefined,
    source_catalogue_item_id: tpl.id,
    is_template_instance: true,
    is_chore: tpl.is_chore || false,
  };

  if (templateItemType(tpl.item_type) === "reminder") {
    return {
      ...base,
      type: "reminder",
      has_checklist: subtasks.length > 0,
      subtasks,
    };
  }
  return {
    ...base,
    type: "task",
    subtasks: subtasks.length > 0 ? subtasks : undefined,
  };
}
