import { placementBodySchema } from "@/lib/fitness/contracts";
import { NO_STORE, fitnessRpcError } from "@/lib/fitness/server";
import { supabaseServer } from "@/lib/supabase/server";
import { addDays, format, parseISO } from "date-fns";
import { cookies } from "next/headers";
import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";

export const dynamic = "force-dynamic";

// PUT /api/fitness/slots/[id]/placement — place/move/clear one weekly slot.
// Writes Schedule's own flexible-slot row (item_flexible_schedules, the same
// upsert key the planner uses), so moving keeps the occurrence identity
// (item, week, index 0). Returns the previous placement for Undo.
export async function PUT(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const supabase = await supabaseServer(await cookies());
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { id } = await params;
  if (!z.uuid().safeParse(id).success) return NextResponse.json({ error: "Invalid slot id" }, { status: 400 });
  const parsed = placementBodySchema.safeParse(await req.json().catch(() => null));
  if (!parsed.success) return NextResponse.json({ error: parsed.error.flatten() }, { status: 400 });
  const { week, date, time } = parsed.data;

  const weekStart = parseISO(week);
  if (weekStart.getDay() !== 1) return NextResponse.json({ error: "Week must start on Monday" }, { status: 400 });
  if (date && (date < week || date > format(addDays(weekStart, 6), "yyyy-MM-dd")))
    return NextResponse.json({ error: "Day is outside that week" }, { status: 400 });

  const { data: slot, error: slotError } = await supabase
    .from("fitness_plan_slots")
    .select("id, item_id, plan:fitness_plans!inner(status)")
    .eq("id", id)
    .eq("user_id", user.id)
    .maybeSingle();
  if (slotError) return fitnessRpcError(slotError);
  const status = (slot?.plan as unknown as { status: string } | null)?.status;
  if (!slot?.item_id) return NextResponse.json({ error: "Slot not found" }, { status: 404 });
  if (status !== "active") return NextResponse.json({ error: "Plan is not active" }, { status: 409 });

  const { data: previous, error: prevError } = await supabase
    .from("item_flexible_schedules")
    .select("scheduled_for_date, scheduled_for_time")
    .eq("item_id", slot.item_id)
    .eq("period_start_date", week)
    .eq("occurrence_index", 0)
    .maybeSingle();
  if (prevError) return fitnessRpcError(prevError);

  if (date === null) {
    const { error } = await supabase
      .from("item_flexible_schedules")
      .delete()
      .eq("item_id", slot.item_id)
      .eq("period_start_date", week)
      .eq("occurrence_index", 0);
    if (error) return fitnessRpcError(error);
    return NextResponse.json({ placement: null, previous }, { headers: NO_STORE });
  }

  const { data, error } = await supabase
    .from("item_flexible_schedules")
    .upsert(
      {
        item_id: slot.item_id,
        period_start_date: week,
        scheduled_for_date: date,
        scheduled_for_time: time,
        occurrence_index: 0,
        created_by: user.id,
      },
      { onConflict: "item_id,period_start_date,occurrence_index" },
    )
    .select()
    .single();
  if (error) return fitnessRpcError(error);
  return NextResponse.json({ placement: data, previous }, { headers: NO_STORE });
}
