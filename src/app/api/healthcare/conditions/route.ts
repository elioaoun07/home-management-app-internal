import { supabaseServer } from "@/lib/supabase/server";
import { cookies } from "next/headers";
import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";

export const dynamic = "force-dynamic";

const createConditionSchema = z.object({
  profile_id: z.string().uuid(),
  kind: z.enum(["condition", "surgery", "doctor_visit"]),
  title: z.string().trim().min(1).max(160),
  notes: z.string().max(4000).nullish(),
  occurred_on: z.string().regex(/^\d{4}-\d{2}-\d{2}$/).nullish(),
  status: z.enum(["active", "resolved"]).optional(),
  catalogue_item_id: z.string().uuid().nullish(),
});

export async function POST(req: NextRequest) {
  const supabase = await supabaseServer(await cookies());
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  try {
    const parsed = createConditionSchema.safeParse(await req.json());
    if (!parsed.success) {
      return NextResponse.json({ error: parsed.error.flatten() }, { status: 400 });
    }

    const { data, error } = await supabase
      .from("health_conditions")
      .insert({ ...parsed.data, managing_user_id: user.id })
      .select()
      .single();

    if (error) {
      if (error.code === "23505") {
        return NextResponse.json({ error: "Record already exists" }, { status: 409 });
      }
      return NextResponse.json({ error: error.message }, { status: 500 });
    }
    return NextResponse.json(
      { condition: data },
      { status: 201, headers: { "Cache-Control": "no-store" } },
    );
  } catch {
    return NextResponse.json({ error: "Failed to create record" }, { status: 500 });
  }
}
