// src/app/api/recipes/[id]/cooking-log/route.ts
// CRUD for cooking log entries

import { supabaseServer } from "@/lib/supabase/server";
import { cookies } from "next/headers";
import { NextRequest, NextResponse } from "next/server";

export const dynamic = "force-dynamic";

// GET: List cooking logs for a recipe
export async function GET(
  _req: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  const { id } = await params;
  const supabase = await supabaseServer(await cookies());
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { data, error } = await supabase
    .from("cooking_logs")
    .select("*")
    .eq("recipe_id", id)
    .order("cooked_at", { ascending: false });

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  return NextResponse.json(data);
}

// POST: Add a cooking log entry + update recipe stats
export async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  const { id } = await params;
  const supabase = await supabaseServer(await cookies());
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  let body: {
    version_id?: string | null;
    actual_prep_minutes?: number | null;
    actual_cook_minutes?: number | null;
    perceived_difficulty?: string | null;
    substitutions?: Array<{
      original: string;
      replaced_with: string;
      notes?: string;
    }>;
    servings_made?: number | null;
    rating?: number | null;
    taste_notes?: string | null;
    general_notes?: string | null;
    would_make_again?: boolean | null;
  };

  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON body" }, { status: 400 });
  }

  // Insert cooking log
  const { data: log, error: logError } = await supabase
    .from("cooking_logs")
    .insert({
      recipe_id: id,
      user_id: user.id,
      version_id: body.version_id ?? null,
      actual_prep_minutes: body.actual_prep_minutes ?? null,
      actual_cook_minutes: body.actual_cook_minutes ?? null,
      perceived_difficulty: body.perceived_difficulty ?? null,
      substitutions: body.substitutions || [],
      servings_made: body.servings_made ?? null,
      rating: body.rating ?? null,
      taste_notes: body.taste_notes ?? null,
      general_notes: body.general_notes ?? null,
      would_make_again: body.would_make_again ?? null,
      cooked_at: new Date().toISOString(),
    })
    .select()
    .single();

  if (logError) {
    return NextResponse.json({ error: logError.message }, { status: 500 });
  }

  // Update recipe stats: times_cooked, last_cooked_at, average_rating
  // First get all logs for average
  const { data: allLogs } = await supabase
    .from("cooking_logs")
    .select("rating")
    .eq("recipe_id", id)
    .not("rating", "is", null);

  const ratings = (allLogs || []).map((l) => l.rating as number);
  const avgRating =
    ratings.length > 0
      ? Math.round((ratings.reduce((a, b) => a + b, 0) / ratings.length) * 10) /
        10
      : null;

  const { data: countData } = await supabase
    .from("cooking_logs")
    .select("id", { count: "exact", head: true })
    .eq("recipe_id", id);

  await supabase
    .from("recipes")
    .update({
      times_cooked: (countData as any)?.length ?? 1,
      last_cooked_at: new Date().toISOString(),
      average_rating: avgRating,
      updated_at: new Date().toISOString(),
    })
    .eq("id", id);

  return NextResponse.json(log, { status: 201 });
}
