import { supabaseServer } from "@/lib/supabase/server";
import { cookies } from "next/headers";
import { NextResponse } from "next/server";

export const dynamic = "force-dynamic";

// GET - Fetch user stats for scoreboard
export async function GET() {
  const supabase = await supabaseServer(await cookies());
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  // Get household ID for this user
  const { data: household } = await supabase
    .from("household_links")
    .select("id, owner_user_id, partner_user_id, owner_email, partner_email")
    .or(`owner_user_id.eq.${user.id},partner_user_id.eq.${user.id}`)
    .eq("active", true)
    .maybeSingle();

  // Fetch user stats
  const { data: stats, error: statsError } = await supabase
    .from("hub_user_stats")
    .select("*")
    .eq("user_id", user.id)
    .eq("stat_period", "alltime")
    .maybeSingle();

  // Calculate real-time stats from transactions if no cached stats
  const today = new Date().toISOString().split("T")[0];
  const thirtyDaysAgo = new Date(Date.now() - 30 * 24 * 60 * 60 * 1000)
    .toISOString()
    .split("T")[0];

  // Get transaction count for streak calculation
  const { data: recentTransactions } = await supabase
    .from("transactions")
    .select("date, amount")
    .eq("user_id", user.id)
    .gte("date", thirtyDaysAgo)
    .order("date", { ascending: false });

  // Calculate logging streak (consecutive days with transactions)
  let loggingStreak = 0;
  if (recentTransactions?.length) {
    const dates = [...new Set(recentTransactions.map((t) => t.date))]
      .sort()
      .reverse();
    const todayDate = new Date(today);

    for (let i = 0; i < dates.length; i++) {
      const expectedDate = new Date(todayDate);
      expectedDate.setDate(todayDate.getDate() - i);
      const expectedStr = expectedDate.toISOString().split("T")[0];

      if (dates[i] === expectedStr) {
        loggingStreak++;
      } else {
        break;
      }
    }
  }

  // Get total spent this month
  const firstOfMonth = new Date();
  firstOfMonth.setDate(1);
  const { data: monthlyTx } = await supabase
    .from("transactions")
    .select("amount")
    .eq("user_id", user.id)
    .gte("date", firstOfMonth.toISOString().split("T")[0]);

  const totalSpentMonth =
    monthlyTx?.reduce((sum, t) => sum + (t.amount || 0), 0) || 0;

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
      const { data: partnerTx } = await supabase
        .from("transactions")
        .select("date, amount")
        .eq("user_id", partnerUserId)
        .gte("date", thirtyDaysAgo);

      // Calculate partner streak
      let partnerStreak = 0;
      if (partnerTx?.length) {
        const dates = [...new Set(partnerTx.map((t) => t.date))]
          .sort()
          .reverse();
        const todayDate = new Date(today);

        for (let i = 0; i < dates.length; i++) {
          const expectedDate = new Date(todayDate);
          expectedDate.setDate(todayDate.getDate() - i);
          const expectedStr = expectedDate.toISOString().split("T")[0];

          if (dates[i] === expectedStr) {
            partnerStreak++;
          } else {
            break;
          }
        }
      }

      const partnerMonthly =
        partnerTx
          ?.filter((t) => t.date >= firstOfMonth.toISOString().split("T")[0])
          .reduce((sum, t) => sum + (t.amount || 0), 0) || 0;

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
