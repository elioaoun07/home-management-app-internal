// src/app/api/hub/create-reminder/route.ts
// API to create items in the Reminder App from the Budget App Hub

import {
  getReminderAppClient,
  ItemPriority,
  ItemType,
} from "@/lib/supabase/reminder-app";
import { supabaseServer } from "@/lib/supabase/server";
import { cookies } from "next/headers";
import { NextRequest, NextResponse } from "next/server";

export const dynamic = "force-dynamic";

interface CreateReminderRequest {
  title: string;
  description?: string;
  type: ItemType; // 'reminder' | 'event' | 'note'
  priority?: ItemPriority;
  due_at?: string | null; // For reminders
  start_at?: string | null; // For events
  end_at?: string | null; // For events
  all_day?: boolean;
  estimate_minutes?: number | null;
  messageId?: string; // Hub message ID to track action
}

export async function POST(request: NextRequest) {
  try {
    // Get Budget App user
    const supabase = await supabaseServer(await cookies());
    const {
      data: { user },
    } = await supabase.auth.getUser();

    if (!user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    // Parse request body
    const body: CreateReminderRequest = await request.json();

    if (!body.title?.trim()) {
      return NextResponse.json({ error: "Title is required" }, { status: 400 });
    }

    // Get the mapped Reminder App user ID
    const { data: mapping, error: mappingError } = await supabase
      .from("cross_app_user_mappings")
      .select("reminder_app_user_id, display_name")
      .eq("budget_app_user_id", user.id)
      .single();

    if (mappingError || !mapping) {
      return NextResponse.json(
        {
          error: "User mapping not found",
          details:
            "Your account is not linked to the Reminder App. Please contact support.",
        },
        { status: 404 }
      );
    }

    const reminderAppUserId = mapping.reminder_app_user_id;

    // Get Reminder App client
    let reminderClient;
    try {
      reminderClient = getReminderAppClient();
    } catch (err) {
      return NextResponse.json(
        {
          error: "Reminder App not configured",
          details:
            "The Reminder App integration is not set up. Please add REMINDER_APP_SUPABASE_URL and REMINDER_APP_SUPABASE_SERVICE_KEY to environment.",
        },
        { status: 503 }
      );
    }

    // Create the item in Reminder App
    const itemData = {
      user_id: reminderAppUserId,
      type: body.type || "reminder",
      title: body.title.trim(),
      description: body.description?.trim() || null,
      priority: body.priority || "normal",
      status: "pending",
      responsible_user_id: reminderAppUserId,
      metadata_json: {
        source: "budget_app_hub",
        created_by_budget_user: user.id,
        message_id: body.messageId || null,
      },
    };

    const { data: item, error: itemError } = await reminderClient
      .from("items")
      .insert(itemData)
      .select()
      .single();

    if (itemError) {
      console.error("Failed to create item in Reminder App:", itemError);
      return NextResponse.json(
        { error: "Failed to create item", details: itemError.message },
        { status: 500 }
      );
    }

    // Create type-specific details
    if (body.type === "reminder" || !body.type) {
      // Create reminder_details
      const reminderDetails = {
        item_id: item.id,
        due_at: body.due_at || null,
        completed_at: null,
        estimate_minutes: body.estimate_minutes || null,
        has_checklist: false,
      };

      const { error: detailsError } = await reminderClient
        .from("reminder_details")
        .insert(reminderDetails);

      if (detailsError) {
        console.error("Failed to create reminder details:", detailsError);
        // Don't fail the whole request, item was created
      }
    } else if (body.type === "event") {
      // Create event_details
      const now = new Date();
      const oneHourLater = new Date(now.getTime() + 60 * 60 * 1000);

      const eventDetails = {
        item_id: item.id,
        start_at: body.start_at || now.toISOString(),
        end_at: body.end_at || oneHourLater.toISOString(),
        all_day: body.all_day || false,
        location_text: null,
      };

      const { error: detailsError } = await reminderClient
        .from("event_details")
        .insert(eventDetails);

      if (detailsError) {
        console.error("Failed to create event details:", detailsError);
        // Don't fail the whole request, item was created
      }
    }
    // Notes don't need additional details

    return NextResponse.json({
      success: true,
      item: {
        id: item.id,
        type: item.type,
        title: item.title,
        created_at: item.created_at,
      },
      message: `${body.type === "event" ? "Event" : body.type === "note" ? "Note" : "Reminder"} created successfully!`,
    });
  } catch (error) {
    console.error("Create reminder API error:", error);
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 }
    );
  }
}
