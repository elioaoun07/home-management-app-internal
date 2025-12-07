import { supabaseServer } from "@/lib/supabase/server";
import { cookies } from "next/headers";
import { NextRequest, NextResponse } from "next/server";

export const dynamic = "force-dynamic";

// POST - Mark a message as read
export async function POST(request: NextRequest) {
  const supabase = await supabaseServer(await cookies());
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const body = await request.json();
  const { message_id } = body;

  if (!message_id) {
    return NextResponse.json({ error: "message_id required" }, { status: 400 });
  }

  // Check if receipt already exists
  const { data: existing } = await supabase
    .from("hub_message_receipts")
    .select("id, status")
    .eq("message_id", message_id)
    .eq("user_id", user.id)
    .maybeSingle();

  if (existing?.status === "read") {
    // Already read
    return NextResponse.json({ success: true, already_read: true });
  }

  if (existing) {
    // Update existing receipt
    await supabase
      .from("hub_message_receipts")
      .update({
        status: "read",
        read_at: new Date().toISOString(),
      })
      .eq("id", existing.id);
  } else {
    // Create new receipt
    await supabase.from("hub_message_receipts").insert({
      message_id,
      user_id: user.id,
      status: "read",
      read_at: new Date().toISOString(),
    });
  }

  return NextResponse.json({ success: true });
}
