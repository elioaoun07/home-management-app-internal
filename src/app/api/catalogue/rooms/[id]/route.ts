// src/app/api/catalogue/rooms/[id]/route.ts
import { supabaseServer } from "@/lib/supabase/server";
import type { HomeRoom } from "@/types/catalogue";
import { cookies } from "next/headers";
import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";

export const dynamic = "force-dynamic";

type RouteContext = { params: Promise<{ id: string }> };

const patchRoomSchema = z
  .object({
    name: z.string().trim().min(1).max(80).optional(),
    position: z.number().int().min(0).optional(),
    /** null restores an archived room (Undo of a delete) */
    archived_at: z.null().optional(),
  })
  .strip();

export async function PATCH(req: NextRequest, context: RouteContext) {
  const { id } = await context.params;
  const supabase = await supabaseServer(await cookies());
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const parsed = patchRoomSchema.safeParse(await req.json().catch(() => null));
  if (!parsed.success || Object.keys(parsed.data).length === 0) {
    return NextResponse.json({ error: "Invalid request body" }, { status: 400 });
  }

  const { data, error } = await supabase
    .from("home_rooms")
    .update({ ...parsed.data, updated_at: new Date().toISOString() })
    .eq("id", id)
    .eq("user_id", user.id)
    .select()
    .maybeSingle();

  if (error) {
    if (error.code === "23505") {
      return NextResponse.json({ error: "Room already exists" }, { status: 409 });
    }
    console.error("Error updating room:", error);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
  if (!data) {
    return NextResponse.json({ error: "Room not found" }, { status: 404 });
  }
  return NextResponse.json(data as HomeRoom);
}

// Soft delete: chores keep the id in room_ids, the app ignores archived rooms.
export async function DELETE(_req: NextRequest, context: RouteContext) {
  const { id } = await context.params;
  const supabase = await supabaseServer(await cookies());
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { error } = await supabase
    .from("home_rooms")
    .update({ archived_at: new Date().toISOString() })
    .eq("id", id)
    .eq("user_id", user.id);

  if (error) {
    console.error("Error deleting room:", error);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
  return new NextResponse(null, { status: 204 });
}
