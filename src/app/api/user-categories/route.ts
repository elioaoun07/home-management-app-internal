import { supabaseServer } from "@/lib/supabase/server";
import { cookies } from "next/headers";
import { NextRequest, NextResponse } from "next/server";

export const dynamic = "force-dynamic";

export async function POST(req: NextRequest) {
  const supabase = await supabaseServer(await cookies());
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  let body: any;
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON body" }, { status: 400 });
  }

  const rawName = (body?.name ?? "") as string;
  const name = rawName.trim();
  const color = (body?.color ?? null) as string | null;
  const account_id = body?.account_id as string | undefined;
  const parent_id = body?.parent_id ? String(body.parent_id) : null;
  const providedPos = body?.position as number | undefined;
  const default_category_id = (body?.default_category_id ?? null) as
    | string
    | null;

  if (!name || !account_id) {
    return NextResponse.json(
      { error: "name and account_id are required" },
      { status: 400 }
    );
  }

  // slug (unique per user/account/parent) – assuming DB trigger also maintains it
  const slug = name
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "");

  // Fast dup check by slug (handle root via IS NULL)
  let dupQuery = supabase
    .from("user_categories")
    .select("id")
    .eq("user_id", user.id)
    .eq("account_id", account_id)
    .eq("slug", slug) as any;
  dupQuery =
    parent_id === null
      ? dupQuery.is("parent_id", null)
      : dupQuery.eq("parent_id", parent_id);
  const { data: existing, error: dupErr } = await dupQuery.maybeSingle();

  if (dupErr) {
    console.error("dup check error", dupErr);
    // fall through; DB unique index (if present) will still enforce
  }
  if (existing) {
    return NextResponse.json(
      { error: "A category with this name already exists for this account." },
      { status: 409 }
    );
  }

  // Compute next position if not provided: max(position)+1 within same parent group
  let position = 0;
  if (typeof providedPos === "number" && providedPos > 0) {
    position = Math.floor(providedPos);
  } else {
    let posQuery = supabase
      .from("user_categories")
      .select("position")
      .eq("user_id", user.id)
      .eq("account_id", account_id) as any;
    posQuery =
      parent_id === null
        ? posQuery.is("parent_id", null)
        : posQuery.eq("parent_id", parent_id);
    const { data: maxRow, error: posErr } = await posQuery
      .order("position", { ascending: false })
      .limit(1)
      .maybeSingle();

    if (!posErr && maxRow && typeof maxRow.position === "number") {
      position = maxRow.position + 1;
    } else {
      position = 1;
    }
  }

  const insertData = {
    user_id: user.id,
    name,
    color,
    account_id,
    parent_id,
    position,
    visible: true,
    default_category_id,
  };

  const { data, error } = await supabase
    .from("user_categories")
    .insert(insertData)
    .select("id,name,color,parent_id,position,visible,account_id")
    .single();

  if (error) {
    if ((error as any).code === "23505") {
      return NextResponse.json(
        { error: "A category with this name already exists for this account." },
        { status: 409 }
      );
    }
    console.error("Error creating category:", error);
    return NextResponse.json(
      { error: "Failed to create category" },
      { status: 500 }
    );
  }

  return NextResponse.json(data, { headers: { "Cache-Control": "no-store" } });
}
