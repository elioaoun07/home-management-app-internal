// src/app/api/items/[id]/actions/route.ts
// API route for item actions: complete, postpone, cancel
// Used by offline sync engine for replay

import { supabaseServer } from "@/lib/supabase/server";
import { NextRequest, NextResponse } from "next/server";

export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  try {
    const supabase = await supabaseServer();
    const {
      data: { user },
    } = await supabase.auth.getUser();

    if (!user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const { id: itemId } = await params;
    const body = await request.json();
    const {
      action,
      occurrence_date,
      is_recurring,
      reason,
      postponed_to,
      postpone_type,
    } = body;

    if (!action || !["complete", "postpone", "cancel"].includes(action)) {
      return NextResponse.json(
        { error: "Invalid action. Must be complete, postpone, or cancel." },
        { status: 400 },
      );
    }

    if (!occurrence_date) {
      return NextResponse.json(
        { error: "occurrence_date is required" },
        { status: 400 },
      );
    }

    // Verify item exists
    const { data: item, error: itemFetchError } = await supabase
      .from("items")
      .select("id, user_id, type, status")
      .eq("id", itemId)
      .single();

    if (itemFetchError || !item) {
      return NextResponse.json({ error: "Item not found" }, { status: 404 });
    }

    // === COMPLETE ===
    if (action === "complete") {
      if (is_recurring) {
        const { data, error } = await supabase
          .from("item_occurrence_actions")
          .insert({
            item_id: itemId,
            occurrence_date,
            action_type: "completed",
            reason: reason || null,
            created_by: user.id,
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
        // Non-recurring: determine if should archive
        const occurrenceDateObj = new Date(occurrence_date);
        const now = new Date();
        const weekStart = new Date(now);
        const dayOfWeek = now.getDay();
        const daysFromMonday = (dayOfWeek + 6) % 7;
        weekStart.setDate(now.getDate() - daysFromMonday);
        weekStart.setHours(0, 0, 0, 0);

        const shouldArchive = occurrenceDateObj < weekStart;
        const updatePayload: Record<string, unknown> = {
          status: "completed",
          updated_at: new Date().toISOString(),
        };
        if (shouldArchive) {
          updatePayload.archived_at = new Date().toISOString();
        }

        const [itemResult, actionResult] = await Promise.all([
          supabase.from("items").update(updatePayload).eq("id", itemId),
          supabase.from("item_occurrence_actions").insert({
            item_id: itemId,
            occurrence_date,
            action_type: "completed",
            reason: reason || null,
            created_by: user.id,
          }),
        ]);

        if (itemResult.error) {
          return NextResponse.json(
            { error: itemResult.error.message },
            { status: 500 },
          );
        }

        // Also update reminder details
        await supabase
          .from("reminder_details")
          .update({ completed_at: new Date().toISOString() })
          .eq("item_id", itemId);

        return NextResponse.json({
          success: true,
          type: "item",
          itemId,
          archived: shouldArchive,
        });
      }
    }

    // === POSTPONE ===
    if (action === "postpone") {
      if (!postponed_to) {
        return NextResponse.json(
          { error: "postponed_to is required for postpone action" },
          { status: 400 },
        );
      }

      const { data, error } = await supabase
        .from("item_occurrence_actions")
        .insert({
          item_id: itemId,
          occurrence_date,
          action_type: "postponed",
          postponed_to,
          postpone_type: postpone_type || null,
          reason: reason || null,
          created_by: user.id,
        })
        .select()
        .single();

      if (error) {
        return NextResponse.json({ error: error.message }, { status: 500 });
      }

      // For non-recurring items, update the due date and alerts
      if (!is_recurring && postponed_to) {
        await supabase
          .from("reminder_details")
          .update({ due_at: postponed_to })
          .eq("item_id", itemId);

        await supabase
          .from("event_details")
          .update({ start_at: postponed_to })
          .eq("item_id", itemId);

        // Recalculate alert trigger times
        const { data: alerts } = await supabase
          .from("item_alerts")
          .select("id, kind, offset_minutes")
          .eq("item_id", itemId)
          .eq("active", true);

        if (alerts?.length) {
          const postponedDate = new Date(postponed_to);
          for (const alert of alerts) {
            let newTriggerAt = postponed_to;
            if (alert.kind === "relative" && alert.offset_minutes) {
              newTriggerAt = new Date(
                postponedDate.getTime() - alert.offset_minutes * 60 * 1000,
              ).toISOString();
            }
            await supabase
              .from("item_alerts")
              .update({ trigger_at: newTriggerAt, last_fired_at: null })
              .eq("id", alert.id);
          }
        }
      }

      return NextResponse.json({
        success: true,
        action: data,
        postponedTo: postponed_to,
      });
    }

    // === CANCEL ===
    if (action === "cancel") {
      if (is_recurring && occurrence_date) {
        const { data, error } = await supabase
          .from("item_occurrence_actions")
          .insert({
            item_id: itemId,
            occurrence_date,
            action_type: "cancelled",
            reason: reason || null,
            created_by: user.id,
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
        const { error } = await supabase
          .from("items")
          .update({
            status: "cancelled",
            updated_at: new Date().toISOString(),
          })
          .eq("id", itemId);

        if (error) {
          return NextResponse.json({ error: error.message }, { status: 500 });
        }
        return NextResponse.json({
          success: true,
          type: "item",
          itemId,
        });
      }
    }

    return NextResponse.json({ error: "Unknown action" }, { status: 400 });
  } catch (error) {
    console.error("[items/[id]/actions] Unexpected error:", error);
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 },
    );
  }
}
