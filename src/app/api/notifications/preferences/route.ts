import { supabaseServer } from "@/lib/supabase/server";
import { cookies } from "next/headers";
import { NextRequest, NextResponse } from "next/server";

export const dynamic = "force-dynamic";

export type NotificationPreference = {
  id: string;
  user_id: string;
  preference_key: string;
  enabled: boolean;
  frequency: "daily" | "weekly" | "monthly" | "custom";
  custom_cron: string | null;
  preferred_time: string;
  timezone: string;
  days_of_week: number[];
  quiet_start: string | null;
  quiet_end: string | null;
  metadata: Record<string, unknown> | null;
  created_at: string;
  updated_at: string;
};

// GET - Fetch notification preferences for user
export async function GET() {
  const supabase = await supabaseServer(await cookies());
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  // Fetch user preferences
  const { data: preferences, error } = await supabase
    .from("notification_preferences")
    .select("*")
    .eq("user_id", user.id)
    .order("preference_key");

  if (error) {
    console.error("Error fetching preferences:", error);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  // Fetch available templates
  const { data: templates } = await supabase
    .from("notification_templates")
    .select("*")
    .order("template_key");

  return NextResponse.json({
    preferences: preferences || [],
    templates: templates || [],
  });
}

// POST - Create or update a preference
export async function POST(request: NextRequest) {
  const supabase = await supabaseServer(await cookies());
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const body = await request.json();
  const {
    preference_key,
    enabled = true,
    frequency = "daily",
    custom_cron,
    preferred_time = "20:00:00",
    timezone = "UTC",
    days_of_week = [1, 2, 3, 4, 5, 6, 7],
    quiet_start,
    quiet_end,
    metadata,
  } = body;

  if (!preference_key) {
    return NextResponse.json(
      { error: "Preference key is required" },
      { status: 400 }
    );
  }

  // Upsert preference
  const { data: preference, error } = await supabase
    .from("notification_preferences")
    .upsert(
      {
        user_id: user.id,
        preference_key,
        enabled,
        frequency,
        custom_cron,
        preferred_time,
        timezone,
        days_of_week,
        quiet_start,
        quiet_end,
        metadata,
      },
      {
        onConflict: "user_id,preference_key",
      }
    )
    .select()
    .single();

  if (error) {
    console.error("Error upserting preference:", error);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  return NextResponse.json({ preference });
}

// DELETE - Delete a preference (reverts to default)
export async function DELETE(request: NextRequest) {
  const supabase = await supabaseServer(await cookies());
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { searchParams } = new URL(request.url);
  const preferenceKey = searchParams.get("key");

  if (!preferenceKey) {
    return NextResponse.json(
      { error: "Preference key required" },
      { status: 400 }
    );
  }

  const { error } = await supabase
    .from("notification_preferences")
    .delete()
    .eq("user_id", user.id)
    .eq("preference_key", preferenceKey);

  if (error) {
    console.error("Error deleting preference:", error);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  return NextResponse.json({ success: true });
}
