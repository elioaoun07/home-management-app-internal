import { healthRpcErrorResponse } from "@/lib/health/medicationServer";
import { supabaseServer } from "@/lib/supabase/server";
import { cookies } from "next/headers";
import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";

export const dynamic = "force-dynamic";

const setDoseSchema = z
  .object({
    taken: z.boolean(),
    // Course slot instant; named as-needed opportunities also send an identity instant.
    // All as-needed doses use a client-generated log id for replay and Undo.
    scheduled_at: z.string().datetime({ offset: true }).nullish(),
    log_id: z.string().uuid().nullish(),
    taken_at: z.string().datetime({ offset: true }).nullish(),
  })
  .refine((v) => !!v.scheduled_at || !!v.log_id, {
    message: "scheduled_at or log_id required",
  });

// POST /api/healthcare/medications/[id]/doses — mark / un-mark one dose.
// Idempotent: a course slot, named as-needed opportunity, or client log id
// identifies the dose. Course Schedule occurrences sync in the same call.
export async function POST(
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
    const parsed = setDoseSchema.safeParse(await req.json());
    if (!parsed.success) {
      return NextResponse.json({ error: parsed.error.flatten() }, { status: 400 });
    }

    const { data, error } = await supabase.rpc("health_set_dose", {
      p_medication_id: id,
      p_taken: parsed.data.taken,
      p_scheduled_at: parsed.data.scheduled_at ?? null,
      p_log_id: parsed.data.log_id ?? null,
      p_taken_at: parsed.data.taken_at ?? null,
    });
    if (error) return healthRpcErrorResponse(error, "Failed to update dose");

    return NextResponse.json(
      { log: data?.log ?? null },
      { headers: { "Cache-Control": "no-store" } },
    );
  } catch {
    return NextResponse.json({ error: "Failed to update dose" }, { status: 500 });
  }
}
