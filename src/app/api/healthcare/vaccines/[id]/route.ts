import { supabaseServer } from "@/lib/supabase/server";
import { cookies } from "next/headers";
import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";

export const dynamic = "force-dynamic";

const updateVaccineSchema = z.object({
  vaccine_name: z.string().trim().min(1).max(120).optional(),
  dose_label: z.string().trim().max(60).nullish(),
  administered_on: z.string().regex(/^\d{4}-\d{2}-\d{2}$/).nullish(),
  next_due_on: z.string().regex(/^\d{4}-\d{2}-\d{2}$/).nullish(),
  provider: z.string().trim().max(160).nullish(),
  lot_number: z.string().trim().max(80).nullish(),
  notes: z.string().max(2000).nullish(),
  catalogue_item_id: z.string().uuid().nullish(),
});

export async function PATCH(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  const supabase = await supabaseServer(await cookies());
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  try {
    const { id } = await params;
    const parsed = updateVaccineSchema.safeParse(await req.json());
    if (!parsed.success) {
      return NextResponse.json({ error: parsed.error.flatten() }, { status: 400 });
    }

    const { data, error } = await supabase
      .from("health_vaccines")
      .update({ ...parsed.data, updated_at: new Date().toISOString() })
      .eq("id", id)
      .select()
      .maybeSingle();

    if (error) {
      return NextResponse.json({ error: error.message }, { status: 500 });
    }
    if (!data) {
      return NextResponse.json({ error: "Vaccine not found" }, { status: 404 });
    }
    return NextResponse.json(
      { vaccine: data },
      { headers: { "Cache-Control": "no-store" } },
    );
  } catch {
    return NextResponse.json({ error: "Failed to update vaccine" }, { status: 500 });
  }
}

export async function DELETE(
  _req: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  const supabase = await supabaseServer(await cookies());
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { id } = await params;
  const { data, error } = await supabase
    .from("health_vaccines")
    .delete()
    .eq("id", id)
    .select()
    .maybeSingle();

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
  if (!data) {
    return NextResponse.json({ error: "Vaccine not found" }, { status: 404 });
  }
  return NextResponse.json(
    { vaccine: data },
    { headers: { "Cache-Control": "no-store" } },
  );
}
