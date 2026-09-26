import {
  healthRpcErrorResponse,
  medicationFieldsSchema,
  normalizeMedicationFields,
  syncMedicationReminders,
  unsyncMedicationReminders,
} from "@/lib/health/medicationServer";
import { supabaseServer } from "@/lib/supabase/server";
import { cookies } from "next/headers";
import { NextRequest, NextResponse } from "next/server";

export const dynamic = "force-dynamic";

// PATCH /api/healthcare/medications/[id] — full replace of the editable
// fields; the RPC then replaces the reminder items (never appends).
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
    const parsed = medicationFieldsSchema.safeParse(await req.json());
    if (!parsed.success) {
      return NextResponse.json({ error: parsed.error.flatten() }, { status: 400 });
    }

    await unsyncMedicationReminders(supabase, [id]);
    const { data, error } = await supabase.rpc("health_save_medication", {
      p_id: id,
      p: normalizeMedicationFields(parsed.data),
    });
    if (error) return healthRpcErrorResponse(error, "Failed to update medication");

    await syncMedicationReminders(supabase, data?.item_ids);
    return NextResponse.json(
      { medication: data.medication },
      { headers: { "Cache-Control": "no-store" } },
    );
  } catch {
    return NextResponse.json({ error: "Failed to update medication" }, { status: 500 });
  }
}

// DELETE /api/healthcare/medications/[id] — soft delete (reminders removed,
// dose history kept). ?restore=true is the Undo.
export async function DELETE(
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
    const restore = req.nextUrl.searchParams.get("restore") === "true";

    if (!restore) await unsyncMedicationReminders(supabase, [id]);
    const { data, error } = await supabase.rpc("health_set_medication_deleted", {
      p_id: id,
      p_deleted: !restore,
    });
    if (error) return healthRpcErrorResponse(error, "Failed to delete medication");

    if (restore) await syncMedicationReminders(supabase, data?.item_ids);
    return NextResponse.json(
      { medication: data.medication },
      { headers: { "Cache-Control": "no-store" } },
    );
  } catch {
    return NextResponse.json({ error: "Failed to delete medication" }, { status: 500 });
  }
}
