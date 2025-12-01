import { supabaseServer } from "@/lib/supabase/server";
import type {
  CreateFuturePurchaseInput,
  FuturePurchase,
} from "@/types/futurePurchase";
import { cookies } from "next/headers";
import { NextRequest, NextResponse } from "next/server";

export const dynamic = "force-dynamic";

export async function GET(req: NextRequest) {
  const supabase = await supabaseServer(await cookies());
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  // Optional status filter
  const status = req.nextUrl.searchParams.get("status");

  let query = supabase
    .from("future_purchases")
    .select("*")
    .eq("user_id", user.id)
    .order("urgency", { ascending: false })
    .order("target_date", { ascending: true });

  if (status) {
    query = query.eq("status", status);
  }

  const { data, error } = await query;

  if (error) {
    console.error("Error fetching future purchases:", error);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  return NextResponse.json(data as FuturePurchase[], {
    headers: { "Cache-Control": "no-store" },
  });
}

export async function POST(req: NextRequest) {
  const supabase = await supabaseServer(await cookies());
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  try {
    const body = (await req.json()) as CreateFuturePurchaseInput;
    const {
      name,
      description,
      target_amount,
      urgency,
      target_date,
      icon,
      color,
    } = body;

    // Validation
    if (!name || !target_amount || !urgency || !target_date) {
      return NextResponse.json(
        { error: "name, target_amount, urgency, and target_date are required" },
        { status: 400 }
      );
    }

    if (target_amount <= 0) {
      return NextResponse.json(
        { error: "target_amount must be positive" },
        { status: 400 }
      );
    }

    if (urgency < 1 || urgency > 5) {
      return NextResponse.json(
        { error: "urgency must be between 1 and 5" },
        { status: 400 }
      );
    }

    // Calculate recommended monthly savings
    const targetDate = new Date(target_date);
    const now = new Date();
    const monthsRemaining = Math.max(
      1,
      (targetDate.getFullYear() - now.getFullYear()) * 12 +
        (targetDate.getMonth() - now.getMonth())
    );
    const recommendedMonthlySavings = target_amount / monthsRemaining;

    const { data, error } = await supabase
      .from("future_purchases")
      .insert({
        user_id: user.id,
        name: name.trim(),
        description: description?.trim() || null,
        target_amount,
        urgency,
        target_date,
        icon: icon || "package",
        color: color || "#38bdf8",
        recommended_monthly_savings: recommendedMonthlySavings,
        status: "active",
        current_saved: 0,
        allocations: [],
      })
      .select()
      .single();

    if (error) {
      console.error("Error creating future purchase:", error);
      return NextResponse.json({ error: error.message }, { status: 500 });
    }

    return NextResponse.json(data as FuturePurchase, { status: 201 });
  } catch (e) {
    console.error("Failed to create future purchase:", e);
    return NextResponse.json(
      { error: "Failed to create future purchase" },
      { status: 500 }
    );
  }
}
