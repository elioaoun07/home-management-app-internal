import {
  activityFiltersSchema,
  type ActivityEvent,
} from "@/features/activity-log/types";
import { eraArtifactHref, parseEraArtifacts } from "@/lib/era/artifacts";
import { supabaseServer } from "@/lib/supabase/server";
import { cookies } from "next/headers";
import { NextRequest, NextResponse } from "next/server";

export const dynamic = "force-dynamic";
const headers = { "Cache-Control": "private, no-store", Vary: "Cookie" };

type Supabase = Awaited<ReturnType<typeof supabaseServer>>;

/**
 * An ERA message row opens what that turn wrote, not /era: the assistant
 * message carries its artifacts (src/lib/era/artifacts.ts); the link is
 * rebuilt from entity + id, never taken from stored text. era_messages is
 * owner-only (RLS), so a partner's view keeps the module fallback.
 */
async function withEraLinks(
  supabase: Supabase,
  events: ActivityEvent[],
): Promise<ActivityEvent[]> {
  const ids = events
    .filter((e) => e.source_table === "era_messages" && e.available)
    .map((e) => e.source_id);
  if (ids.length === 0) return events;
  try {
    const { data } = await supabase
      .from("era_messages")
      .select("id, intent_payload")
      .in("id", ids);
    const hrefs = new Map<string, string>();
    for (const row of data ?? []) {
      const payload = row.intent_payload as { artifacts?: unknown } | null;
      const first = parseEraArtifacts(payload?.artifacts)[0];
      if (first) hrefs.set(row.id as string, eraArtifactHref(first));
    }
    return events.map((e) =>
      hrefs.has(e.source_id) && e.source_table === "era_messages"
        ? { ...e, href: hrefs.get(e.source_id) }
        : e,
    );
  } catch {
    return events;
  }
}

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
    const page = data as { events?: ActivityEvent[] } | null;
    if (page?.events?.length) {
      page.events = await withEraLinks(supabase, page.events);
    }
    return NextResponse.json(page, { headers });
  } catch {
    return NextResponse.json(
      { error: "Couldn’t load activity" },
      { status: 500, headers },
    );
  }
}
