import { supabaseServer } from "@/lib/supabase/server";
import { cookies } from "next/headers";
import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";

export const dynamic = "force-dynamic";

const CreateMemorySchema = z.object({
  label: z.string().min(1).max(80),
  value: z.string().min(1).max(500),
  tags: z.array(z.string().max(40)).max(10).optional().default([]),
});

/** Resolves household_id for the authenticated user (null if not linked). */
async function getHouseholdId(supabase: Awaited<ReturnType<typeof supabaseServer>>, userId: string): Promise<string | null> {
  const { data } = await supabase
    .from("household_links")
    .select("id")
    .or(`owner_user_id.eq.${userId},partner_user_id.eq.${userId}`)
    .eq("active", true)
    .order("created_at", { ascending: false })
    .limit(1)
    .maybeSingle();
  return data?.id ?? null;
}

export async function GET(req: NextRequest) {
  const supabase = await supabaseServer(await cookies());
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const householdId = await getHouseholdId(supabase, user.id);
  if (!householdId) return NextResponse.json([], { status: 200 });

  const q = req.nextUrl.searchParams.get("q") ?? "";
  const limit = Math.min(Number(req.nextUrl.searchParams.get("limit") ?? "20"), 50);

  let query = supabase
    .from("household_memories")
    .select("*")
    .eq("household_id", householdId)
    .order("updated_at", { ascending: false })
    .limit(limit);

  if (q.trim()) {
    query = query.ilike("label", `%${q.trim()}%`);
  }

  const { data, error } = await query;
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });

  return NextResponse.json(data ?? []);
}

export async function POST(req: NextRequest) {
  const supabase = await supabaseServer(await cookies());
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const body = await req.json().catch(() => null);
  const parsed = CreateMemorySchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json({ error: parsed.error.flatten() }, { status: 400 });
  }

  const householdId = await getHouseholdId(supabase, user.id);
  if (!householdId) {
    return NextResponse.json({ error: "No household found" }, { status: 422 });
  }

  const { data, error } = await supabase
    .from("household_memories")
    .insert({
      household_id: householdId,
      created_by: user.id,
      label: parsed.data.label,
      value: parsed.data.value,
      tags: parsed.data.tags,
    })
    .select()
    .single();

  if (error) {
    if (error.code === "23505") {
      return NextResponse.json({ error: "duplicate-label", message: "A memory with that label already exists." }, { status: 409 });
    }
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  return NextResponse.json(data, { status: 201 });
}
