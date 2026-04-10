import { supabaseServer } from "@/lib/supabase/server";
import { NextResponse } from "next/server";

export async function GET(request: Request) {
  try {
    const supabase = await supabaseServer();
    const {
      data: { user },
    } = await supabase.auth.getUser();

    if (!user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    // Check for household link to also fetch partner's recurring payments
    const { data: link } = await supabase
      .from("household_links")
      .select("owner_user_id, partner_user_id")
      .or(`owner_user_id.eq.${user.id},partner_user_id.eq.${user.id}`)
      .eq("active", true)
      .order("created_at", { ascending: false })
      .limit(1)
      .maybeSingle();

    const partnerId = link
      ? link.owner_user_id === user.id
        ? link.partner_user_id
        : link.owner_user_id
      : null;

    // Build query: own items + partner's non-private items (include inactive for toggle UI)
    let query = supabase.from("recurring_payments").select(
      `
        *,
        account:accounts(id, name, type),
        category:user_categories!recurring_payments_category_id_fkey(id, name, slug, color),
        subcategory:user_categories!recurring_payments_subcategory_id_fkey(id, name, slug)
      `,
    );

    if (partnerId) {
      // Own items + partner's non-private items
      query = query.or(
        `user_id.eq.${user.id},and(user_id.eq.${partnerId},is_private.eq.false)`,
      );
    } else {
      query = query.eq("user_id", user.id);
    }

    const { data, error } = await query.order("next_due_date", {
      ascending: true,
    });

    if (error) {
      console.error("Error fetching recurring payments:", error);
      return NextResponse.json(
        { error: "Failed to fetch recurring payments" },
        { status: 500 },
      );
    }

    return NextResponse.json({ recurring_payments: data || [] });
  } catch (error) {
    console.error("Unexpected error:", error);
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 },
    );
  }
}

export async function POST(request: Request) {
  try {
    const supabase = await supabaseServer();
    const {
      data: { user },
    } = await supabase.auth.getUser();

    if (!user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const body = await request.json();
    const {
      account_id,
      category_id,
      subcategory_id,
      name,
      amount,
      description,
      recurrence_type,
      recurrence_day,
      next_due_date,
      payment_method,
      is_private,
    } = body;

    // Validation
    if (!account_id || !name || !amount || !recurrence_type || !next_due_date) {
      return NextResponse.json(
        { error: "Missing required fields" },
        { status: 400 },
      );
    }

    if (!["daily", "weekly", "monthly", "yearly"].includes(recurrence_type)) {
      return NextResponse.json(
        { error: "Invalid recurrence_type" },
        { status: 400 },
      );
    }
    if (payment_method && !["manual", "auto"].includes(payment_method)) {
      return NextResponse.json(
        { error: "Invalid payment_method" },
        { status: 400 },
      );
    }
    const { data, error } = await supabase
      .from("recurring_payments")
      .insert({
        user_id: user.id,
        account_id,
        category_id: category_id || null,
        subcategory_id: subcategory_id || null,
        name,
        amount,
        description: description || null,
        recurrence_type,
        recurrence_day: recurrence_day || null,
        next_due_date,
        payment_method: payment_method || "manual",
        is_private: is_private ?? false,
        is_active: true,
      })
      .select()
      .single();

    if (error) {
      console.error("Error creating recurring payment:", error);
      return NextResponse.json(
        { error: "Failed to create recurring payment" },
        { status: 500 },
      );
    }

    return NextResponse.json(data, { status: 201 });
  } catch (error) {
    console.error("Unexpected error:", error);
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 },
    );
  }
}
