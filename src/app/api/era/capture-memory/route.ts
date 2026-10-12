// src/app/api/era/capture-memory/route.ts
// HUB-113 — ERA's typing memory (src/lib/era/captureMemory.ts).
// GET → the caller's own spends and reminder/event titles from the last year,
// plus the household's shopping-list rows, folded into recall entries the
// composer uses to complete sentences and pre-fill choices.
//
// Read-only. Spends and titles are own-only by design, like an entry form's
// `?own=true`: a suggested account or category must be one the caller can
// post to. Shopping lists are shared, so every visible household list counts.

import {
  aggregateExpenses,
  aggregateShopping,
  aggregateTitles,
} from "@/lib/era/captureMemory";
import { supabaseServer } from "@/lib/supabase/server";
import { cookies } from "next/headers";
import { NextResponse } from "next/server";

export const dynamic = "force-dynamic";

type Supabase = Awaited<ReturnType<typeof supabaseServer>>;
type Named = { name?: string | null } | Array<{ name?: string | null }> | null;

const YEAR_MS = 365 * 86_400_000;

const nameOf = (joined: Named | undefined) =>
  (Array.isArray(joined) ? joined[0]?.name : joined?.name) ?? null;

async function shoppingRows(supabase: Supabase, userId: string, since: string) {
  const { data: household, error: householdError } = await supabase
    .from("household_links")
    .select("id")
    .or(`owner_user_id.eq.${userId},partner_user_id.eq.${userId}`)
    .eq("active", true)
    .maybeSingle();
  if (householdError || !household) return { data: [], error: householdError };

  const { data: threads, error: threadError } = await supabase
    .from("hub_chat_threads")
    .select("id")
    .eq("household_id", household.id)
    .eq("purpose", "shopping")
    .is("deleted_at", null)
    .or(`is_private.eq.false,and(is_private.eq.true,created_by.eq.${userId})`);
  const ids = (threads ?? []).map((t: { id: string }) => t.id);
  if (threadError || ids.length === 0) return { data: [], error: threadError };

  return supabase
    .from("hub_messages")
    .select("content, thread_id, shopping_group_id, archived_at, checked_at, created_at")
    .in("thread_id", ids)
    .is("deleted_at", null)
    .is("parent_item_id", null)
    .eq("message_type", "text")
    .gte("created_at", since)
    .order("created_at", { ascending: false })
    .limit(1500);
}

export async function GET() {
  const supabase = await supabaseServer(await cookies());
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const since = new Date(Date.now() - YEAR_MS).toISOString();
  try {
    const [spends, titles, shopping] = await Promise.all([
      supabase
        .from("transactions")
        .select(
          `description, amount, account_id, category_id, subcategory_id, date,
          category:user_categories!transactions_category_fk(name),
          subcategory:user_categories!transactions_subcategory_fk(name)`,
        )
        .eq("user_id", user.id)
        // Pending drafts count once categorised: ERA's own captures are drafts.
        .or("is_draft.eq.false,category_id.not.is.null")
        .eq("is_imported", false)
        .is("deleted_at", null)
        .is("parent_transaction_id", null)
        .gte("date", since.slice(0, 10))
        .order("date", { ascending: false })
        .order("inserted_at", { ascending: false })
        .limit(800),
      supabase
        .from("items")
        .select("title, type, created_at")
        .eq("user_id", user.id)
        .in("type", ["reminder", "event"])
        .is("deleted_at", null)
        .gte("created_at", since)
        .order("created_at", { ascending: false })
        .limit(600),
      shoppingRows(supabase, user.id, since),
    ]);
    const error = spends.error ?? titles.error ?? shopping.error;
    if (error) {
      return NextResponse.json({ error: error.message }, { status: 500 });
    }

    type SpendRow = {
      description: string | null;
      amount: number | string;
      account_id: string;
      category_id: string | null;
      subcategory_id: string | null;
      date: string;
      category?: Named;
      subcategory?: Named;
    };
    return NextResponse.json(
      {
        expenses: aggregateExpenses(
          ((spends.data ?? []) as SpendRow[]).map((row) => ({
            ...row,
            category_name: nameOf(row.category),
            subcategory_name: nameOf(row.subcategory),
          })),
        ),
        titles: aggregateTitles(titles.data ?? []),
        shopping: aggregateShopping(shopping.data ?? []),
      },
      { headers: { "Cache-Control": "private, no-store" } },
    );
  } catch (error) {
    console.error("[era-capture-memory]", error);
    return NextResponse.json(
      { error: "Failed to load capture memory" },
      { status: 500 },
    );
  }
}
