// Complete many items / occurrences in one request (Chores → done for every
// room at once). Every entry is idempotent (upsert on item+occurrence+type), so
// a retry after a lost response or an offline replay cannot double-complete.
import { syncItemToGoogleCalendar } from "@/lib/gcal/sync";
import {
  bulkCompleteSchema,
  bulkUncompleteSchema,
  completeItemForUser,
  uncompleteItemForUser,
} from "@/lib/items/completeItems";
import { supabaseAdmin } from "@/lib/supabase/admin";
import { supabaseServer } from "@/lib/supabase/server";
import { after, NextRequest, NextResponse } from "next/server";

export const dynamic = "force-dynamic";
// The Google backup runs after the response and needs room for a full batch
export const maxDuration = 60;

const NO_STORE = { "Cache-Control": "no-store" };

/** A few entries at a time: each is several small writes. */
async function inSmallGroups<T, R>(list: T[], work: (entry: T) => Promise<R>): Promise<R[]> {
  const out: R[] = [];
  for (let i = 0; i < list.length; i += 3) {
    out.push(...(await Promise.all(list.slice(i, i + 3).map(work))));
  }
  return out;
}

async function readBody(request: NextRequest): Promise<unknown> {
  try {
    return await request.json();
  } catch {
    return undefined;
  }
}

export async function POST(request: NextRequest) {
  const supabase = await supabaseServer();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  const parsed = bulkCompleteSchema.safeParse(await readBody(request));
  if (!parsed.success) return NextResponse.json({ error: parsed.error.flatten() }, { status: 400 });
  try {
    // Admin for data ops, like the single route: partners complete items they don't own
    const adminDb = supabaseAdmin();
    const results = await inSmallGroups(parsed.data.entries, async (entry) => {
      const outcome = await completeItemForUser(adminDb, user.id, entry.item_id, entry, { syncCalendar: false });
      return outcome.ok
        ? { item_id: entry.item_id, ok: true as const, type: outcome.type }
        : { item_id: entry.item_id, ok: false as const, status: outcome.status };
    });
    // Completed one-offs leave the Google backup; best effort, off the request path
    const finished = results.filter((r) => r.ok && r.type === "item").map((r) => r.item_id);
    if (finished.length > 0) {
      after(() => inSmallGroups(finished, (id) => syncItemToGoogleCalendar(adminDb, id)));
    }
    return NextResponse.json({ results }, { headers: NO_STORE });
  } catch (error) {
    console.error("[items-bulk-complete] Unexpected error:", error);
    return NextResponse.json({ error: "Completion unverified" }, { status: 500 });
  }
}

/** Undo of a bulk completion. */
export async function DELETE(request: NextRequest) {
  const supabase = await supabaseServer();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  const parsed = bulkUncompleteSchema.safeParse(await readBody(request));
  if (!parsed.success) return NextResponse.json({ error: parsed.error.flatten() }, { status: 400 });
  try {
    const adminDb = supabaseAdmin();
    const results = await inSmallGroups(parsed.data.entries, async (entry) => {
      const outcome = await uncompleteItemForUser(adminDb, user.id, entry);
      return { item_id: entry.item_id, ok: outcome.ok };
    });
    const reopened = parsed.data.entries
      .filter((entry, i) => results[i].ok && !entry.is_recurring)
      .map((entry) => entry.item_id);
    if (reopened.length > 0) {
      after(() => inSmallGroups(reopened, (id) => syncItemToGoogleCalendar(adminDb, id)));
    }
    return NextResponse.json({ results }, { headers: NO_STORE });
  } catch (error) {
    console.error("[items-bulk-complete] Undo failed:", error);
    return NextResponse.json({ error: "Undo unverified" }, { status: 500 });
  }
}
