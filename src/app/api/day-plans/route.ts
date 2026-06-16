import { supabaseServer } from "@/lib/supabase/server";
import { cookies } from "next/headers";
import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";

export const dynamic = "force-dynamic";

const DATE_RE = /^\d{4}-\d{2}-\d{2}$/;

export async function GET(req: NextRequest) {
  const supabase = await supabaseServer(await cookies());
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const date = req.nextUrl.searchParams.get("date");
  if (!date || !DATE_RE.test(date)) {
    return NextResponse.json({ error: "date (YYYY-MM-DD) is required" }, { status: 400 });
  }

  const { data: link } = await supabase
    .from("household_links")
    .select("owner_user_id, partner_user_id")
    .or(`owner_user_id.eq.${user.id},partner_user_id.eq.${user.id}`)
    .eq("active", true)
    .order("created_at", { ascending: false })
    .limit(1)
    .maybeSingle();
  const partnerId = link
    ? link.owner_user_id === user.id
      ? link.partner_user_id
      : link.owner_user_id
    : null;

  const userIds = partnerId ? [user.id, partnerId] : [user.id];

  // RLS (day_plans_select) lets the partner's row through only when is_public = true.
  const { data, error } = await supabase
    .from("day_plans")
    .select("*")
    .eq("plan_date", date)
    .in("user_id", userIds);

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });

  const mine = (data ?? []).find((p) => p.user_id === user.id) ?? null;
  const partner = partnerId
    ? (data ?? []).find((p) => p.user_id === partnerId) ?? null
    : null;

  return NextResponse.json(
    { mine, partner },
    { headers: { "Cache-Control": "no-store" } },
  );
}

const checklistItemSchema = z.object({
  id: z.string(),
  label: z.string().min(1).max(200),
  done_at: z.string().nullish(),
  sort_order: z.number(),
});

const upsertSchema = z.object({
  plan_date: z.string().regex(DATE_RE),
  title: z.string().max(200).nullish(),
  intent: z.enum(["rest", "balanced", "productive"]).nullish(),
  notes: z.string().max(2000).nullish(),
  checklist: z.array(checklistItemSchema).optional(),
  is_public: z.boolean().optional(),
});

export async function POST(req: NextRequest) {
  const supabase = await supabaseServer(await cookies());
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const body = await req.json();
  const parsed = upsertSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json({ error: parsed.error.flatten() }, { status: 400 });
  }
  const d = parsed.data;

  const { data, error } = await supabase
    .from("day_plans")
    .upsert(
      {
        user_id: user.id,
        plan_date: d.plan_date,
        title: d.title ?? null,
        intent: d.intent ?? null,
        notes: d.notes ?? null,
        ...(d.checklist ? { checklist: d.checklist } : {}),
        ...(d.is_public !== undefined ? { is_public: d.is_public } : {}),
        updated_at: new Date().toISOString(),
      },
      { onConflict: "user_id,plan_date" },
    )
    .select()
    .single();

  if (error) {
    if ((error as { code?: string }).code === "23505") {
      return NextResponse.json({ error: "Plan already exists for this date" }, { status: 409 });
    }
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  return NextResponse.json(data, { status: 201 });
}
