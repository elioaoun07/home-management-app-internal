import {
  healthRpcErrorResponse,
  medicationFieldsSchema,
  normalizeMedicationFields,
  syncMedicationReminders,
} from "@/lib/health/medicationServer";
import { supabaseServer } from "@/lib/supabase/server";
import { cookies } from "next/headers";
import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";

export const dynamic = "force-dynamic";

const createMedicationSchema = medicationFieldsSchema.and(
  z.object({ profile_id: z.string().uuid() }),
);

// POST /api/healthcare/medications — medication + its dose-time reminder
// items are written in ONE transaction by health_save_medication().
export async function POST(req: NextRequest) {
  const supabase = await supabaseServer(await cookies());
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  try {
    const parsed = createMedicationSchema.safeParse(await req.json());
    if (!parsed.success) {
      return NextResponse.json({ error: parsed.error.flatten() }, { status: 400 });
    }
    const { profile_id, ...fields } = parsed.data;

    const { data, error } = await supabase.rpc("health_save_medication", {
      p_id: null,
      p: { ...normalizeMedicationFields(fields), profile_id },
    });
    if (error) return healthRpcErrorResponse(error, "Failed to create medication");

    await syncMedicationReminders(supabase, data?.item_ids);
    return NextResponse.json(
      { medication: data.medication },
      { status: 201, headers: { "Cache-Control": "no-store" } },
    );
  } catch {
    return NextResponse.json({ error: "Failed to create medication" }, { status: 500 });
  }
}
