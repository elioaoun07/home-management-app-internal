// src/app/api/notifications/status/route.ts
// API route to check push subscription status from the database

import { supabaseServer } from "@/lib/supabase/server";
import { cookies } from "next/headers";
import { NextRequest, NextResponse } from "next/server";

export const dynamic = "force-dynamic";

export async function GET(req: NextRequest) {
  const supabase = await supabaseServer(await cookies());
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  try {
    // Check if user has any active subscriptions
    const { data: subscriptions, error } = await supabase
      .from("push_subscriptions")
      .select("id, device_name, endpoint, last_used_at, is_active")
      .eq("user_id", user.id)
      .eq("is_active", true)
      .order("last_used_at", { ascending: false });

    if (error) {
      console.error("Failed to check subscription status:", error);
      return NextResponse.json(
        { error: "Failed to check status" },
        { status: 500 },
      );
    }

    return NextResponse.json({
      hasActiveSubscription: subscriptions && subscriptions.length > 0,
      subscriptions: subscriptions || [],
      count: subscriptions?.length || 0,
    });
  } catch (error) {
    console.error("Error in status route:", error);
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 },
    );
  }
}

// POST endpoint to verify a specific subscription exists
export async function POST(req: NextRequest) {
  const supabase = await supabaseServer(await cookies());
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  try {
    const body = await req.json();
    const { endpoint } = body;

    if (!endpoint) {
      // If no endpoint provided, just check if any subscription exists
      const { data: subscriptions, error } = await supabase
        .from("push_subscriptions")
        .select("id")
        .eq("user_id", user.id)
        .eq("is_active", true)
        .limit(1);

      if (error) {
        return NextResponse.json(
          { error: "Failed to check status" },
          { status: 500 },
        );
      }

      return NextResponse.json({
        exists: subscriptions && subscriptions.length > 0,
      });
    }

    // Check if specific endpoint subscription exists
    const { data: subscription, error } = await supabase
      .from("push_subscriptions")
      .select("id, is_active")
      .eq("user_id", user.id)
      .eq("endpoint", endpoint)
      .single();

    if (error && error.code !== "PGRST116") {
      // PGRST116 = no rows returned
      console.error("Failed to verify subscription:", error);
      return NextResponse.json(
        { error: "Failed to verify subscription" },
        { status: 500 },
      );
    }

    return NextResponse.json({
      exists: !!subscription,
      isActive: subscription?.is_active || false,
    });
  } catch (error) {
    console.error("Error in status route:", error);
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 },
    );
  }
}
