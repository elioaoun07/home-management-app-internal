// src/app/api/items/[id]/complete/route.ts
// Server-side item completion endpoint for service worker quick actions
import { resetCompletedPrerequisiteItem } from "@/lib/prerequisites/engine";
import { supabaseAdmin } from "@/lib/supabase/admin";
import { supabaseServer } from "@/lib/supabase/server";
import { subMonths } from "date-fns";
import { NextRequest, NextResponse } from "next/server";

// Completed items older than this are archived immediately so the active
// item list doesn't accumulate stale completions. Anything more recent stays
// visible (with its strikethrough) until the user archives/deletes it
// explicitly. See ERA Notes/02 - Standalone Modules/Items & Reminders/Overview.md.
const ARCHIVE_COMPLETED_OLDER_THAN_MONTHS = 1;

interface CompleteRequestBody {
  occurrence_date: string;
  is_recurring: boolean;
  actual_minutes?: number;
  reason?: string;
  planned_for?: string;
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

export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  try {
    // Use supabaseServer only for authentication; adminDb for all data ops (bypasses RLS)
    const supabase = await supabaseServer();
    const {
      data: { user },
    } = await supabase.auth.getUser();

    if (!user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const adminDb = supabaseAdmin();

    const { id: itemId } = await params;
    const body: CompleteRequestBody = await request.json();
    const {
      occurrence_date,
      is_recurring,
      actual_minutes,
      reason,
      planned_for,
    } = body;
    const metadata_json = buildCompletionMetadata({
      actualMinutes: actual_minutes,
      plannedFor: planned_for,
    });

    if (!occurrence_date) {
      return NextResponse.json(
        { error: "occurrence_date is required" },
        { status: 400 },
      );
    }

    // Fetch item via adminDb to bypass RLS (partner's token would be blocked otherwise)
    const { data: item, error: itemError } = await adminDb
      .from("items")
      .select(
        "id, user_id, status, type, responsible_user_id, notify_all_household, is_public",
      )
      .eq("id", itemId)
      .single();

    if (itemError || !item) {
      return NextResponse.json({ error: "Item not found" }, { status: 404 });
    }

    // Authorization: creator, responsible user, or any household partner
    const isCreator = item.user_id === user.id;
    const isResponsible = item.responsible_user_id === user.id;
    let canComplete = isCreator || isResponsible;

    if (!canComplete) {
      const { data: link } = await adminDb
        .from("household_links")
        .select("id")
        .eq("active", true)
        .or(
          `and(owner_user_id.eq.${item.user_id},partner_user_id.eq.${user.id}),` +
            `and(owner_user_id.eq.${user.id},partner_user_id.eq.${item.user_id})`,
        )
        .maybeSingle();
      canComplete = !!link;
    }

    if (!canComplete) {
      return NextResponse.json({ error: "Forbidden" }, { status: 403 });
    }

    if (is_recurring) {
      // For recurring items: record completion of this occurrence
      const { data, error } = await adminDb
        .from("item_occurrence_actions")
        .insert({
          item_id: itemId,
          occurrence_date,
          action_type: "completed",
          reason: reason || null,
          created_by: user.id,
          metadata_json,
        })
        .select()
        .single();

      if (error) {
        return NextResponse.json({ error: error.message }, { status: 500 });
      }

      return NextResponse.json({
        success: true,
        action: data,
        type: "occurrence",
      });
    } else {
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
      const [itemResult, actionResult] = await Promise.all([
        adminDb.from("items").update(updatePayload).eq("id", itemId),
        adminDb.from("item_occurrence_actions").insert({
          item_id: itemId,
          occurrence_date,
          action_type: "completed",
          reason: reason || null,
          created_by: user.id,
          metadata_json,
        }),
      ]);

      if (itemResult.error) {
        return NextResponse.json(
          { error: itemResult.error.message },
          { status: 500 },
        );
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

      return NextResponse.json({
        success: true,
        type: "item",
        itemId,
        archived: shouldArchive,
        resetToDormant: wasReset,
      });
    }
  } catch (error) {
    console.error("[item-complete] Unexpected error:", error);
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 },
    );
  }
}
