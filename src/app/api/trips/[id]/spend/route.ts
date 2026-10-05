// GET /api/trips/[id]/spend — per-currency totals + the rows behind them, for everything that counts
// toward a trip: transactions in the trip's linked account ∪ transactions
// tagged with trip_id (any account, any date). One query with an OR, so a
// transaction that is both in the trip account and tagged counts exactly once.
// Amounts are summed in each account's own currency — never converted.
// Only `expense` accounts count: a tagged row on an income/saving account adds
// to that balance, so summing it as spend would be wrong.
import { getAccessibleTrip } from "@/lib/tripAccess";
import { summarizeTripSpend, type TripSpendRow } from "@/lib/tripSpend";
import { supabaseServer } from "@/lib/supabase/server";
import { cookies } from "next/headers";
import { NextRequest, NextResponse } from "next/server";

export const dynamic = "force-dynamic";

type AccountRef = { name: string; currency: string | null; type: string };
type SpendRow = {
  id: string;
  date: string;
  amount: number | string;
  description: string | null;
  is_private: boolean | null;
  user_id: string;
  account: AccountRef | AccountRef[] | null;
};

export async function GET(
  _req: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  const { id } = await params;
  const supabase = await supabaseServer(await cookies());
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const access = await getAccessibleTrip(supabase, user.id, id);
  if (!access) return NextResponse.json({ error: "Trip not found" }, { status: 404 });

  const { trip } = access;
  const filter = trip.account_id
    ? `trip_id.eq.${trip.id},account_id.eq.${trip.account_id}`
    : `trip_id.eq.${trip.id}`;

  const run = (orFilter: string) =>
    supabase
      .from("transactions")
      .select("id, date, amount, description, is_private, user_id, account:accounts!transactions_account_id_fkey(name, currency, type)")
      .or(orFilter)
      .is("deleted_at", null)
      .eq("is_draft", false)
      .order("date", { ascending: false })
      .limit(5000);

  let { data, error } = await run(filter);
  // 42703 = undefined column: the trip_id migration hasn't been applied yet.
  // Fall back to the trip account alone so spend there still shows.
  if (error?.code === "42703" && trip.account_id) {
    ({ data, error } = await run(`account_id.eq.${trip.account_id}`));
  }

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });

  const { totals, transactions } = summarizeTripSpend((data ?? []) as unknown as TripSpendRow[], user.id);

  return NextResponse.json({ totals, transactions }, { headers: { "Cache-Control": "no-store" } });
}
