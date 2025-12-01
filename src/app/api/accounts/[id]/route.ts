// src/app/api/accounts/[id]/route.ts
import { supabaseServer } from "@/lib/supabase/server";
import { cookies } from "next/headers";
import { NextRequest, NextResponse } from "next/server";

export const dynamic = "force-dynamic"; // disable caching for this route

// PATCH /api/accounts/:id  — update { name?, type? }
export async function PATCH(
  req: NextRequest,
  context: { params: Promise<{ id: string }> }
) {
  const supabase = await supabaseServer(await cookies());
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user)
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { id } = await context.params;
  let body: any = {};
  try {
    body = await req.json();
  } catch {}

  const patch: Record<string, any> = {};

  if (typeof body.name === "string" && body.name.trim()) {
    patch.name = body.name.trim();
  }

  if (typeof body.type === "string") {
    const type = String(body.type).toLowerCase();
    if (!["expense", "income"].includes(type)) {
      return NextResponse.json(
        { error: "type must be 'expense' or 'income'" },
        { status: 400 }
      );
    }
    patch.type = type;
  }

  // Support updating visible field (for unhiding accounts)
  if (typeof body.visible === "boolean") {
    patch.visible = body.visible;
  }

  if (Object.keys(patch).length === 0) {
    return NextResponse.json(
      { error: "No valid fields to update" },
      { status: 400 }
    );
  }

  const { data, error } = await supabase
    .from("accounts")
    .update(patch)
    .eq("id", id)
    .eq("user_id", user.id) // enforce ownership
    .select("id,user_id,name,type,inserted_at")
    .single();

  if (error) {
    console.error("Error updating account:", error);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
  if (!data) return NextResponse.json({ error: "Not found" }, { status: 404 });

  return NextResponse.json(data, {
    headers: { "Cache-Control": "no-store" },
  });
}

// DELETE /api/accounts/:id  — soft-delete account (set visible=false)
export async function DELETE(
  _req: NextRequest,
  context: { params: Promise<{ id: string }> }
) {
  const supabase = await supabaseServer(await cookies());
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user)
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { id } = await context.params;

  // Soft-delete: set visible to false instead of hard delete
  const { error } = await supabase
    .from("accounts")
    .update({ visible: false })
    .eq("id", id)
    .eq("user_id", user.id);

  if (error) {
    console.error("Error hiding account:", error);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  return NextResponse.json(
    { success: true },
    { headers: { "Cache-Control": "no-store" } }
  );
}
