// POST /api/era/actions/status — where each artifact's row is right now.
// The Artifacts view derives Undo/Redo from this, never from a stored flag:
// the row itself is the truth, so a toast Undo, the Recycle Bin, a second
// phone or a later manual edit can never leave a stale button behind.
//   live    — exists and counts            → Undo (created) / Redo (deleted)
//   trashed — soft-deleted, restorable     → Redo (created) / Undo (deleted)
//   changed — a draft that was confirmed   → no button (not the row ERA made)
//   gone    — hard-deleted or not visible  → no button
import { type EraBinModule } from "@/lib/era/artifacts";
import { supabaseServer } from "@/lib/supabase/server";
import { cookies } from "next/headers";
import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";

export const dynamic = "force-dynamic";

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
const BINS = ["items", "catalogue", "transfers", "drafts"] as const satisfies readonly EraBinModule[];

const StatusSchema = z.object({
  items: z
    .array(z.object({ bin: z.enum(BINS), id: z.string().regex(UUID) }))
    .min(1)
    .max(200),
});

export type EraRowStatus = "live" | "trashed" | "changed" | "gone";

const TABLE: Record<EraBinModule, string> = {
  items: "items",
  catalogue: "catalogue_items",
  transfers: "transfers",
  drafts: "transactions",
};

export async function POST(req: NextRequest) {
  const supabase = await supabaseServer(await cookies());
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const body = await req.json().catch(() => null);
  const parsed = StatusSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json({ error: parsed.error.flatten() }, { status: 400 });
  }

  const idsByBin = new Map<EraBinModule, string[]>();
  for (const { bin, id } of parsed.data.items) {
    idsByBin.set(bin, [...(idsByBin.get(bin) ?? []), id]);
  }

  const status: Record<string, EraRowStatus> = {};
  for (const { id } of parsed.data.items) status[id] = "gone";

  for (const [bin, ids] of idsByBin) {
    const columns = bin === "drafts" ? "id, deleted_at, is_draft" : "id, deleted_at";
    const { data, error } = await supabase.from(TABLE[bin]).select(columns).in("id", ids);
    if (error) return NextResponse.json({ error: error.message }, { status: 500 });

    for (const row of (data ?? []) as unknown as { id: string; deleted_at: string | null; is_draft?: boolean }[]) {
      if (bin === "drafts" && !row.is_draft) status[row.id] = "changed";
      else status[row.id] = row.deleted_at ? "trashed" : "live";
    }
  }

  return NextResponse.json({ status });
}
