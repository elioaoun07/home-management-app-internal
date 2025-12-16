import { supabaseServer } from "@/lib/supabase/server";
import { cookies } from "next/headers";
import { NextRequest, NextResponse } from "next/server";

export const dynamic = "force-dynamic";

// POST /api/hub/message-actions - Create a message action
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
    const { messageId, actionType, transactionId, metadata } = body;

    if (!messageId || !actionType) {
      return NextResponse.json(
        { error: "messageId and actionType are required" },
        { status: 400 }
      );
    }

    // Verify the message exists and user has access
    const { data: message, error: messageError } = await supabase
      .from("hub_messages")
      .select("id, thread_id, hub_chat_threads(household_id)")
      .eq("id", messageId)
      .single();

    if (messageError || !message) {
      return NextResponse.json(
        { error: "Message not found or access denied" },
        { status: 404 }
      );
    }

    // Create the action
    const { data, error } = await supabase
      .from("hub_message_actions")
      .insert({
        message_id: messageId,
        user_id: user.id,
        action_type: actionType,
        transaction_id: transactionId || null,
        metadata: metadata || {},
      })
      .select()
      .single();

    if (error) {
      // Check for duplicate
      if (error.code === "23505") {
        return NextResponse.json(
          { error: "Action already exists for this message" },
          { status: 409 }
        );
      }

      return NextResponse.json(
        { error: "Failed to create message action", details: error.message },
        { status: 500 }
      );
    }

    // Also update the message itself with the linked ID based on action type
    if (transactionId && actionType === "transaction") {
      await supabase
        .from("hub_messages")
        .update({ transaction_id: transactionId })
        .eq("id", messageId);
    } else if (metadata?.goalId && actionType === "goal") {
      await supabase
        .from("hub_messages")
        .update({ goal_id: metadata.goalId })
        .eq("id", messageId);
    } else if (metadata?.alertId && actionType === "reminder") {
      await supabase
        .from("hub_messages")
        .update({ alert_id: metadata.alertId })
        .eq("id", messageId);
    }

    return NextResponse.json(data);
  } catch (error) {
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 }
    );
  }
}

// GET /api/hub/message-actions?messageIds=id1,id2,id3 - Get actions for messages
export async function GET(req: NextRequest) {
  const supabase = await supabaseServer(await cookies());
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  try {
    const { searchParams } = new URL(req.url);
    const messageIdsParam = searchParams.get("messageIds");

    if (!messageIdsParam) {
      return NextResponse.json(
        { error: "messageIds parameter is required" },
        { status: 400 }
      );
    }

    const messageIds = messageIdsParam.split(",").filter(Boolean);

    if (messageIds.length === 0) {
      return NextResponse.json([]);
    }

    const { data, error } = await supabase
      .from("hub_message_actions")
      .select("*")
      .in("message_id", messageIds);

    if (error) {
      return NextResponse.json(
        { error: "Failed to fetch message actions" },
        { status: 500 }
      );
    }

    return NextResponse.json(data || []);
  } catch (error) {
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 }
    );
  }
}
