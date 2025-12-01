import { supabaseServer } from "@/lib/supabase/server";
import type {
  FuturePurchase,
  FuturePurchaseAllocation,
} from "@/types/futurePurchase";
import { format } from "date-fns";
import { cookies } from "next/headers";
import { NextRequest, NextResponse } from "next/server";

export const dynamic = "force-dynamic";

type RouteContext = {
  params: Promise<{ id: string }>;
};

/**
 * POST /api/future-purchases/[id]/allocate
 * Allocate savings to a future purchase
 */
export async function POST(req: NextRequest, context: RouteContext) {
  const { id } = await context.params;
  const supabase = await supabaseServer(await cookies());
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  try {
    const body = await req.json();
    const { amount, month } = body;

    if (!amount || amount <= 0) {
      return NextResponse.json(
        { error: "amount must be a positive number" },
        { status: 400 }
      );
    }

    // Fetch current purchase
    const { data: purchase, error: fetchError } = await supabase
      .from("future_purchases")
      .select("*")
      .eq("id", id)
      .eq("user_id", user.id)
      .single();

    if (fetchError || !purchase) {
      return NextResponse.json(
        { error: "Purchase not found" },
        { status: 404 }
      );
    }

    // Create new allocation
    const allocationMonth = month || format(new Date(), "yyyy-MM");
    const newAllocation: FuturePurchaseAllocation = {
      month: allocationMonth,
      amount,
      allocated_at: new Date().toISOString(),
    };

    const currentAllocations = (purchase.allocations ||
      []) as FuturePurchaseAllocation[];
    const updatedAllocations = [...currentAllocations, newAllocation];

    // Calculate new saved amount
    const newCurrentSaved = purchase.current_saved + amount;

    // Check if goal is reached
    const isCompleted = newCurrentSaved >= purchase.target_amount;

    // Recalculate recommended monthly savings
    const targetDate = new Date(purchase.target_date);
    const now = new Date();
    const monthsRemaining = Math.max(
      1,
      (targetDate.getFullYear() - now.getFullYear()) * 12 +
        (targetDate.getMonth() - now.getMonth())
    );
    const amountRemaining = purchase.target_amount - newCurrentSaved;
    const recommendedMonthlySavings = Math.max(
      0,
      amountRemaining / monthsRemaining
    );

    // Update the purchase
    const { data, error } = await supabase
      .from("future_purchases")
      .update({
        current_saved: newCurrentSaved,
        allocations: updatedAllocations,
        recommended_monthly_savings: recommendedMonthlySavings,
        status: isCompleted ? "completed" : purchase.status,
        completed_at: isCompleted
          ? new Date().toISOString()
          : purchase.completed_at,
      })
      .eq("id", id)
      .eq("user_id", user.id)
      .select()
      .single();

    if (error) {
      console.error("Error allocating savings:", error);
      return NextResponse.json({ error: error.message }, { status: 500 });
    }

    return NextResponse.json(data as FuturePurchase);
  } catch (e) {
    console.error("Failed to allocate savings:", e);
    return NextResponse.json(
      { error: "Failed to allocate savings" },
      { status: 500 }
    );
  }
}
