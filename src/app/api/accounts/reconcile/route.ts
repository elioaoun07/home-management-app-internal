import { supabaseServer } from "@/lib/supabase/server";
import { cookies } from "next/headers";
import { NextResponse } from "next/server";

export const dynamic = "force-dynamic";

/**
 * POST /api/accounts/reconcile
 *
 * Auto-reconciliation is disabled. Balance correction must be explicit because
 * a read/refresh path must never mutate money.
 */
export async function POST() {
  const supabase = await supabaseServer(await cookies());
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  return NextResponse.json({
    reconciled: 0,
    corrections: 0,
    disabled: true,
  });
}
