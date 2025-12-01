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
    console.error("Update category error", error);
    return NextResponse.json(
      { error: "Failed to update category" },
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

  // hide category
  const { error: err1 } = await supabase
    .from("user_categories")
    .update({ visible: false })
    .eq("user_id", user.id)
    .eq("id", id);

  if (err1) {
    console.error("Soft delete category error", err1);
    return NextResponse.json(
      { error: "Failed to delete category" },
      { status: 500 }
    );
  }

  // hide its subs
  const { error: err2 } = await supabase
    .from("user_categories")
    .update({ visible: false })
    .eq("user_id", user.id)
    .eq("parent_id", id);

  if (err2) {
    console.error("Soft delete subcategories error", err2);
    return NextResponse.json(
      { error: "Failed to delete subcategories" },
      { status: 500 }
    );
  }

  return NextResponse.json(
    { success: true },
    { headers: { "Cache-Control": "no-store" } }
  );
}
