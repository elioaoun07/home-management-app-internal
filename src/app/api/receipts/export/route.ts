import { supabaseAdmin } from "@/lib/supabase/admin";
import { supabaseServer } from "@/lib/supabase/server";
import { cookies } from "next/headers";
import { NextRequest, NextResponse } from "next/server";

export const dynamic = "force-dynamic";

// GET /api/receipts/export?year=2025
// Returns receipt metadata + 2-hour signed URLs for client-side ZIP building.
export async function GET(req: NextRequest) {
  const supabase = await supabaseServer(await cookies());
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const year = req.nextUrl.searchParams.get("year");
  if (!year || !/^\d{4}$/.test(year))
    return NextResponse.json({ error: "Invalid year" }, { status: 400 });

  const from = `${year}-01-01`;
  const to = `${parseInt(year) + 1}-01-01`;

  const { data: transactions, error } = await supabase
    .from("transactions")
    .select("id, date, description, amount, receipt_url")
    .eq("user_id", user.id)
    .not("receipt_url", "is", null)
    .gte("date", from)
    .lt("date", to)
    .order("date", { ascending: true });

  if (error) {
    console.error("Export query error:", error);
    return NextResponse.json({ error: "Query failed" }, { status: 500 });
  }

  const admin = supabaseAdmin();

  // Generate 2-hour signed URLs for each receipt
  const receipts = await Promise.all(
    (transactions ?? []).map(async (tx) => {
      const { data: signed } = await admin.storage
        .from("receipts")
        .createSignedUrl(tx.receipt_url!, 2 * 60 * 60);

      return {
        transaction_id: tx.id,
        date: tx.date,
        description: tx.description,
        amount: tx.amount,
        receipt_path: tx.receipt_url,
        signed_url: signed?.signedUrl ?? null,
      };
    }),
  );

  return NextResponse.json({ year, receipts });
}
