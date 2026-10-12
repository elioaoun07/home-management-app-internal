// One source transaction serves ERA, precision forms and offline replay.
import { syncItemToGoogleCalendar } from "@/lib/gcal/sync";
import { supabaseServer } from "@/lib/supabase/server";
import { createItemSchema, prepareItemCreate, sourceFailure } from "@/lib/items/createContract";
import { NextRequest, NextResponse } from "next/server";
export const dynamic = "force-dynamic";

export async function POST(request: NextRequest) {
  const supabase = await supabaseServer();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "Unauthorized", completion: { status: "not_started" } }, { status: 401 });
  let input: unknown;
  try { input = await request.json(); }
  catch { return NextResponse.json({ error: "Invalid request body", completion: { status: "not_started" } }, { status: 400 }); }
  const parsed = createItemSchema.safeParse(input);
  if (!parsed.success) return NextResponse.json({ error: parsed.error.flatten(), completion: { status: "not_started" } }, { status: 400 });
  // Custom wall-clock alerts must be calculated on the capture device, not
  // in the server's time zone. Ordinary offsets are safe to calculate here.
  if (parsed.data.alerts.some(a => a.custom_time && !a.trigger_at))
    return NextResponse.json({ error: "Custom alert requires a resolved trigger time", completion: { status: "not_started" } }, { status: 400 });
  try {
    const body = prepareItemCreate(parsed.data);
    const { data, error } = await supabase.rpc("create_item_complete", { p: body });
    if (error) {
      const status = error.code === "23505" ? 409 : error.code === "42501" ? 403 : error.code === "22023" ? 400 : 500;
      const completion = sourceFailure(error.code);
      return NextResponse.json({ error: completion.status === "unknown" ? "Save unverified. Check Schedule before retrying." : "Item was not saved", completion }, { status });
    }
    if (!data?.item?.id || data.completion?.status !== "complete")
      return NextResponse.json({ error: "Save unverified. Check Schedule before retrying.", completion: { status: "unknown" } }, { status: 502 });
    // External backup is explicitly best effort, outside the source receipt.
    await syncItemToGoogleCalendar(supabase, data.item.id).catch(() => {});
    return NextResponse.json(data, { status: 201, headers: { "Cache-Control": "no-store" } });
  } catch {
    return NextResponse.json({ error: "Save unverified. Check Schedule before retrying.", completion: { status: "unknown" } }, { status: 500 });
  }
}
