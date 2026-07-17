import { supabaseServer } from "@/lib/supabase/server";
import { cookies } from "next/headers";
import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";

export const dynamic = "force-dynamic";

const createVaccineSchema = z.object({
  profile_id: z.string().uuid(),
  vaccine_name: z.string().trim().min(1).max(120),
  dose_label: z.string().trim().max(60).nullish(),
  administered_on: z.string().regex(/^\d{4}-\d{2}-\d{2}$/).nullish(),
  next_due_on: z.string().regex(/^\d{4}-\d{2}-\d{2}$/).nullish(),
  provider: z.string().trim().max(160).nullish(),
  lot_number: z.string().trim().max(80).nullish(),
  notes: z.string().max(2000).nullish(),
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
    const parsed = createVaccineSchema.safeParse(await req.json());
    if (!parsed.success) {
      return NextResponse.json({ error: parsed.error.flatten() }, { status: 400 });
    }

    const { data, error } = await supabase
      .from("health_vaccines")
      .insert({ ...parsed.data, managing_user_id: user.id })
      .select()
      .single();

    if (error) {
      if (error.code === "23505") {
        return NextResponse.json({ error: "Vaccine already exists" }, { status: 409 });
      }
      return NextResponse.json({ error: error.message }, { status: 500 });
    }
    return NextResponse.json(
      { vaccine: data },
      { status: 201, headers: { "Cache-Control": "no-store" } },
    );
  } catch {
    return NextResponse.json({ error: "Failed to create vaccine" }, { status: 500 });
  }
}
