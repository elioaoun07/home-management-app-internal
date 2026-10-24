import { supabaseServer } from "@/lib/supabase/server";
import { cookies } from "next/headers";
import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";

export const dynamic = "force-dynamic";

const bodySchema = z.object({ transfer_id: z.string().uuid() });

export async function GET() {
  const supabase = await supabaseServer(await cookies());
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { data, error } = await supabase
    .from("transfer_acknowledgements")
    .select("transfer_id")
    .eq("user_id", user.id)
    .order("acknowledged_at", { ascending: false })
    .limit(200);
  if (error) {
    console.error("transfer acknowledgements GET failed", error);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
  return NextResponse.json((data ?? []).map((r) => r.transfer_id));
}

export async function POST(request: NextRequest) {
  const supabase = await supabaseServer(await cookies());
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const parsed = bodySchema.safeParse(await request.json().catch(() => null));
  if (!parsed.success) {
    return NextResponse.json({ error: "Invalid body" }, { status: 400 });
  }

  const { error } = await supabase
    .from("transfer_acknowledgements")
    .upsert(
      { user_id: user.id, transfer_id: parsed.data.transfer_id },
      { onConflict: "user_id,transfer_id", ignoreDuplicates: true },
    );
  if (error) {
    console.error("transfer acknowledgements POST failed", error);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
  return NextResponse.json({ ok: true });
}
