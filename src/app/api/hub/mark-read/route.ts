import { supabaseServer } from "@/lib/supabase/server";
import { cookies } from "next/headers";
import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";

export const dynamic = "force-dynamic";

const markReadSchema = z.object({
  message_id: z.string().min(1),
});

// POST - Mark a message as read
export async function POST(request: NextRequest) {
  const supabase = await supabaseServer(await cookies());
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const parsed = markReadSchema.safeParse(await request.json());
  if (!parsed.success) {
    return NextResponse.json(
      { error: parsed.error.flatten() },
      { status: 400 },
    );
  }
  const { message_id } = parsed.data;

  const { data: message } = await supabase
    .from("hub_messages")
    .select("id, thread_id, sender_user_id")
    .eq("id", message_id)
    .maybeSingle();

  if (!message?.thread_id) {
    return NextResponse.json({ error: "Message not found" }, { status: 404 });
  }

  const { data: thread } = await supabase
    .from("hub_chat_threads")
    .select("household_id, is_private, created_by")
    .eq("id", message.thread_id)
    .maybeSingle();

  if (!thread || (thread.is_private && thread.created_by !== user.id)) {
    return NextResponse.json({ error: "Message not found" }, { status: 404 });
  }

  const { data: household } = await supabase
    .from("household_links")
    .select("id")
    .eq("id", thread.household_id)
    .eq("active", true)
    .or(`owner_user_id.eq.${user.id},partner_user_id.eq.${user.id}`)
    .maybeSingle();

  if (!household) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 403 });
  }

  if (message.sender_user_id === user.id) {
    return NextResponse.json({ success: true, already_read: true });
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
    const { error } = await supabase
      .from("hub_message_receipts")
      .update({
        status: "read",
        read_at: new Date().toISOString(),
      })
      .eq("id", existing.id);
    if (error) {
      return NextResponse.json({ error: error.message }, { status: 500 });
    }
  } else {
    // Create new receipt
    const { error } = await supabase
      .from("hub_message_receipts")
      .insert({
        message_id,
        user_id: user.id,
        status: "read",
        read_at: new Date().toISOString(),
      });
    if (error) {
      return NextResponse.json({ error: error.message }, { status: 500 });
    }
  }

  return NextResponse.json(
    { success: true },
    { headers: { "Cache-Control": "no-store" } },
  );
}
