// src/app/api/subtasks/route.ts
// API route for subtask mutations (add, toggle, delete)
// Used by offline sync engine for replay

import { supabaseServer } from "@/lib/supabase/server";
import { NextRequest, NextResponse } from "next/server";

export async function POST(request: NextRequest) {
  try {
    const supabase = await supabaseServer();
    const {
      data: { user },
    } = await supabase.auth.getUser();

    if (!user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const body = await request.json();
    const { parent_item_id, parent_subtask_id, title, occurrence_date, order_index } = body;

    if (!parent_item_id || !title?.trim()) {
      return NextResponse.json(
        { error: "parent_item_id and title are required" },
        { status: 400 },
      );
    }

    // Auto-determine order_index if not provided
    let finalOrderIndex = order_index;
    if (finalOrderIndex === undefined) {
      let query = supabase
        .from("item_subtasks")
        .select("order_index")
        .eq("parent_item_id", parent_item_id)
        .order("order_index", { ascending: false })
        .limit(1);

      if (parent_subtask_id) {
        query = query.eq("parent_subtask_id", parent_subtask_id);
      } else {
        query = query.is("parent_subtask_id", null);
      }

      const { data: existing } = await query;
      finalOrderIndex = existing?.[0]?.order_index
        ? existing[0].order_index + 1
        : 0;
    }

    const { data, error } = await supabase
      .from("item_subtasks")
      .insert({
        parent_item_id,
        parent_subtask_id: parent_subtask_id || null,
        title: title.trim(),
        order_index: finalOrderIndex,
        occurrence_date: occurrence_date || null,
      })
      .select()
      .single();

    if (error) {
      console.error("[subtasks] Failed to create subtask:", error);
      return NextResponse.json({ error: error.message }, { status: 500 });
    }

    return NextResponse.json({ subtask: data }, { status: 201 });
  } catch (error) {
    console.error("[subtasks] Unexpected error:", error);
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 },
    );
  }
}

export async function PATCH(request: NextRequest) {
  try {
    const supabase = await supabaseServer();
    const {
      data: { user },
    } = await supabase.auth.getUser();

    if (!user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const body = await request.json();
    const { id, action, done } = body;

    if (!id) {
      return NextResponse.json(
        { error: "Subtask id is required" },
        { status: 400 },
      );
    }

    // Toggle subtask completion
    if (action === "toggle" && typeof done === "boolean") {
      const now = new Date().toISOString();

      if (done) {
        // When completing: try cascade to descendants
        let allIds = [id];
        try {
          const { data: descendants, error: descError } = await supabase.rpc(
            "get_subtask_descendants",
            { root_subtask_id: id },
          );

          if (!descError && descendants?.length) {
            allIds = [
              id,
              ...descendants.map((d: { id: string }) => d.id),
            ];
          }
        } catch {
          // RPC may not exist, just toggle the single subtask
        }

        const { error } = await supabase
          .from("item_subtasks")
          .update({ done_at: now, updated_at: now })
          .in("id", allIds);

        if (error) {
          return NextResponse.json({ error: error.message }, { status: 500 });
        }
        return NextResponse.json({
          success: true,
          id,
          done: true,
          cascadedIds: allIds,
        });
      } else {
        const { error } = await supabase
          .from("item_subtasks")
          .update({ done_at: null, updated_at: now })
          .eq("id", id);

        if (error) {
          return NextResponse.json({ error: error.message }, { status: 500 });
        }
        return NextResponse.json({
          success: true,
          id,
          done: false,
          cascadedIds: [id],
        });
      }
    }

    return NextResponse.json(
      { error: "Invalid action or missing parameters" },
      { status: 400 },
    );
  } catch (error) {
    console.error("[subtasks] Unexpected error:", error);
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 },
    );
  }
}

export async function DELETE(request: NextRequest) {
  try {
    const supabase = await supabaseServer();
    const {
      data: { user },
    } = await supabase.auth.getUser();

    if (!user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const { searchParams } = new URL(request.url);
    const subtaskId = searchParams.get("id");

    if (!subtaskId) {
      return NextResponse.json(
        { error: "Subtask id is required" },
        { status: 400 },
      );
    }

    const { error } = await supabase
      .from("item_subtasks")
      .delete()
      .eq("id", subtaskId);

    if (error) {
      console.error("[subtasks] Failed to delete subtask:", error);
      return NextResponse.json({ error: error.message }, { status: 500 });
    }

    return NextResponse.json({ success: true, id: subtaskId });
  } catch (error) {
    console.error("[subtasks] Unexpected error:", error);
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 },
    );
  }
}
