// src/app/api/items/route.ts
// API route for creating items (reminders, events, tasks)
// Used by offline sync engine for replay

import { supabaseServer } from "@/lib/supabase/server";
import { NextRequest, NextResponse } from "next/server";

export const dynamic = "force-dynamic";

export async function POST(request: NextRequest) {
  try {
    const supabase = await supabaseServer();
    const {
      data: { user },
    } = await supabase.auth.getUser();

    if (!user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const body = await request.json();
    const { type } = body;

    if (!type || !["reminder", "event", "task"].includes(type)) {
      return NextResponse.json(
        { error: "Invalid item type. Must be reminder, event, or task." },
        { status: 400 },
      );
    }

    if (!body.title?.trim()) {
      return NextResponse.json({ error: "Title is required" }, { status: 400 });
    }

    // Create the base item
    // If prerequisites are provided, start as dormant (trigger-only)
    const hasPrerequisites =
      Array.isArray(body.prerequisites) && body.prerequisites.length > 0;

    const { data: item, error: itemError } = await supabase
      .from("items")
      .insert({
        user_id: user.id,
        type,
        title: body.title,
        description: body.description || null,
        priority: body.priority || "normal",
        status: hasPrerequisites ? "dormant" : body.status || "pending",
        metadata_json: body.metadata_json || null,
        is_public: body.is_public || false,
        responsible_user_id: body.responsible_user_id || user.id,
        notify_all_household: body.notify_all_household || false,
        categories: body.category_ids || [],
        location_context: body.location_context || null,
        location_text: body.location_text || null,
        source_catalogue_item_id: body.source_catalogue_item_id || null,
        is_template_instance: body.is_template_instance || false,
      })
      .select()
      .single();

    if (itemError) {
      console.error("[items/route] Failed to create item:", itemError);
      if ((itemError as any).code === "23505") {
        return NextResponse.json(
          { error: "Item already exists" },
          { status: 409 },
        );
      }
      return NextResponse.json({ error: itemError.message }, { status: 500 });
    }

    // Type-specific details
    if (type === "reminder" || type === "task") {
      if (body.due_at || body.estimate_minutes) {
        const { error: detailsError } = await supabase
          .from("reminder_details")
          .insert({
            item_id: item.id,
            due_at: body.due_at || null,
            estimate_minutes: body.estimate_minutes || null,
            has_checklist: body.has_checklist || false,
          });
        if (detailsError) {
          console.error(
            "[items/route] Failed to create reminder details:",
            detailsError,
          );
        }
      }
    } else if (type === "event") {
      const { error: detailsError } = await supabase
        .from("event_details")
        .insert({
          item_id: item.id,
          start_at: body.start_at,
          end_at: body.end_at || null,
          all_day: body.all_day || false,
          location_text: body.location_text || null,
        });
      if (detailsError) {
        console.error(
          "[items/route] Failed to create event details:",
          detailsError,
        );
      }
    }

    // Subtasks
    if (body.subtasks?.length) {
      const subtasks = body.subtasks.map(
        (s: { title: string; order_index?: number }, i: number) => ({
          parent_item_id: item.id,
          title: s.title,
          order_index: s.order_index ?? i,
        }),
      );
      const { error: subtasksError } = await supabase
        .from("item_subtasks")
        .insert(subtasks);
      if (subtasksError) {
        console.error(
          "[items/route] Failed to create subtasks:",
          subtasksError,
        );
      }
    }

    // Alerts
    if (body.alerts?.length) {
      const alerts = body.alerts.map((a: Record<string, unknown>) => {
        let computedTriggerAt = a.trigger_at;
        const baseTimeStr =
          type === "event"
            ? a.relative_to === "end"
              ? body.end_at
              : body.start_at
            : body.due_at;

        if (a.kind === "relative" && baseTimeStr) {
          const baseTime = new Date(baseTimeStr as string);
          if (a.custom_time && a.offset_minutes) {
            const daysOffset = Math.floor((a.offset_minutes as number) / 1440);
            const alertDate = new Date(baseTime);
            alertDate.setDate(alertDate.getDate() - daysOffset);
            const [hours, minutes] = (a.custom_time as string)
              .split(":")
              .map(Number);
            alertDate.setHours(hours, minutes, 0, 0);
            computedTriggerAt = alertDate.toISOString();
          } else if (a.offset_minutes) {
            computedTriggerAt = new Date(
              baseTime.getTime() - (a.offset_minutes as number) * 60 * 1000,
            ).toISOString();
          }
        }

        const alertData: Record<string, unknown> = {
          item_id: item.id,
          kind: a.kind,
          trigger_at: computedTriggerAt,
          offset_minutes: a.offset_minutes,
          relative_to: a.relative_to,
          repeat_every_minutes: a.repeat_every_minutes,
          max_repeats: a.max_repeats,
          channel: a.channel || "push",
        };
        if (a.custom_time) alertData.custom_time = a.custom_time;
        return alertData;
      });
      const { error: alertsError } = await supabase
        .from("item_alerts")
        .insert(alerts);
      if (alertsError) {
        console.error("[items/route] Failed to create alerts:", alertsError);
      }
    } else if (body.due_at) {
      // Auto-create a push alert at due time
      await supabase.from("item_alerts").insert({
        item_id: item.id,
        kind: "absolute",
        trigger_at: body.due_at,
        channel: "push",
        active: true,
      });
    }

    // Recurrence rule
    if (body.recurrence_rule?.rrule) {
      const { error: recurrenceError } = await supabase
        .from("item_recurrence_rules")
        .insert({
          item_id: item.id,
          rrule: body.recurrence_rule.rrule,
          start_anchor:
            body.recurrence_rule.start_anchor ||
            body.due_at ||
            body.start_at ||
            new Date().toISOString(),
          end_until: body.recurrence_rule.end_until || null,
          count: body.recurrence_rule.count || null,
          is_flexible: body.recurrence_rule.is_flexible || false,
          flexible_period: body.recurrence_rule.flexible_period || null,
        });
      if (recurrenceError) {
        console.error(
          "[items/route] Failed to create recurrence:",
          recurrenceError,
        );
      }
    }

    // Prerequisites (triggers)
    if (hasPrerequisites) {
      const prereqs = body.prerequisites.map(
        (p: {
          condition_type: string;
          condition_config: Record<string, unknown>;
          logic_group?: number;
        }) => ({
          item_id: item.id,
          condition_type: p.condition_type,
          condition_config: p.condition_config,
          logic_group: p.logic_group ?? 0,
        }),
      );
      const { error: prereqError } = await supabase
        .from("item_prerequisites")
        .insert(prereqs);
      if (prereqError) {
        console.error(
          "[items/route] Failed to create prerequisites:",
          prereqError,
        );
      }
    }

    return NextResponse.json({ item }, { status: 201 });
  } catch (error) {
    console.error("[items/route] Unexpected error:", error);
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 },
    );
  }
}
