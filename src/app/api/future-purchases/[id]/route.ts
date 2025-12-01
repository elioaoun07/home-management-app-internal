import { supabaseServer } from "@/lib/supabase/server";
import type {
  FuturePurchase,
  UpdateFuturePurchaseInput,
} from "@/types/futurePurchase";
import { cookies } from "next/headers";
import { NextRequest, NextResponse } from "next/server";

export const dynamic = "force-dynamic";

type RouteContext = {
  params: Promise<{ id: string }>;
};

export async function GET(req: NextRequest, context: RouteContext) {
  const { id } = await context.params;
  const supabase = await supabaseServer(await cookies());
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { data, error } = await supabase
    .from("future_purchases")
    .select("*")
    .eq("id", id)
    .eq("user_id", user.id)
    .single();

  if (error) {
    console.error("Error fetching future purchase:", error);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  if (!data) {
    return NextResponse.json({ error: "Not found" }, { status: 404 });
  }

  return NextResponse.json(data as FuturePurchase);
}

export async function PATCH(req: NextRequest, context: RouteContext) {
  const { id } = await context.params;
  const supabase = await supabaseServer(await cookies());
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  try {
    const body = (await req.json()) as Partial<UpdateFuturePurchaseInput>;

    // Build update object with only provided fields
    const updateData: Record<string, any> = {};

    if (body.name !== undefined) updateData.name = body.name.trim();
    if (body.description !== undefined)
      updateData.description = body.description?.trim() || null;
    if (body.target_amount !== undefined)
      updateData.target_amount = body.target_amount;
    if (body.urgency !== undefined) updateData.urgency = body.urgency;
    if (body.target_date !== undefined)
      updateData.target_date = body.target_date;
    if (body.icon !== undefined) updateData.icon = body.icon;
    if (body.color !== undefined) updateData.color = body.color;
    if (body.status !== undefined) updateData.status = body.status;
    if (body.current_saved !== undefined)
      updateData.current_saved = body.current_saved;

    // If target_amount or target_date changed, recalculate recommended monthly savings
    if (body.target_amount !== undefined || body.target_date !== undefined) {
      // Fetch current data to use for calculation
      const { data: current } = await supabase
        .from("future_purchases")
        .select("target_amount, target_date, current_saved")
        .eq("id", id)
        .eq("user_id", user.id)
        .single();

      if (current) {
        const targetAmount = body.target_amount ?? current.target_amount;
        const targetDate = new Date(body.target_date ?? current.target_date);
        const currentSaved = body.current_saved ?? current.current_saved;
        const now = new Date();
        const monthsRemaining = Math.max(
          1,
          (targetDate.getFullYear() - now.getFullYear()) * 12 +
            (targetDate.getMonth() - now.getMonth())
        );
        const amountRemaining = targetAmount - currentSaved;
        updateData.recommended_monthly_savings = Math.max(
          0,
          amountRemaining / monthsRemaining
        );
      }
    }

    // If marking as completed, set completed_at
    if (body.status === "completed") {
      updateData.completed_at = new Date().toISOString();
    }

    const { data, error } = await supabase
      .from("future_purchases")
      .update(updateData)
      .eq("id", id)
      .eq("user_id", user.id)
      .select()
      .single();

    if (error) {
      console.error("Error updating future purchase:", error);
      return NextResponse.json({ error: error.message }, { status: 500 });
    }

    return NextResponse.json(data as FuturePurchase);
  } catch (e) {
    console.error("Failed to update future purchase:", e);
    return NextResponse.json(
      { error: "Failed to update future purchase" },
      { status: 500 }
    );
  }
}

export async function DELETE(req: NextRequest, context: RouteContext) {
  const { id } = await context.params;
  const supabase = await supabaseServer(await cookies());
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { error } = await supabase
    .from("future_purchases")
    .delete()
    .eq("id", id)
    .eq("user_id", user.id);

  if (error) {
    console.error("Error deleting future purchase:", error);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  return new NextResponse(null, { status: 204 });
}
