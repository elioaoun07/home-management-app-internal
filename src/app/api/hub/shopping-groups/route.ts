import { supabaseServer } from "@/lib/supabase/server";
import { cookies } from "next/headers";
import { NextRequest, NextResponse } from "next/server";

export const dynamic = "force-dynamic";

/**
 * GET /api/hub/shopping-groups
 * Get shopping groups for a thread
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
        { status: 400 },
      );
    }

    const { data: groups, error } = await supabase
      .from("shopping_groups")
      .select("*")
      .eq("thread_id", threadId)
      .order("sort_order", { ascending: true })
      .order("created_at", { ascending: true });

    if (error) {
      return NextResponse.json({ error: error.message }, { status: 500 });
    }

    return NextResponse.json({ groups: groups || [] });
  } catch {
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 },
    );
  }
}

/**
 * POST /api/hub/shopping-groups
 * Create a new shopping group
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
    const { thread_id, name } = body;

    if (!thread_id || !name?.trim()) {
      return NextResponse.json(
        { error: "thread_id and name are required" },
        { status: 400 },
      );
    }

    // Verify thread exists and user has access
    const { data: thread } = await supabase
      .from("hub_chat_threads")
      .select("id, household_id")
      .eq("id", thread_id)
      .maybeSingle();

    if (!thread) {
      return NextResponse.json({ error: "Thread not found" }, { status: 404 });
    }

    // Verify household access
    const { data: household } = await supabase
      .from("household_links")
      .select("id")
      .eq("id", thread.household_id)
      .or(
        `owner_user_id.eq.${userData.user.id},partner_user_id.eq.${userData.user.id}`,
      )
      .eq("active", true)
      .maybeSingle();

    if (!household) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 403 });
    }

    // Get max sort_order for this thread
    const { data: maxOrder } = await supabase
      .from("shopping_groups")
      .select("sort_order")
      .eq("thread_id", thread_id)
      .order("sort_order", { ascending: false })
      .limit(1)
      .maybeSingle();

    const nextOrder = (maxOrder?.sort_order ?? -1) + 1;

    const { data: group, error } = await supabase
      .from("shopping_groups")
      .insert({
        thread_id,
        household_id: thread.household_id,
        name: name.trim(),
        sort_order: nextOrder,
        created_by: userData.user.id,
      })
      .select()
      .single();

    if (error) {
      return NextResponse.json({ error: error.message }, { status: 500 });
    }

    // Broadcast group change so partner's list auto-refreshes
    const bc = supabase.channel(`thread-${thread_id}`);
    await bc.subscribe();
    await bc.send({
      type: "broadcast",
      event: "shopping-group-update",
      payload: { thread_id, action: "created", group_id: group.id },
    });
    await supabase.removeChannel(bc);

    return NextResponse.json({ group });
  } catch {
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 },
    );
  }
}

/**
 * PATCH /api/hub/shopping-groups
 * Update a shopping group (rename, reorder) or move items between groups
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
    const { action } = body;

    if (!action) {
      return NextResponse.json(
        { error: "action is required" },
        { status: 400 },
      );
    }

    switch (action) {
      case "rename": {
        const { group_id, name } = body;
        if (!group_id || !name?.trim()) {
          return NextResponse.json(
            { error: "group_id and name are required" },
            { status: 400 },
          );
        }

        const { error } = await supabase
          .from("shopping_groups")
          .update({ name: name.trim() })
          .eq("id", group_id);

        if (error) {
          return NextResponse.json({ error: error.message }, { status: 500 });
        }

        // Broadcast so partner sees the rename
        const { data: renamedGroup } = await supabase
          .from("shopping_groups")
          .select("thread_id")
          .eq("id", group_id)
          .maybeSingle();
        if (renamedGroup?.thread_id) {
          const bc = supabase.channel(`thread-${renamedGroup.thread_id}`);
          await bc.subscribe();
          await bc.send({
            type: "broadcast",
            event: "shopping-group-update",
            payload: { thread_id: renamedGroup.thread_id, action: "renamed", group_id },
          });
          await supabase.removeChannel(bc);
        }

        return NextResponse.json({
          success: true,
          group_id,
          name: name.trim(),
        });
      }

      case "reorder": {
        const { groups } = body; // Array of { id, sort_order }
        if (!Array.isArray(groups)) {
          return NextResponse.json(
            { error: "groups array is required" },
            { status: 400 },
          );
        }

        for (const g of groups) {
          await supabase
            .from("shopping_groups")
            .update({ sort_order: g.sort_order })
            .eq("id", g.id);
        }

        return NextResponse.json({ success: true });
      }

      case "move_item": {
        const { message_id, group_id } = body; // group_id can be null to ungroup
        if (!message_id) {
          return NextResponse.json(
            { error: "message_id is required" },
            { status: 400 },
          );
        }

        const { error } = await supabase
          .from("hub_messages")
          .update({ shopping_group_id: group_id || null })
          .eq("id", message_id);

        if (error) {
          return NextResponse.json({ error: error.message }, { status: 500 });
        }

        return NextResponse.json({ success: true, message_id, group_id });
      }

      case "move_items_bulk": {
        const { message_ids, group_id } = body;
        if (!Array.isArray(message_ids) || message_ids.length === 0) {
          return NextResponse.json(
            { error: "message_ids array is required" },
            { status: 400 },
          );
        }

        const { error } = await supabase
          .from("hub_messages")
          .update({ shopping_group_id: group_id || null })
          .in("id", message_ids);

        if (error) {
          return NextResponse.json({ error: error.message }, { status: 500 });
        }

        return NextResponse.json({ success: true });
      }

      default:
        return NextResponse.json(
          { error: `Unknown action: ${action}` },
          { status: 400 },
        );
    }
  } catch {
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 },
    );
  }
}

/**
 * DELETE /api/hub/shopping-groups
 * Delete a shopping group (items become ungrouped)
 */
export async function DELETE(req: NextRequest) {
  try {
    const cookieStore = await cookies();
    const supabase = await supabaseServer(cookieStore);

    const { data: userData, error: userError } = await supabase.auth.getUser();
    if (userError || !userData?.user) {
      return NextResponse.json({ error: "Not authenticated" }, { status: 401 });
    }

    const body = await req.json();
    const { group_id } = body;

    if (!group_id) {
      return NextResponse.json(
        { error: "group_id is required" },
        { status: 400 },
      );
    }

    // Fetch thread_id before deleting (needed for broadcast)
    const { data: deletedGroup } = await supabase
      .from("shopping_groups")
      .select("thread_id")
      .eq("id", group_id)
      .maybeSingle();

    // Move all items in this group to ungrouped first
    await supabase
      .from("hub_messages")
      .update({ shopping_group_id: null })
      .eq("shopping_group_id", group_id);

    // Delete the group
    const { error } = await supabase
      .from("shopping_groups")
      .delete()
      .eq("id", group_id);

    if (error) {
      return NextResponse.json({ error: error.message }, { status: 500 });
    }

    // Broadcast so partner's list removes the group
    if (deletedGroup?.thread_id) {
      const bc = supabase.channel(`thread-${deletedGroup.thread_id}`);
      await bc.subscribe();
      await bc.send({
        type: "broadcast",
        event: "shopping-group-update",
        payload: { thread_id: deletedGroup.thread_id, action: "deleted", group_id },
      });
      await supabase.removeChannel(bc);
    }

    return NextResponse.json({ success: true, group_id });
  } catch {
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 },
    );
  }
}
