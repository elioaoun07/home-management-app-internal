import { supabaseServer } from "@/lib/supabase/server";
import { cookies } from "next/headers";
import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";

export const dynamic = "force-dynamic";

// POST /api/nfc/[slug]/checklist/complete — toggle checklist item completion
export async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ slug: string }> },
) {
  const { slug } = await params;
  void slug; // tag verified via RLS on checklist_item → tag ownership

  const supabase = await supabaseServer(await cookies());
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const schema = z.object({
    checklist_item_id: z.string().uuid(),
    state_log_id: z.string().uuid(),
    completed: z.boolean(),
  });

  const body = await req.json();
  const parsed = schema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json(
      { error: parsed.error.flatten() },
      { status: 400 },
    );
  }

  const { checklist_item_id, state_log_id, completed } = parsed.data;

  if (completed) {
    // Insert completion (upsert-style: ignore if already exists)
    const { error } = await supabase.from("nfc_checklist_completions").upsert(
      {
        checklist_item_id,
        state_log_id,
        completed_by: user.id,
        completed_at: new Date().toISOString(),
      },
      { onConflict: "checklist_item_id,state_log_id" },
    );

    if (error) {
      return NextResponse.json({ error: error.message }, { status: 500 });
    }

    return NextResponse.json({ completed: true });
  } else {
    // Remove completion
    const { error } = await supabase
      .from("nfc_checklist_completions")
      .delete()
      .eq("checklist_item_id", checklist_item_id)
      .eq("state_log_id", state_log_id);

    if (error) {
      return NextResponse.json({ error: error.message }, { status: 500 });
    }

    return NextResponse.json({ completed: false });
  }
}
