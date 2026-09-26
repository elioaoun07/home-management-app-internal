// src/lib/health/medicationServer.ts
//
// SERVER-ONLY helpers shared by the /api/healthcare/medications routes and the
// profile delete/restore route (imports the Google Calendar sync, which pulls
// googleapis — never import this from client code).
//
// Reminder items are created/replaced inside the health_* RPCs (one
// transaction, migrations/2026-09-26_healthcare-medications.sql). Google
// Calendar is a best-effort backup channel handled here around those calls:
// events are removed BEFORE a rebuild deletes the items (afterwards the
// google_event_id is gone) and created AFTER it returns the new item ids.

import { deleteItemFromGoogleCalendar, syncItemToGoogleCalendar } from "@/lib/gcal/sync";
import type { PostgrestError, SupabaseClient } from "@supabase/supabase-js";
import { NextResponse } from "next/server";
import { z } from "zod";

const HHMM = /^([01]\d|2[0-3]):[0-5]\d$/;

function isTimeZone(tz: string): boolean {
  try {
    new Intl.DateTimeFormat("en-US", { timeZone: tz });
    return true;
  } catch {
    return false;
  }
}

/** Every editable field — PATCH is a full replace (the form always sends all). */
export const medicationFieldsSchema = z
  .object({
    name: z.string().trim().min(1).max(120),
    dosage: z.string().trim().max(60).nullish(),
    mode: z.enum(["course", "as_needed"]),
    food_timing: z.enum(["any", "empty_stomach", "with_food"]).default("any"),
    dose_times: z.array(z.string().regex(HHMM)).max(12).default([]),
    timezone: z.string().min(1).refine(isTimeZone, "Invalid timezone"),
    starts_at: z.string().datetime({ offset: true }),
    ends_at: z.string().datetime({ offset: true }).nullish(),
    min_hours_between: z.number().positive().max(168).nullish(),
    max_per_day: z.number().int().positive().max(48).nullish(),
    notes: z.string().max(2000).nullish(),
  })
  .superRefine((v, ctx) => {
    if (v.mode === "course" && v.dose_times.length === 0) {
      ctx.addIssue({ code: "custom", path: ["dose_times"], message: "At least one dose time" });
    }
    if (v.ends_at && new Date(v.ends_at) <= new Date(v.starts_at)) {
      ctx.addIssue({ code: "custom", path: ["ends_at"], message: "End must be after the first dose" });
    }
  });

export type MedicationFields = z.infer<typeof medicationFieldsSchema>;

/** Drop fields that don't apply to the mode so the row never carries stale ones. */
export function normalizeMedicationFields(v: MedicationFields) {
  const course = v.mode === "course";
  return {
    ...v,
    dosage: v.dosage || null,
    notes: v.notes || null,
    ends_at: v.ends_at ?? null,
    dose_times: course ? [...new Set(v.dose_times)].sort() : [],
    min_hours_between: course ? null : (v.min_hours_between ?? null),
    max_per_day: course ? null : (v.max_per_day ?? null),
  };
}

/** Map an RPC error to an HTTP response (codes raised in the health_* RPCs). */
export function healthRpcErrorResponse(error: PostgrestError, fallback: string) {
  switch (error.code) {
    case "P0002":
      return NextResponse.json({ error: "Medication not found" }, { status: 404 });
    case "42501":
      return NextResponse.json({ error: "Forbidden" }, { status: 403 });
    case "23505":
      return NextResponse.json({ error: "Already exists" }, { status: 409 });
    case "22023":
    case "22P02":
    case "23514":
      return NextResponse.json({ error: error.message }, { status: 400 });
    default:
      console.error(`[healthcare/medications] ${fallback}:`, error);
      return NextResponse.json({ error: error.message || fallback }, { status: 500 });
  }
}

/** Remove Google events of the medications' current reminder items. */
export async function unsyncMedicationReminders(
  supabase: SupabaseClient,
  medicationIds: string[],
): Promise<void> {
  if (medicationIds.length === 0) return;
  const { data } = await supabase
    .from("items")
    .select("id")
    .in("source_medication_id", medicationIds)
    .not("google_event_id", "is", null);
  await Promise.all(
    (data ?? []).map((i: { id: string }) => deleteItemFromGoogleCalendar(supabase, i.id)),
  );
}

/** Push freshly created reminder items to Google Calendar (best effort). */
export async function syncMedicationReminders(
  supabase: SupabaseClient,
  itemIds: string[] | null | undefined,
): Promise<void> {
  await Promise.all((itemIds ?? []).map((id) => syncItemToGoogleCalendar(supabase, id)));
}

/**
 * Profile soft delete / restore: stop or recreate the reminders of every
 * medication under it. Best effort — never blocks the profile mutation.
 */
export async function rebuildProfileMedicationReminders(
  supabase: SupabaseClient,
  profileId: string,
  restoring: boolean,
): Promise<void> {
  try {
    const { data: meds, error } = await supabase
      .from("health_medications")
      .select("id")
      .eq("profile_id", profileId)
      .is("deleted_at", null);
    if (error || !meds?.length) return;
    const ids = meds.map((m: { id: string }) => m.id);
    if (!restoring) await unsyncMedicationReminders(supabase, ids);
    for (const id of ids) {
      const { data } = await supabase.rpc("health_rebuild_medication_reminders", {
        p_medication_id: id,
      });
      if (restoring) await syncMedicationReminders(supabase, data as string[] | null);
    }
  } catch (err) {
    console.error("[healthcare/profiles] medication reminder rebuild failed:", err);
  }
}
