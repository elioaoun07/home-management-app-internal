import { supabaseServer } from "@/lib/supabase/server";
import { cookies } from "next/headers";
import { NextRequest, NextResponse } from "next/server";

export const dynamic = "force-dynamic";

// GET - Fetch chat messages for a specific thread
export async function GET(request: NextRequest) {
  const supabase = await supabaseServer(await cookies());
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  // Get thread_id from query params
  const { searchParams } = new URL(request.url);
  const threadId = searchParams.get("thread_id");

  if (!threadId) {
    return NextResponse.json({ error: "thread_id required" }, { status: 400 });
  }

  // Verify user has access to this thread's household
  const { data: thread } = await supabase
    .from("hub_chat_threads")
    .select("id, household_id")
    .eq("id", threadId)
    .maybeSingle();

  if (!thread) {
    return NextResponse.json({ error: "Thread not found" }, { status: 404 });
  }

  const { data: household } = await supabase
    .from("household_links")
    .select("id")
    .eq("id", thread.household_id)
    .or(`owner_user_id.eq.${user.id},partner_user_id.eq.${user.id}`)
    .eq("active", true)
    .maybeSingle();

  if (!household) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 403 });
  }

  // Fetch messages for this thread
  const { data: messages, error } = await supabase
    .from("hub_messages")
    .select("*")
    .eq("thread_id", threadId)
    .order("created_at", { ascending: true })
    .limit(200);

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  // Mark messages from others as read
  await supabase
    .from("hub_messages")
    .update({ is_read: true })
    .eq("thread_id", threadId)
    .neq("sender_user_id", user.id)
    .eq("is_read", false);

  return NextResponse.json({
    messages: messages || [],
    thread_id: threadId,
    household_id: thread.household_id,
    current_user_id: user.id,
  });
}

// POST - Send a new message to a thread
export async function POST(request: NextRequest) {
  const supabase = await supabaseServer(await cookies());
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const body = await request.json();
  const { content, thread_id } = body;

  if (!content?.trim()) {
    return NextResponse.json(
      { error: "Message content required" },
      { status: 400 }
    );
  }

  if (!thread_id) {
    return NextResponse.json({ error: "Thread ID required" }, { status: 400 });
  }

  // Get thread and verify access
  const { data: thread } = await supabase
    .from("hub_chat_threads")
    .select("id, household_id")
    .eq("id", thread_id)
    .maybeSingle();

  if (!thread) {
    return NextResponse.json({ error: "Thread not found" }, { status: 404 });
  }

  const { data: household } = await supabase
    .from("household_links")
    .select("id")
    .eq("id", thread.household_id)
    .or(`owner_user_id.eq.${user.id},partner_user_id.eq.${user.id}`)
    .eq("active", true)
    .maybeSingle();

  if (!household) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 403 });
  }

  // Insert message
  const { data: message, error } = await supabase
    .from("hub_messages")
    .insert({
      household_id: thread.household_id,
      thread_id,
      sender_user_id: user.id,
      message_type: "text",
      content: content.trim(),
    })
    .select()
    .single();

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  return NextResponse.json({ message });
}
