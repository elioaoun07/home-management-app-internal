// src/app/api/items/[id]/actions/route.ts
// API route for item actions: complete, postpone, cancel, skip
// Used by offline sync engine for replay

import { supabaseAdmin } from "@/lib/supabase/admin";
import { supabaseServer } from "@/lib/supabase/server";
import { subMonths } from "date-fns";
import { NextRequest, NextResponse } from "next/server";

// Keep in sync with src/app/api/items/[id]/complete/route.ts — completed
// occurrences older than this are archived immediately; anything more
// recent stays visible until explicitly archived/deleted.
const ARCHIVE_COMPLETED_OLDER_THAN_MONTHS = 1;

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
      planned_for,
    } = body;

    if (
      !action ||
      !["complete", "postpone", "cancel", "skip"].includes(action)
    ) {
      return NextResponse.json(
        { error: "Invalid action. Must be complete, postpone, cancel, or skip." },
        { status: 400 },
      );
    }

    if (!occurrence_date) {
      return NextResponse.json(
        { error: "occurrence_date is required" },
        { status: 400 },
      );
    }

    const adminDb = supabaseAdmin();

    // Fetch via adminDb to bypass RLS — auth is enforced explicitly below.
    const { data: item, error: itemFetchError } = await adminDb
      .from("items")
      .select(
        "id, user_id, type, status, archived_at, deleted_at, responsible_user_id, notify_all_household",
      )
      .eq("id", itemId)
      .single();

    if (itemFetchError || !item) {
      return NextResponse.json({ error: "Item not found" }, { status: 404 });
    }
    if (item.archived_at || item.deleted_at) {
      return NextResponse.json(
        { error: "Item is archived or deleted" },
        { status: 410 },
      );
    }

    // Authorization: creator, responsible user, or any household partner
    const isCreator = item.user_id === user.id;
    const isResponsible = item.responsible_user_id === user.id;
    let canAct = isCreator || isResponsible;

    if (!canAct) {
      const { data: link } = await adminDb
        .from("household_links")
        .select("id")
        .eq("active", true)
        .or(
          `and(owner_user_id.eq.${item.user_id},partner_user_id.eq.${user.id}),` +
            `and(owner_user_id.eq.${user.id},partner_user_id.eq.${item.user_id})`,
        )
        .maybeSingle();
      canAct = !!link;
    }

    if (!canAct) {
      return NextResponse.json({ error: "Forbidden" }, { status: 403 });
    }

    // === COMPLETE ===
    if (action === "complete") {
      if (is_recurring) {
        // Upsert so offline-replay/double-submit of an already-completed
        // occurrence is idempotent instead of a unique-constraint 500.
        const { data, error } = await adminDb
          .from("item_occurrence_actions")
          .upsert(
            {
              item_id: itemId,
              occurrence_date,
              action_type: "completed",
              reason: reason || null,
              created_by: user.id,
              metadata_json: planned_for ? { planned_for } : null,
            },
            { onConflict: "item_id,occurrence_date,action_type" },
          )
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
        // Auto-archive only kicks in for occurrences more than a month old.
        const shouldArchive =
          new Date(occurrence_date) <
          subMonths(new Date(), ARCHIVE_COMPLETED_OLDER_THAN_MONTHS);

        const updatePayload: Record<string, unknown> = {
          status: "completed",
          updated_at: new Date().toISOString(),
        };
        if (shouldArchive) {
          updatePayload.archived_at = new Date().toISOString();
        }

        const [itemResult] = await Promise.all([
          adminDb.from("items").update(updatePayload).eq("id", itemId),
          adminDb.from("item_occurrence_actions").upsert(
            {
              item_id: itemId,
              occurrence_date,
              action_type: "completed",
              reason: reason || null,
              created_by: user.id,
              metadata_json: planned_for ? { planned_for } : null,
            },
            { onConflict: "item_id,occurrence_date,action_type" },
          ),
        ]);

        if (itemResult.error) {
          return NextResponse.json(
            { error: itemResult.error.message },
            { status: 500 },
          );
        }

        await adminDb
          .from("reminder_details")
          .update({ completed_at: new Date().toISOString() })
          .eq("item_id", itemId);

        await adminDb
          .from("item_alerts")
          .update({ active: false })
          .eq("item_id", itemId)
          .eq("active", true);

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

      const { data, error } = await adminDb
        .from("item_occurrence_actions")
        .upsert(
          {
            item_id: itemId,
            occurrence_date,
            action_type: "postponed",
            postponed_to,
            postpone_type: postpone_type || null,
            reason: reason || null,
            created_by: user.id,
          },
          { onConflict: "item_id,occurrence_date,action_type" },
        )
        .select()
        .single();

      if (error) {
        return NextResponse.json({ error: error.message }, { status: 500 });
      }

      // For non-recurring items, update the due date and alerts
      if (!is_recurring && postponed_to) {
        await adminDb
          .from("reminder_details")
          .update({ due_at: postponed_to })
          .eq("item_id", itemId);

        await adminDb
          .from("event_details")
          .update({ start_at: postponed_to })
          .eq("item_id", itemId);

        const { data: alerts } = await adminDb
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
            await adminDb
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
        const { data, error } = await adminDb
          .from("item_occurrence_actions")
          .upsert(
            {
              item_id: itemId,
              occurrence_date,
              action_type: "cancelled",
              reason: reason || null,
              created_by: user.id,
            },
            { onConflict: "item_id,occurrence_date,action_type" },
          )
          .select()
          .single();

        if (error) {
          return NextResponse.json({ error: error.message }, { status: 500 });
        }

        await Promise.resolve(
          adminDb.from("item_alert_suppressions").insert({
            item_id: itemId,
            occurrence_date,
            reason: "cancelled",
            created_by: user.id,
          }),
        ).catch(() => {});

        return NextResponse.json({
          success: true,
          action: data,
          type: "occurrence",
        });
      } else {
        const { error } = await adminDb
          .from("items")
          .update({
            status: "cancelled",
            updated_at: new Date().toISOString(),
          })
          .eq("id", itemId);

        if (error) {
          return NextResponse.json({ error: error.message }, { status: 500 });
        }

        await adminDb
          .from("item_alerts")
          .update({ active: false })
          .eq("item_id", itemId)
          .eq("active", true);

        return NextResponse.json({
          success: true,
          type: "item",
          itemId,
        });
      }
    }

    // === SKIP ===
    if (action === "skip") {
      const { data: actionRow, error: actionError } = await adminDb
        .from("item_occurrence_actions")
        .upsert(
          {
            item_id: itemId,
            occurrence_date,
            action_type: "skipped",
            reason: reason || null,
            created_by: user.id,
            metadata_json: planned_for ? { planned_for } : null,
          },
          { onConflict: "item_id,occurrence_date,action_type" },
        )
        .select()
        .single();

      if (actionError) {
        return NextResponse.json(
          { error: actionError.message },
          { status: 500 },
        );
      }

      await Promise.resolve(
        adminDb.from("item_alert_suppressions").insert({
          item_id: itemId,
          occurrence_date: planned_for || occurrence_date,
          reason: "skipped",
          created_by: user.id,
        }),
      ).catch(() => {});

      if (!is_recurring) {
        const { error } = await adminDb
          .from("items")
          .update({
            status: "cancelled",
            updated_at: new Date().toISOString(),
          })
          .eq("id", itemId);

        if (error) {
          return NextResponse.json({ error: error.message }, { status: 500 });
        }

        await adminDb
          .from("item_alerts")
          .update({ active: false })
          .eq("item_id", itemId)
          .eq("active", true);

        return NextResponse.json({
          success: true,
          action: actionRow,
          type: "item",
          itemId,
        });
      }

      return NextResponse.json({
        success: true,
        action: actionRow,
        type: "occurrence",
      });
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
