// src/app/api/recycle-bin/restore/route.ts
import { adjustAccountBalance } from "@/lib/balance";
import { getBalanceDelta, getTransferDeltas, type AccountType } from "@/lib/balance-utils";
import { syncItemToGoogleCalendar } from "@/lib/gcal/sync";
import { getRecycleBinModule } from "@/lib/recycleBin/registry";
import { resolveScope } from "@/lib/recycleBin/scope";
import { supabaseAdmin } from "@/lib/supabase/admin";
import { supabaseServer } from "@/lib/supabase/server";
import { cookies } from "next/headers";
import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";

export const dynamic = "force-dynamic";

const schema = z.object({
  module: z.string().min(1),
  id: z.string().min(1),
});

export async function POST(req: NextRequest) {
  const supabase = await supabaseServer(await cookies());
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user)
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const body = await req.json().catch(() => null);
  const parsed = schema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json(
      { error: parsed.error.flatten() },
      { status: 400 },
    );
  }

  const binModule = getRecycleBinModule(parsed.data.module);
  if (!binModule) {
    return NextResponse.json({ error: "Unknown module" }, { status: 400 });
  }

  const scope = await resolveScope(supabase, user.id, false);

  // Confirm the row is in scope and currently trashed.
  let fetchQuery = supabase
    .from(binModule.table)
    .select(binModule.selectColumns)
    .eq("id", parsed.data.id)
    .not(binModule.deletedAtColumn, "is", null);
  if (binModule.scope === "user") {
    fetchQuery = fetchQuery.in("user_id", scope.userIds);
  } else if (binModule.scope === "household" && scope.householdId) {
    fetchQuery = fetchQuery.eq("household_id", scope.householdId);
  }
  const { data: row, error: fetchErr } = await fetchQuery.maybeSingle();
  if (fetchErr)
    return NextResponse.json({ error: fetchErr.message }, { status: 500 });
  if (!row) return NextResponse.json({ error: "Not found" }, { status: 404 });

  // Transfers: DELETE /api/transfers/[id] reversed the balances using the
  // row's amounts incl. `to_amount` (cross-currency). The bin's selectColumns
  // omit it, so read it BEFORE touching the row — a failed read must abort,
  // never fall back to a symmetric delta that would corrupt the destination.
  let transferToAmount: number | undefined;
  if (binModule.table === "transfers") {
    const { data: full, error: fullErr } = await supabase
      .from("transfers")
      .select("to_amount")
      .eq("id", parsed.data.id)
      .maybeSingle();
    if (fullErr || !full) {
      return NextResponse.json({ error: "Could not read transfer" }, { status: 500 });
    }
    transferToAmount = full.to_amount != null ? Number(full.to_amount) : undefined;
  }

  // Compare-and-set: only the call that actually flips deleted_at proceeds to
  // the balance work below. Two concurrent restores (double tap, two phones)
  // would otherwise both re-apply the delta.
  const { data: restored, error: updateErr } = await supabase
    .from(binModule.table)
    .update({ [binModule.deletedAtColumn]: null })
    .eq("id", parsed.data.id)
    .not(binModule.deletedAtColumn, "is", null)
    .select("id");
  if (updateErr) {
    return NextResponse.json({ error: updateErr.message }, { status: 500 });
  }
  if (!restored?.length) {
    return NextResponse.json({ error: "Not found" }, { status: 404 });
  }

  // Deleting a transaction reverses its balance delta
  // (api/transactions/[id]/route.ts). Restoring never re-applied it, so every
  // restore left the account short by the transaction amount, permanently and
  // silently. Drafts are excluded: they were never counted in the balance.
  // Lives here rather than in the registry because the registry is imported by
  // client code and the balance helpers are server-only.
  if (binModule.table === "transactions") {
    const tx = row as unknown as {
      amount: number | string;
      account_id: string | null;
      is_draft?: boolean;
      is_debt_return?: boolean;
    };
    if (!tx.is_draft && tx.account_id) {
      const { data: account } = await supabase
        .from("accounts")
        .select("type")
        .eq("id", tx.account_id)
        .maybeSingle();
      if (account) {
        await adjustAccountBalance(
          tx.account_id,
          getBalanceDelta(
            Math.abs(Number(tx.amount)),
            account.type as AccountType,
            !!tx.is_debt_return,
            "create",
          ),
          "transaction_restored",
          { userId: user.id, transactionId: parsed.data.id },
        );
      }
    }
  }

  // Deleting a transfer reverses both legs (api/transfers/[id]/route.ts) and
  // restoring only cleared deleted_at, so a restored transfer silently left
  // both accounts off by its amount. Re-apply exactly the deltas the delete
  // reversed — same getTransferDeltas inputs, opposite of the reversal.
  if (binModule.table === "transfers") {
    const t = row as unknown as {
      from_account_id: string;
      to_account_id: string;
      amount: number | string;
      returned_amount?: number | string | null;
      transfer_type?: string | null;
    };
    const { fromDelta, toDelta } = getTransferDeltas(
      Number(t.amount),
      Number(t.returned_amount || 0),
      (t.transfer_type || "self") as "self" | "household",
      transferToAmount,
    );
    const meta = {
      userId: user.id,
      transferId: parsed.data.id,
      reason: "Restored transfer",
    };
    await adjustAccountBalance(t.from_account_id, fromDelta, "transfer_out", meta);
    await adjustAccountBalance(t.to_account_id, toDelta, "transfer_in", meta);
  }

  if (binModule.onRestore) {
    try {
      await binModule.onRestore({
        row: row as never,
        supabase: supabase as never,
        admin: supabaseAdmin() as never,
        userId: user.id,
      });
    } catch (e) {
      console.error("[recycle-bin] onRestore failed", e);
    }
  }

  // A restored item is sync-eligible again — re-push its Google Calendar
  // event. Lives here (not in the registry's onRestore) because the registry
  // is imported by client code and the sync engine must stay server-only.
  if (binModule.table === "items") {
    // DELETE /api/items/[id] switched off every active alert so the cron stops
    // firing for a trashed item; restoring only cleared deleted_at, leaving the
    // item silently mute. Re-arm alerts that never fired, unless the item was
    // finished or archived (those cascades also switch alerts off).
    const { data: item } = await supabase
      .from("items")
      .select("status, archived_at")
      .eq("id", parsed.data.id)
      .maybeSingle();
    if (item && !item.archived_at && item.status !== "completed" && item.status !== "cancelled") {
      await supabase
        .from("item_alerts")
        .update({ active: true })
        .eq("item_id", parsed.data.id)
        .eq("active", false)
        .is("last_fired_at", null);
    }
    await syncItemToGoogleCalendar(supabase, parsed.data.id);
  }

  return NextResponse.json({ ok: true, id: parsed.data.id });
}
