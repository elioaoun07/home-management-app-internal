import { supabaseServer } from "@/lib/supabase/server";
import { cookies } from "next/headers";
import { NextRequest, NextResponse } from "next/server";

export const dynamic = "force-dynamic";

export async function PATCH(
  req: NextRequest,
  ctx: { params: Promise<{ id: string }> }
) {
  const { id } = await ctx.params;
  const supabase = await supabaseServer(await cookies());
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user)
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { name, visible }: { name?: string; visible?: boolean } =
    await req.json();
  if (!name && typeof visible === "undefined") {
    return NextResponse.json({ error: "Nothing to update" }, { status: 400 });
  }

  const updates: Record<string, any> = {};
  if (typeof name === "string" && name.trim()) updates.name = name.trim();
  if (typeof visible === "boolean") updates.visible = visible;

  const { data, error } = await supabase
    .from("user_categories")
    .update(updates)
    .eq("id", id)
    .eq("user_id", user.id)
    .select("id,name,color,parent_id,position,visible,account_id")
    .single();

  if (error) {
    console.error("Update subcategory error", error);
    return NextResponse.json(
      { error: "Failed to update subcategory" },
      { status: 500 }
    );
  }
  return NextResponse.json(data, { headers: { "Cache-Control": "no-store" } });
}

export async function DELETE(
  _req: NextRequest,
  ctx: { params: Promise<{ id: string }> }
) {
  const { id } = await ctx.params;
  const supabase = await supabaseServer(await cookies());
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user)
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { error } = await supabase
    .from("user_categories")
    .update({ visible: false })
    .eq("id", id)
    .eq("user_id", user.id);

  if (error) {
    console.error("Delete subcategory error", error);
    return NextResponse.json(
      { error: "Failed to delete subcategory" },
      { status: 500 }
    );
  }
  return NextResponse.json(
    { success: true },
    { headers: { "Cache-Control": "no-store" } }
  );
}
