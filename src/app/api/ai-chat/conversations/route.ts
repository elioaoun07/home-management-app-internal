import { supabaseServer } from "@/lib/supabase/server";
import { cookies } from "next/headers";
import { NextRequest, NextResponse } from "next/server";

export const dynamic = "force-dynamic";

/**
 * GET /api/ai-chat/conversations
 * Get list of conversations from ai_sessions
 */
export async function GET() {
  try {
    const supabase = await supabaseServer(await cookies());
    const {
      data: { user },
    } = await supabase.auth.getUser();

    if (!user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    // Get sessions from ai_sessions table
    const { data: sessions, error: sessionsError } = await supabase
      .from("ai_sessions")
      .select("id, title, created_at, updated_at")
      .eq("user_id", user.id)
      .eq("is_archived", false)
      .order("updated_at", { ascending: false })
      .limit(50);

    if (sessionsError) {
      console.error("Failed to fetch sessions:", sessionsError);
      return NextResponse.json(
        { error: "Failed to fetch conversations" },
        { status: 500 }
      );
    }

    if (!sessions || sessions.length === 0) {
      return NextResponse.json({ conversations: [] });
    }

    // Get message counts for each session
    const sessionIds = sessions.map((s) => s.id);
    const { data: messageCounts } = await supabase
      .from("ai_messages")
      .select("session_id")
      .eq("user_id", user.id)
      .eq("is_active", true)
      .in("session_id", sessionIds);

    // Count messages per session
    const countMap: Record<string, number> = {};
    (messageCounts || []).forEach((m) => {
      countMap[m.session_id] = (countMap[m.session_id] || 0) + 1;
    });

    const conversations = sessions.map((s) => ({
      id: s.id,
      title: s.title,
      preview: s.title,
      messageCount: Math.floor((countMap[s.id] || 0) / 2), // Divide by 2 since we count user+assistant
      createdAt: s.created_at,
      updatedAt: s.updated_at,
    }));

    return NextResponse.json({ conversations });
  } catch (error) {
    console.error("Conversations GET error:", error);
    return NextResponse.json(
      { error: "Failed to fetch conversations" },
      { status: 500 }
    );
  }
}

/**
 * PATCH /api/ai-chat/conversations
 * Update conversation (rename, archive)
 */
export async function PATCH(req: NextRequest) {
  try {
    const supabase = await supabaseServer(await cookies());
    const {
      data: { user },
    } = await supabase.auth.getUser();

    if (!user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const body = await req.json();
    const { sessionId, title, isArchived } = body;

    if (!sessionId) {
      return NextResponse.json(
        { error: "Session ID is required" },
        { status: 400 }
      );
    }

    const updates: Record<string, unknown> = {};
    if (title !== undefined) updates.title = title;
    if (isArchived !== undefined) updates.is_archived = isArchived;

    if (Object.keys(updates).length === 0) {
      return NextResponse.json({ success: true });
    }

    const { error } = await supabase
      .from("ai_sessions")
      .update(updates)
      .eq("id", sessionId)
      .eq("user_id", user.id);

    if (error) {
      console.error("Failed to update session:", error);
      return NextResponse.json(
        { error: "Failed to update conversation" },
        { status: 500 }
      );
    }

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error("Conversations PATCH error:", error);
    return NextResponse.json(
      { error: "Failed to update conversation" },
      { status: 500 }
    );
  }
}

/**
 * DELETE /api/ai-chat/conversations
 * Delete a conversation and all its messages
 */
export async function DELETE(req: NextRequest) {
  try {
    const supabase = await supabaseServer(await cookies());
    const {
      data: { user },
    } = await supabase.auth.getUser();

    if (!user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const { searchParams } = new URL(req.url);
    const sessionId = searchParams.get("sessionId");

    if (!sessionId) {
      return NextResponse.json(
        { error: "Session ID is required" },
        { status: 400 }
      );
    }

    // Delete messages first (due to foreign key on parent_id)
    await supabase
      .from("ai_messages")
      .delete()
      .eq("session_id", sessionId)
      .eq("user_id", user.id);

    // Then delete the session
    await supabase
      .from("ai_sessions")
      .delete()
      .eq("id", sessionId)
      .eq("user_id", user.id);

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error("Conversations DELETE error:", error);
    return NextResponse.json(
      { error: "Failed to delete conversation" },
      { status: 500 }
    );
  }
}
