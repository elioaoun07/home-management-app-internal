// Server-side completion of items / occurrences, shared by the single route
// (`/api/items/[id]/complete`) and the bulk route (`/api/items/bulk/complete`).
// Data ops use the admin client because a partner completes items they don't own;
// authorization is checked here (creator, responsible user or household partner).
import { syncItemToGoogleCalendar } from "@/lib/gcal/sync";
import { resetCompletedPrerequisiteItem } from "@/lib/prerequisites/engine";
import type { SupabaseClient } from "@supabase/supabase-js";
import { subMonths } from "date-fns";
import { z } from "zod";

// Completed items older than this are archived immediately so the active
// item list doesn't accumulate stale completions. Anything more recent stays
// visible (with its strikethrough) until the user archives/deletes it
// explicitly. See ERA Notes/02 - Standalone Modules/Items & Reminders/Overview.md.
const ARCHIVE_COMPLETED_OLDER_THAN_MONTHS = 1;

/** Entries per bulk request (a chore done in every room is ~10). */
export const BULK_COMPLETE_MAX = 50;

const completeEntrySchema = z.object({
  item_id: z.string().uuid(),
  occurrence_date: z.string().min(1),
  is_recurring: z.boolean(),
  planned_for: z.string().min(1).optional(),
});

export const bulkCompleteSchema = z.object({
  entries: z.array(completeEntrySchema).min(1).max(BULK_COMPLETE_MAX),
});

export const bulkUncompleteSchema = z.object({
  entries: z
    .array(completeEntrySchema.omit({ planned_for: true }))
    .min(1)
    .max(BULK_COMPLETE_MAX),
});

export type BulkCompleteEntry = z.infer<typeof completeEntrySchema>;
export type BulkUncompleteEntry = z.infer<
  typeof bulkUncompleteSchema
>["entries"][number];

export interface CompleteInput {
  occurrence_date: string;
  is_recurring: boolean;
  actual_minutes?: number;
  reason?: string;
  planned_for?: string;
}

export type CompleteOutcome =
  | { ok: true; type: "occurrence"; action: Record<string, unknown> }
  | {
      ok: true;
      type: "item";
      itemId: string;
      archived: boolean;
      resetToDormant: boolean;
    }
  | { ok: false; status: 403 | 404 | 500; error: string };

interface ItemAccessRow {
  id: string;
  user_id: string;
  responsible_user_id: string | null;
}

function buildCompletionMetadata({
  actualMinutes,
  plannedFor,
}: {
  actualMinutes?: number;
  plannedFor?: string;
}) {
  const metadata: Record<string, unknown> = {};
  if (typeof actualMinutes === "number" && actualMinutes >= 0) {
    metadata.actual_minutes = actualMinutes;
  }
  if (plannedFor) {
    metadata.planned_for = plannedFor;
  }
  return Object.keys(metadata).length > 0 ? metadata : null;
}

/** Creator, responsible user, or any active household partner of the creator. */
async function loadAuthorizedItem(
  adminDb: SupabaseClient,
  userId: string,
  itemId: string,
): Promise<{ item: ItemAccessRow } | { status: 403 | 404; error: string }> {
  const { data: item, error } = await adminDb
    .from("items")
    .select("id, user_id, responsible_user_id")
    .eq("id", itemId)
    .single();
  if (error || !item) return { status: 404, error: "Item not found" };

  if (item.user_id === userId || item.responsible_user_id === userId) {
    return { item };
  }
  const { data: link } = await adminDb
    .from("household_links")
    .select("id")
    .eq("active", true)
    .or(
      `and(owner_user_id.eq.${item.user_id},partner_user_id.eq.${userId}),` +
        `and(owner_user_id.eq.${userId},partner_user_id.eq.${item.user_id})`,
    )
    .maybeSingle();
  return link ? { item } : { status: 403, error: "Forbidden" };
}

/**
 * Complete one item (non-recurring) or one occurrence (recurring / flexible).
 * Idempotent: the action row is upserted on item_id+occurrence_date+action_type,
 * so a retry or an offline replay returns the same result.
 * `syncCalendar: false` leaves the Google backup to the caller (bulk defers it).
 */
export async function completeItemForUser(
  adminDb: SupabaseClient,
  userId: string,
  itemId: string,
  input: CompleteInput,
  { syncCalendar = true }: { syncCalendar?: boolean } = {},
): Promise<CompleteOutcome> {
  const access = await loadAuthorizedItem(adminDb, userId, itemId);
  if (!("item" in access)) return { ok: false, ...access };

  const { occurrence_date, is_recurring, actual_minutes, reason, planned_for } =
    input;
  const metadata_json = buildCompletionMetadata({
    actualMinutes: actual_minutes,
    plannedFor: planned_for,
  });
  const actionRow = {
    item_id: itemId,
    occurrence_date,
    action_type: "completed",
    reason: reason || null,
    created_by: userId,
    metadata_json,
  };

  if (is_recurring) {
    // Upsert (not insert) so a retry/double-tap/offline-replay of a
    // completion that already succeeded is idempotent instead of hitting
    // the item_id+occurrence_date+action_type unique constraint as a 500.
    const { data, error } = await adminDb
      .from("item_occurrence_actions")
      .upsert(actionRow, { onConflict: "item_id,occurrence_date,action_type" })
      .select()
      .single();
    if (error) return { ok: false, status: 500, error: error.message };
    return { ok: true, type: "occurrence", action: data };
  }

  // Auto-archive only kicks in for occurrences more than a month old —
  // completing something due this week or last week keeps it visible.
  const shouldArchive =
    new Date(occurrence_date) <
    subMonths(new Date(), ARCHIVE_COMPLETED_OLDER_THAN_MONTHS);

  const updatePayload: Record<string, string> = {
    status: "completed",
    updated_at: new Date().toISOString(),
  };
  if (shouldArchive) {
    updatePayload.archived_at = new Date().toISOString();
  }

  // Update item status + record action in parallel
  const [itemResult] = await Promise.all([
    adminDb.from("items").update(updatePayload).eq("id", itemId),
    adminDb
      .from("item_occurrence_actions")
      .upsert(actionRow, { onConflict: "item_id,occurrence_date,action_type" }),
  ]);
  if (itemResult.error) {
    return { ok: false, status: 500, error: itemResult.error.message };
  }

  // Also update reminder_details if it exists
  await adminDb
    .from("reminder_details")
    .update({
      completed_at: new Date().toISOString(),
      ...(typeof actual_minutes === "number" && actual_minutes >= 0
        ? { actual_minutes }
        : {}),
    })
    .eq("item_id", itemId);

  // Cascade: deactivate any active alerts (non-recurring item is done)
  await adminDb
    .from("item_alerts")
    .update({ active: false })
    .eq("item_id", itemId)
    .eq("active", true);

  // If this item has prerequisites, reset it to dormant for next trigger
  const wasReset = await resetCompletedPrerequisiteItem(itemId, adminDb);

  // Best-effort: a completed (non-recurring) item is no longer
  // sync-eligible, so this removes its Google Calendar backup event.
  if (syncCalendar) await syncItemToGoogleCalendar(adminDb, itemId);

  return {
    ok: true,
    type: "item",
    itemId,
    archived: shouldArchive,
    resetToDormant: wasReset,
  };
}

/**
 * Undo of a completion: a recurring occurrence loses its completed action; a
 * one-off goes back to pending with its alerts on again. Idempotent.
 */
export async function uncompleteItemForUser(
  adminDb: SupabaseClient,
  userId: string,
  entry: BulkUncompleteEntry,
): Promise<{ ok: true } | { ok: false; status: 403 | 404 | 500; error: string }> {
  const access = await loadAuthorizedItem(adminDb, userId, entry.item_id);
  if (!("item" in access)) return { ok: false, ...access };

  if (entry.is_recurring) {
    const { error } = await adminDb
      .from("item_occurrence_actions")
      .delete()
      .eq("item_id", entry.item_id)
      .eq("action_type", "completed")
      .eq("occurrence_date", entry.occurrence_date);
    return error ? { ok: false, status: 500, error: error.message } : { ok: true };
  }

  const { error } = await adminDb
    .from("items")
    .update({
      status: "pending",
      archived_at: null,
      updated_at: new Date().toISOString(),
    })
    .eq("id", entry.item_id);
  if (error) return { ok: false, status: 500, error: error.message };
  await Promise.all([
    adminDb
      .from("reminder_details")
      .update({ completed_at: null })
      .eq("item_id", entry.item_id),
    adminDb
      .from("item_occurrence_actions")
      .delete()
      .eq("item_id", entry.item_id)
      .eq("action_type", "completed"),
    adminDb
      .from("item_alerts")
      .update({ active: true })
      .eq("item_id", entry.item_id),
  ]);
  return { ok: true };
}
