import { DEFAULT_CATEGORIES } from "@/constants/defaultCategories";
import { supabaseAdmin } from "@/lib/supabase/admin";
import { supabaseServer } from "@/lib/supabase/server";
import { cookies } from "next/headers";
import { NextRequest, NextResponse } from "next/server";

export const dynamic = "force-dynamic";

export async function POST(
  _req: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  const { id } = await params;
  const supabase = await supabaseServer(await cookies());
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { data: trip, error: tripErr } = await supabase
    .from("trips")
    .select("*")
    .eq("id", id)
    .eq("user_id", user.id)
    .single();

  if (tripErr || !trip) return NextResponse.json({ error: "Trip not found" }, { status: 404 });
  if (trip.status === "active") return NextResponse.json({ error: "Trip already active" }, { status: 409 });
  if (!trip.start_date || !trip.end_date) {
    return NextResponse.json({ error: "Trip must have start_date and end_date before activation" }, { status: 400 });
  }

  const admin = supabaseAdmin();

  // ── 1. Create trip account ──────────────────────────────────────────────
  const { data: account, error: accountErr } = await admin
    .from("accounts")
    .insert({
      user_id: user.id,
      name: trip.name,
      type: "expense",
      country_code: trip.destination_country_code ?? null,
      location_name: trip.destination_name ?? null,
    })
    .select("id")
    .single();

  if (accountErr) {
    return NextResponse.json({ error: `Failed to create trip account: ${accountErr.message}` }, { status: 500 });
  }

  // Seed default expense categories
  if (account?.id) {
    let pos = 0;
    for (const cat of DEFAULT_CATEGORIES) {
      pos++;
      const { data: root } = await admin
        .from("user_categories")
        .insert({
          user_id: user.id,
          account_id: account.id,
          name: cat.name,
          color: cat.color,
          parent_id: null,
          position: cat.position ?? pos,
          visible: true,
        })
        .select("id")
        .single();

      if (root?.id && Array.isArray(cat.subcategories)) {
        let subPos = 0;
        for (const sub of cat.subcategories) {
          subPos++;
          await admin.from("user_categories").insert({
            user_id: user.id,
            account_id: account.id,
            name: sub.name,
            color: sub.color,
            parent_id: root.id,
            position: (sub as any).position ?? subPos,
            visible: true,
          });
        }
      }
    }

    await admin.from("account_balances").insert({
      account_id: account.id,
      user_id: user.id,
      balance: 0,
    });
  }

  // ── 2. Run activation RPC ───────────────────────────────────────────────
  const { data: rpcResult, error: rpcErr } = await admin
    .rpc("activate_trip", { p_trip_id: id });

  if (rpcErr) {
    if (account?.id) {
      await admin.from("accounts").delete().eq("id", account.id);
    }
    return NextResponse.json({ error: `Activation failed: ${rpcErr.message}` }, { status: 500 });
  }

  // ── 3. Update trip record ───────────────────────────────────────────────
  const { data: updatedTrip, error: updateErr } = await admin
    .from("trips")
    .update({
      account_id: account?.id ?? null,
      status: "active",
      activated_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
    })
    .eq("id", id)
    .select()
    .single();

  if (updateErr) {
    return NextResponse.json({ error: updateErr.message }, { status: 500 });
  }

  return NextResponse.json(
    { trip: updatedTrip, effects: rpcResult },
    { status: 200 },
  );
}
