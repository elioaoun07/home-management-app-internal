// src/app/api/notifications/subscribe/route.ts
// API route to save push subscription to database

import { supabaseServer } from "@/lib/supabase/server";
import { cookies } from "next/headers";
import { NextRequest, NextResponse } from "next/server";

export const dynamic = "force-dynamic";

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
    const { endpoint, p256dh, auth, device_name, user_agent } = body;

    if (!endpoint || !p256dh || !auth) {
      return NextResponse.json(
        { error: "Missing required subscription data" },
        { status: 400 }
      );
    }

    // Upsert the subscription (update if exists, create if not)
    const { data, error } = await supabase
      .from("push_subscriptions")
      .upsert(
        {
          user_id: user.id,
          endpoint,
          p256dh,
          auth,
          device_name,
          user_agent,
          is_active: true,
          last_used_at: new Date().toISOString(),
        },
        {
          onConflict: "user_id,endpoint",
          ignoreDuplicates: false,
        }
      )
      .select()
      .single();

    if (error) {
      console.error("Failed to save push subscription:", error);
      return NextResponse.json(
        { error: "Failed to save subscription" },
        { status: 500 }
      );
    }

    return NextResponse.json({ success: true, id: data.id });
  } catch (error) {
    console.error("Error in subscribe route:", error);
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 }
    );
  }
}
