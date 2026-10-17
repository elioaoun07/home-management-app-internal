// Many items in one request (SCH-25). Every item carries a client id, so a retry
// after a lost response returns the same rows instead of creating them twice.
import { deleteItemFromGoogleCalendar, syncItemToGoogleCalendar } from "@/lib/gcal/sync";
import { supabaseServer } from "@/lib/supabase/server";
import {
  bulkCreateItemsSchema,
  bulkCreateReceiptSchema,
  bulkDeleteItemsSchema,
  prepareItemCreate,
  sourceFailure,
} from "@/lib/items/createContract";
import type { SupabaseClient } from "@supabase/supabase-js";
import { after, NextRequest, NextResponse } from "next/server";

export const dynamic = "force-dynamic";
// The Google backup runs after the response and needs room for a full batch
export const maxDuration = 60;

const NO_STORE = { "Cache-Control": "no-store" };

/** Google rate-limits per user: a few at a time, never on the request path. */
async function runInSmallGroups(ids: string[], work: (id: string) => Promise<void>) {
  for (let i = 0; i < ids.length; i += 3) {
    await Promise.all(ids.slice(i, i + 3).map(work));
  }
}

export async function POST(request: NextRequest) {
  const supabase = await supabaseServer();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "Unauthorized", completion: { status: "not_started" } }, { status: 401 });
  let input: unknown;
  try { input = await request.json(); }
  catch { return NextResponse.json({ error: "Invalid request body", completion: { status: "not_started" } }, { status: 400 }); }
  const parsed = bulkCreateItemsSchema.safeParse(input);
  if (!parsed.success) return NextResponse.json({ error: parsed.error.flatten(), completion: { status: "not_started" } }, { status: 400 });
  // Same rule as the single route: a custom wall-clock alert is resolved on the device
  if (parsed.data.items.some((item) => item.alerts.some((a) => a.custom_time && !a.trigger_at)))
    return NextResponse.json({ error: "Custom alert requires a resolved trigger time", completion: { status: "not_started" } }, { status: 400 });
  try {
    const bodies = parsed.data.items.map((item) => prepareItemCreate(item));
    const { data, error } = await supabase.rpc("create_items_bulk", { p: bodies });
    if (error) {
      // 501: the SCH-25 migration has not been run, so retrying or queueing cannot help
      const status = error.code === "PGRST202" ? 501 : error.code === "42501" ? 403 : error.code === "22023" ? 400 : 500;
      const completion = sourceFailure(error.code);
      return NextResponse.json({ error: completion.status === "unknown" ? "Save unverified. Check Schedule before retrying." : "Items were not saved", completion }, { status });
    }
    const receipt = bulkCreateReceiptSchema.safeParse(data);
    if (!receipt.success)
      return NextResponse.json({ error: "Save unverified. Check Schedule before retrying.", completion: { status: "unknown" } }, { status: 502 });
    const saved = receipt.data.items.map((item) => item.id);
    // External backup is best effort and outside the source receipt
    if (saved.length > 0) {
      after(() => runInSmallGroups(saved, (id) => syncItemToGoogleCalendar(supabase as SupabaseClient, id)));
    }
    return NextResponse.json(receipt.data, { status: 201, headers: NO_STORE });
  } catch {
    return NextResponse.json({ error: "Save unverified. Check Schedule before retrying.", completion: { status: "unknown" } }, { status: 500 });
  }
}

/** Take many items back in one request (Undo of a bulk create). */
export async function DELETE(request: NextRequest) {
  const supabase = await supabaseServer();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  let input: unknown;
  try { input = await request.json(); }
  catch { return NextResponse.json({ error: "Invalid request body" }, { status: 400 }); }
  const parsed = bulkDeleteItemsSchema.safeParse(input);
  if (!parsed.success) return NextResponse.json({ error: parsed.error.flatten() }, { status: 400 });
  const { ids } = parsed.data;
  try {
    // Remove the Google events first: once the row is gone its event id is lost
    const { data: backed } = await supabase.from("items").select("id").in("id", ids).not("google_event_id", "is", null);
    await runInSmallGroups((backed ?? []).map((row) => row.id as string), (id) => deleteItemFromGoogleCalendar(supabase as SupabaseClient, id));
    const { data, error } = await supabase.from("items").delete().in("id", ids).select("id");
    if (error) return NextResponse.json({ error: "Items were not deleted" }, { status: 500 });
    return NextResponse.json({ deleted: (data ?? []).map((row) => row.id as string) }, { headers: NO_STORE });
  } catch {
    return NextResponse.json({ error: "Items were not deleted" }, { status: 500 });
  }
}
