import { supabaseServer } from "@/lib/supabase/server";
import { cookies } from "next/headers";
import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";

export const dynamic = "force-dynamic";

const updateSchema = z.object({
  amount: z.number().positive(),
  description: z.string().optional(),
  category_id: z.string().nullable().optional(),
  subcategory_id: z.string().nullable().optional(),
  scheduled_date: z.string().min(1),
});

// PATCH /api/future-payments/[id] — update a future payment without confirming it
export async function PATCH(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  try {
    const supabase = await supabaseServer(await cookies());
    const {
      data: { user },
    } = await supabase.auth.getUser();

    if (!user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const { id } = await params;

    const body = await req.json();
    const parsed = updateSchema.safeParse(body);
    if (!parsed.success) {
      return NextResponse.json(
        { error: parsed.error.flatten() },
        { status: 400 },
      );
    }

    // Verify the payment exists and the user owns it
    const { data: payment, error: fetchError } = await supabase
      .from("transactions")
      .select("id, user_id, is_draft")
      .eq("id", id)
      .eq("is_draft", true)
      .single();

    if (fetchError || !payment) {
      return NextResponse.json(
        { error: "Future payment not found" },
        { status: 404 },
      );
    }

    if (payment.user_id !== user.id) {
      return NextResponse.json({ error: "Not authorized" }, { status: 403 });
    }

    const { data: updated, error } = await supabase
      .from("transactions")
      .update({
        amount: parsed.data.amount,
        description: parsed.data.description ?? null,
        category_id: parsed.data.category_id ?? null,
        subcategory_id: parsed.data.subcategory_id ?? null,
        scheduled_date: parsed.data.scheduled_date,
      })
      .eq("id", id)
      .select()
      .single();

    if (error) {
      return NextResponse.json({ error: error.message }, { status: 500 });
    }

    return NextResponse.json(updated);
  } catch (err) {
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 },
    );
  }
}
