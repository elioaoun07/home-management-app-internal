import { supabaseServer } from "@/lib/supabase/server";
import { cookies } from "next/headers";
import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";

export const dynamic = "force-dynamic";

export type NotificationPreference = {
  id: string;
  user_id: string;
  preference_key: string;
  enabled: boolean;
  frequency: "daily" | "weekly" | "monthly" | "custom";
  custom_cron: string | null;
  timezone: string;
  days_of_week: number[];
  quiet_start: string | null;
  quiet_end: string | null;
  metadata: Record<string, unknown> | null;
  created_at: string;
  updated_at: string;
};

const preferenceUpsertSchema = z.object({
  preference_key: z.string().min(1),
  enabled: z.boolean().optional(),
  frequency: z.enum(["daily", "weekly", "monthly", "custom"]).optional(),
  custom_cron: z.string().nullable().optional(),
  timezone: z.string().optional(),
  days_of_week: z.array(z.number().int().min(1).max(7)).optional(),
  quiet_start: z.string().nullable().optional(),
  quiet_end: z.string().nullable().optional(),
  metadata: z.record(z.string(), z.unknown()).nullable().optional(),
});

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

  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON body" }, { status: 400 });
  }

  const parsed = preferenceUpsertSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json(
      { error: parsed.error.flatten() },
      { status: 400 },
    );
  }

  // Build payload with defaults; only include fields the caller actually sent
  // so partial updates don't reset other columns to defaults via upsert.
  const payload: Record<string, unknown> = {
    user_id: user.id,
    preference_key: parsed.data.preference_key,
  };
  for (const [key, value] of Object.entries(parsed.data)) {
    if (key === "preference_key") continue;
    if (value !== undefined) payload[key] = value;
  }

  // Upsert preference
  const { data: preference, error } = await supabase
    .from("notification_preferences")
    .upsert(payload, { onConflict: "user_id,preference_key" })
    .select()
    .single();

  if (error) {
    if ((error as { code?: string }).code === "23505") {
      return NextResponse.json({ error: "Already exists" }, { status: 409 });
    }
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
      { status: 400 },
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
