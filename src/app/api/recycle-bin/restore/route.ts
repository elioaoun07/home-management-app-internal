// src/app/api/recycle-bin/restore/route.ts
import { adjustAccountBalance } from "@/lib/balance";
import { getBalanceDelta, type AccountType } from "@/lib/balance-utils";
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

  const { error: updateErr } = await supabase
    .from(binModule.table)
    .update({ [binModule.deletedAtColumn]: null })
    .eq("id", parsed.data.id);
  if (updateErr) {
    return NextResponse.json({ error: updateErr.message }, { status: 500 });
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
    await syncItemToGoogleCalendar(supabase, parsed.data.id);
  }

  return NextResponse.json({ ok: true, id: parsed.data.id });
}
