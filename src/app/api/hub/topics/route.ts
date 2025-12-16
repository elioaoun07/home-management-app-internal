import { supabaseServer } from "@/lib/supabase/server";
import { cookies } from "next/headers";
import { NextRequest, NextResponse } from "next/server";

export const dynamic = "force-dynamic";

/**
 * GET /api/hub/topics
 * Get topics for a thread
 */
export async function GET(req: NextRequest) {
  try {
    const cookieStore = await cookies();
    const supabase = await supabaseServer(cookieStore);

    const { data: userData, error: userError } = await supabase.auth.getUser();
    if (userError || !userData?.user) {
      return NextResponse.json({ error: "Not authenticated" }, { status: 401 });
    }

    const { searchParams } = new URL(req.url);
    const threadId = searchParams.get("thread_id");

    if (!threadId) {
      return NextResponse.json(
        { error: "thread_id is required" },
        { status: 400 }
      );
    }

    // Fetch topics for this thread
    const { data: topics, error } = await supabase
      .from("hub_notes_topics")
      .select("*")
      .eq("thread_id", threadId)
      .order("position", { ascending: true });

    if (error) {
      console.error("Error fetching topics:", error);
      return NextResponse.json(
        { error: "Failed to fetch topics" },
        { status: 500 }
      );
    }

    return NextResponse.json({ topics: topics || [] });
  } catch (error) {
    console.error("Topics GET error:", error);
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 }
    );
  }
}

/**
 * POST /api/hub/topics
 * Create a new topic
 */
export async function POST(req: NextRequest) {
  try {
    const cookieStore = await cookies();
    const supabase = await supabaseServer(cookieStore);

    const { data: userData, error: userError } = await supabase.auth.getUser();
    if (userError || !userData?.user) {
      return NextResponse.json({ error: "Not authenticated" }, { status: 401 });
    }

    const body = await req.json();
    const { thread_id, title, icon = "📄", color = "#3b82f6" } = body;

    if (!thread_id || !title) {
      return NextResponse.json(
        { error: "thread_id and title are required" },
        { status: 400 }
      );
    }

    // Get the max position for this thread
    const { data: maxPosData } = await supabase
      .from("hub_notes_topics")
      .select("position")
      .eq("thread_id", thread_id)
      .order("position", { ascending: false })
      .limit(1);

    const newPosition = (maxPosData?.[0]?.position ?? -1) + 1;

    // Create the topic
    const { data: topic, error } = await supabase
      .from("hub_notes_topics")
      .insert({
        thread_id,
        title,
        icon,
        color,
        position: newPosition,
        created_by: userData.user.id,
      })
      .select()
      .single();

    if (error) {
      console.error("Error creating topic:", error);
      return NextResponse.json(
        { error: "Failed to create topic" },
        { status: 500 }
      );
    }

    return NextResponse.json({ topic });
  } catch (error) {
    console.error("Topics POST error:", error);
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 }
    );
  }
}

/**
 * PATCH /api/hub/topics
 * Update a topic
 */
export async function PATCH(req: NextRequest) {
  try {
    const cookieStore = await cookies();
    const supabase = await supabaseServer(cookieStore);

    const { data: userData, error: userError } = await supabase.auth.getUser();
    if (userError || !userData?.user) {
      return NextResponse.json({ error: "Not authenticated" }, { status: 401 });
    }

    const body = await req.json();
    const { topic_id, title, icon, color, position } = body;

    if (!topic_id) {
      return NextResponse.json(
        { error: "topic_id is required" },
        { status: 400 }
      );
    }

    // Build update object
    const updates: Record<string, unknown> = {};
    if (title !== undefined) updates.title = title;
    if (icon !== undefined) updates.icon = icon;
    if (color !== undefined) updates.color = color;
    if (position !== undefined) updates.position = position;

    if (Object.keys(updates).length === 0) {
      return NextResponse.json(
        { error: "No fields to update" },
        { status: 400 }
      );
    }

    const { data: topic, error } = await supabase
      .from("hub_notes_topics")
      .update(updates)
      .eq("id", topic_id)
      .select()
      .single();

    if (error) {
      console.error("Error updating topic:", error);
      return NextResponse.json(
        { error: "Failed to update topic" },
        { status: 500 }
      );
    }

    return NextResponse.json({ topic });
  } catch (error) {
    console.error("Topics PATCH error:", error);
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 }
    );
  }
}

/**
 * DELETE /api/hub/topics
 * Delete a topic
 */
export async function DELETE(req: NextRequest) {
  try {
    const cookieStore = await cookies();
    const supabase = await supabaseServer(cookieStore);

    const { data: userData, error: userError } = await supabase.auth.getUser();
    if (userError || !userData?.user) {
      return NextResponse.json({ error: "Not authenticated" }, { status: 401 });
    }

    const { searchParams } = new URL(req.url);
    const topicId = searchParams.get("topic_id");

    if (!topicId) {
      return NextResponse.json(
        { error: "topic_id is required" },
        { status: 400 }
      );
    }

    // First, update all messages in this topic to have no topic
    await supabase
      .from("hub_messages")
      .update({ topic_id: null })
      .eq("topic_id", topicId);

    // Then delete the topic
    const { error } = await supabase
      .from("hub_notes_topics")
      .delete()
      .eq("id", topicId);

    if (error) {
      console.error("Error deleting topic:", error);
      return NextResponse.json(
        { error: "Failed to delete topic" },
        { status: 500 }
      );
    }

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error("Topics DELETE error:", error);
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 }
    );
  }
}
