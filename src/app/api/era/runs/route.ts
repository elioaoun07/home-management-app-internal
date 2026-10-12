import { supabaseServer } from "@/lib/supabase/server";
import { cookies } from "next/headers";
import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { createRunSchema, initialRun } from "@/features/era/execution/state";
import {
  validatePlan,
  planAllowedForRequest,
} from "@/features/era/capabilities/plan";

export const dynamic = "force-dynamic";
const headers = { "Cache-Control": "no-store" };
// Runs/consent belong exclusively to the speaker, like ERA conversations.
// Household source visibility remains enforced by each capability's source route.
export async function GET(req: NextRequest) {
  const db = await supabaseServer(await cookies());
  const {
    data: { user },
  } = await db.auth.getUser();
  if (!user)
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  const parsed = z
    .object({ conversationId: z.uuid() })
    .safeParse(Object.fromEntries(req.nextUrl.searchParams));
  if (!parsed.success)
    return NextResponse.json(
      { error: parsed.error.flatten() },
      { status: 400 },
    );
  const [unfinished, latest] = await Promise.all([
    db
      .from("era_runs")
      .select("*")
      .eq("user_id", user.id)
      .eq("conversation_id", parsed.data.conversationId)
      .not("status", "in", "(done,partial,cancelled)")
      .order("created_at", { ascending: true })
      .limit(100),
    db
      .from("era_runs")
      .select("*")
      .eq("user_id", user.id)
      .eq("conversation_id", parsed.data.conversationId)
      .in("status", ["done", "partial", "cancelled"])
      .order("created_at", { ascending: false })
      .limit(1),
  ]);
  if (unfinished.error || latest.error)
    return NextResponse.json(
      { error: "Couldn't load execution history" },
      { status: 503 },
    );
  // Completed newer runs never push older unfinished work out of the window.
  const runs = [...(unfinished.data ?? []), ...(latest.data ?? [])].sort(
    (a, b) => b.created_at.localeCompare(a.created_at),
  );
  return NextResponse.json(runs, { headers });
}

export async function POST(req: NextRequest) {
  const db = await supabaseServer(await cookies());
  const {
    data: { user },
  } = await db.auth.getUser();
  if (!user)
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  const parsed = createRunSchema.safeParse(await req.json().catch(() => null));
  if (!parsed.success)
    return NextResponse.json(
      { error: parsed.error.flatten() },
      { status: 400 },
    );
  const input = parsed.data;
  // Resolved focus IDs must be rebound to their original (not newest) focus.
  const rebound = {
    steps: input.plan.steps.map((s) => {
      const slots = { ...s.slots };
      if (slots.itemId === input.focus?.id) slots.itemId = "FOCUS";
      return { ...s, slots };
    }),
  };
  if (
    !validatePlan(rebound, input.focus) ||
    !planAllowedForRequest(input.plan, input.sourceText)
  )
    return NextResponse.json({ error: "Invalid plan" }, { status: 400 });
  if (Math.abs(Date.now() - Date.parse(input.referenceDate)) > 5 * 60_000)
    return NextResponse.json({ error: "Request expired" }, { status: 400 });
  try {
    new Intl.DateTimeFormat("en", { timeZone: input.timeZone });
  } catch {
    return NextResponse.json({ error: "Invalid time zone" }, { status: 400 });
  }
  // Ensure a locally named fresh conversation exists before the journal FK.
  // A duplicate cannot grant access: the RPC independently checks ownership.
  const { error: ensureError } = await db
    .from("era_conversations")
    .insert({ id: input.conversationId, user_id: user.id });
  if (ensureError && ensureError.code !== "23505")
    return NextResponse.json(
      { error: "Couldn't save execution" },
      { status: 503 },
    );
  const { data, error } = await db.rpc("save_era_run", {
    p_id: input.id,
    p_conversation_id: input.conversationId,
    p_version: -1,
    p_state: initialRun(input),
  });
  if (error)
    return NextResponse.json(
      { error: "Couldn't save execution" },
      {
        status:
          error.code === "23505" ? 409 : error.code === "42501" ? 404 : 503,
      },
    );
  return NextResponse.json(data, { status: 201, headers });
}
