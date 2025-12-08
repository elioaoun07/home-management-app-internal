import { supabaseServer } from "@/lib/supabase/server";
import { cookies } from "next/headers";
import { NextResponse } from "next/server";

export const dynamic = "force-dynamic";

// Helper to calculate streak from transactions
function calculateStreak(
  transactions: { date: string }[] | null,
  today: string
): number {
  if (!transactions?.length) return 0;

  const dates = [...new Set(transactions.map((t) => t.date))].sort().reverse();
  const todayDate = new Date(today);
  let streak = 0;

  for (let i = 0; i < dates.length; i++) {
    const expectedDate = new Date(todayDate);
    expectedDate.setDate(todayDate.getDate() - i);
    const expectedStr = expectedDate.toISOString().split("T")[0];

    if (dates[i] === expectedStr) {
      streak++;
    } else {
      break;
    }
  }
  return streak;
}

// GET - Fetch user stats for scoreboard
export async function GET() {
  const supabase = await supabaseServer(await cookies());
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const today = new Date().toISOString().split("T")[0];
  const thirtyDaysAgo = new Date(Date.now() - 30 * 24 * 60 * 60 * 1000)
    .toISOString()
    .split("T")[0];
  const firstOfMonth = new Date();
  firstOfMonth.setDate(1);
  const firstOfMonthStr = firstOfMonth.toISOString().split("T")[0];

  // OPTIMIZED: Run all queries in parallel
  const [householdResult, statsResult, recentTransactionsResult] =
    await Promise.all([
      // Get household info
      supabase
        .from("household_links")
        .select(
          "id, owner_user_id, partner_user_id, owner_email, partner_email"
        )
        .or(`owner_user_id.eq.${user.id},partner_user_id.eq.${user.id}`)
        .eq("active", true)
        .maybeSingle(),
      // Fetch cached user stats
      supabase
        .from("hub_user_stats")
        .select("*")
        .eq("user_id", user.id)
        .eq("stat_period", "alltime")
        .maybeSingle(),
      // Get user's recent transactions (for streak and monthly total)
      supabase
        .from("transactions")
        .select("date, amount")
        .eq("user_id", user.id)
        .gte("date", thirtyDaysAgo)
        .order("date", { ascending: false }),
    ]);

  const household = householdResult.data;
  const stats = statsResult.data;
  const recentTransactions = recentTransactionsResult.data;

  // Calculate user's streak
  const loggingStreak = calculateStreak(recentTransactions, today);

  // Calculate monthly total from recentTransactions (filter for this month)
  const totalSpentMonth = (recentTransactions || [])
    .filter((t) => t.date >= firstOfMonthStr)
    .reduce((sum, t) => sum + (t.amount || 0), 0);

  // Get household stats if in a household
  let householdStats = null;
  if (household) {
    const partnerUserId =
      household.owner_user_id === user.id
        ? household.partner_user_id
        : household.owner_user_id;

    const partnerEmail =
      household.owner_user_id === user.id
        ? household.partner_email
        : household.owner_email;

    if (partnerUserId) {
      // Fetch partner transactions
      const { data: partnerTx } = await supabase
        .from("transactions")
        .select("date, amount")
        .eq("user_id", partnerUserId)
        .gte("date", thirtyDaysAgo);

      const partnerStreak = calculateStreak(partnerTx, today);
      const partnerMonthly = (partnerTx || [])
        .filter((t) => t.date >= firstOfMonthStr)
        .reduce((sum, t) => sum + (t.amount || 0), 0);

      householdStats = {
        partner_email: partnerEmail,
        partner_streak: partnerStreak,
        partner_total_spent: partnerMonthly,
      };
    }
  }

  return NextResponse.json({
    stats: stats || {
      logging_streak: loggingStreak,
      total_spent: totalSpentMonth,
      transaction_count: recentTransactions?.length || 0,
    },
    logging_streak: loggingStreak,
    total_spent_month: totalSpentMonth,
    household: householdStats,
    current_user_id: user.id,
  });
}
