import { getAccessibleTrip } from "@/lib/tripAccess";
import { supabaseServer } from "@/lib/supabase/server";
import { cookies } from "next/headers";
import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";

export const dynamic = "force-dynamic";

// Modelled on POST /api/user-categories/reorder.
const bodySchema = z.object({
  updates: z.array(z.object({ id: z.string().uuid(), position: z.number().int().min(0) })).min(1).max(200),
});

export async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  const { id } = await params;
  const supabase = await supabaseServer(await cookies());
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const access = await getAccessibleTrip(supabase, user.id, id);
  if (!access) return NextResponse.json({ error: "Not found" }, { status: 404 });

  const body = await req.json();
  const parsed = bodySchema.safeParse(body);
  if (!parsed.success) return NextResponse.json({ error: parsed.error.flatten() }, { status: 400 });

  for (const update of parsed.data.updates) {
    const { error } = await supabase
      .from("trip_packing_items")
      .update({ position: update.position })
      .eq("id", update.id)
      .eq("trip_id", id);
    if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  }

  return NextResponse.json({ success: true });
}
