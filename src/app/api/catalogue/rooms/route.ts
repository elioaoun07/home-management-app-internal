// src/app/api/catalogue/rooms/route.ts
// Rooms of the home (home_rooms). Visibility is RLS: own rooms + the active
// household partner's public ones (2026-10-10_home-rooms.sql).
import { supabaseServer } from "@/lib/supabase/server";
import type { HomeRoom } from "@/types/catalogue";
import { cookies } from "next/headers";
import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";

export const dynamic = "force-dynamic";

const createRoomSchema = z.object({
  name: z.string().trim().min(1).max(80),
});

export async function GET() {
  const supabase = await supabaseServer(await cookies());
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { data, error } = await supabase
    .from("home_rooms")
    .select("*")
    .is("archived_at", null)
    .order("position", { ascending: true })
    .order("created_at", { ascending: true });

  if (error) {
    console.error("Error fetching rooms:", error);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
  return NextResponse.json(data as HomeRoom[], {
    headers: { "Cache-Control": "no-store" },
  });
}

export async function POST(req: NextRequest) {
  const supabase = await supabaseServer(await cookies());
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const parsed = createRoomSchema.safeParse(await req.json().catch(() => null));
  if (!parsed.success) {
    return NextResponse.json(
      { error: "Invalid request body", issues: parsed.error.flatten() },
      { status: 400 },
    );
  }

  const { data: last } = await supabase
    .from("home_rooms")
    .select("position")
    .eq("user_id", user.id)
    .is("archived_at", null)
    .order("position", { ascending: false })
    .limit(1)
    .maybeSingle();

  const { data, error } = await supabase
    .from("home_rooms")
    .insert({
      user_id: user.id,
      name: parsed.data.name,
      position: (last?.position ?? -1) + 1,
    })
    .select()
    .single();

  if (error) {
    if (error.code === "23505") {
      return NextResponse.json({ error: "Room already exists" }, { status: 409 });
    }
    console.error("Error creating room:", error);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
  return NextResponse.json(data as HomeRoom, { status: 201 });
}
