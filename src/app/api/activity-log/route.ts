import { activityFiltersSchema } from "@/features/activity-log/types";
import { supabaseServer } from "@/lib/supabase/server";
import { cookies } from "next/headers";
import { NextRequest, NextResponse } from "next/server";

export const dynamic = "force-dynamic";
const headers = { "Cache-Control": "private, no-store", Vary: "Cookie" };

export async function GET(request: NextRequest) {
  const supabase = await supabaseServer(await cookies());
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user)
    return NextResponse.json(
      { error: "Unauthorized" },
      { status: 401, headers },
    );
  const parsed = activityFiltersSchema.safeParse(
    Object.fromEntries(request.nextUrl.searchParams),
  );
  if (!parsed.success)
    return NextResponse.json(
      { error: parsed.error.flatten() },
      { status: 400, headers },
    );
  const filters = parsed.data;
  try {
    // auth.uid() is the only reader identity. The RPC checks current household,
    // snapshot audience and current source/parent privacy before pagination.
    const { data, error } = await supabase.rpc("get_household_activity", {
      p_module: filters.module ?? null,
      p_feature: filters.feature ?? null,
      p_actor: filters.actor ?? null,
      p_from: filters.from ?? null,
      p_until: filters.until ?? null,
      p_before: filters.before ?? null,
      p_limit: filters.limit,
    });
    if (error) {
      const setupRequired = error.code === "PGRST202" || error.code === "42883";
      return NextResponse.json(
        {
          error: setupRequired
            ? "Activity log is not enabled yet"
            : "Couldn’t load activity",
          code: setupRequired
            ? "ACTIVITY_SETUP_REQUIRED"
            : "ACTIVITY_READ_FAILED",
        },
        { status: setupRequired ? 503 : 500, headers },
      );
    }
    return NextResponse.json(data, { headers });
  } catch {
    return NextResponse.json(
      { error: "Couldn’t load activity" },
      { status: 500, headers },
    );
  }
}
