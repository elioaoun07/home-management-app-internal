// Budget resolver — fetches MTD transactions and aggregates
import { safeFetch } from "@/lib/safeFetch";
import { getCachedPreferences } from "@/lib/queryConfig";
import { supabaseBrowser } from "@/lib/supabase/client";
import { getDefaultDateRange } from "@/lib/utils/date";
import {
  formatAnalytics,
  formatAnalyticsError,
  formatBudgetError,
  formatConfirmDraftError,
  formatDebtRecorded,
  formatDraftConfirmed,
  formatDraftsList,
  formatDraftTransaction,
  formatDraftTransactionError,
  formatListDraftsError,
  formatMonthSpend,
  formatRecordDebtError,
  formatTransferCreated,
  formatTransferError,
  monthKeyToLabel,
} from "../formatters/budget";
import type { EraBudgetSubmitResult } from "../../useEraBudgetSubmit";

interface ResolveResult {
  text: string;
  metadata?: Record<string, unknown>;
}

interface PeriodTransaction {
  amount: number;
  user_id: string;
  category?: { name: string } | null;
}

/**
 * Fetch the current custom-billing-month's transactions once. `/api/transactions`
 * already returns both household members' rows (it has no `ownOnly` support —
 * that query param was previously being sent but silently ignored by the
 * route), each tagged with `user_id`, so scope filtering happens here rather
 * than costing a second round trip (HUB-14: the old code assumed a second
 * call was the only way to isolate the partner's spend and used the
 * unfiltered household total for "partner" instead — the total was right for
 * "household" and wrong, but confidently worded, for "partner").
 */
async function fetchCurrentPeriodTransactions(): Promise<{
  start: string;
  end: string;
  transactions: PeriodTransaction[];
  currentUserId: string | null;
} | null> {
  try {
    const prefs = getCachedPreferences();
    const monthStartDay = Number(prefs?.date_start?.split("-")[1] ?? "1") || 1;
    const { start, end } = getDefaultDateRange(monthStartDay);

    const [res, userResult] = await Promise.all([
      safeFetch(`/api/transactions?start=${start}&end=${end}`, {
        timeoutMs: 10_000,
      }),
      supabaseBrowser().auth.getUser(),
    ]);
    if (!res.ok) return null;

    const transactions: unknown = await res.json();
    if (!Array.isArray(transactions)) return null;
    return {
      start,
      end,
      transactions: transactions as PeriodTransaction[],
      currentUserId: userResult.data.user?.id ?? null,
    };
  } catch {
    // Never let a broken auth/fetch call here take down the caller's whole
    // reply — resolveShowAnalytics has a calendar-month fallback, and
    // resolveMonthSpend turns a null into its own honest error reply.
    return null;
  }
}

function scopeTransactions(
  transactions: PeriodTransaction[],
  scope: "self" | "partner" | "household",
  currentUserId: string | null,
): PeriodTransaction[] {
  if (scope === "household" || !currentUserId) return transactions;
  return transactions.filter((t) =>
    scope === "self" ? t.user_id === currentUserId : t.user_id !== currentUserId,
  );
}

export async function resolveMonthSpend(
  scope: "self" | "partner" | "household",
  categoryHint?: string,
): Promise<ResolveResult> {
  try {
    const period = await fetchCurrentPeriodTransactions();
    if (!period) return { text: formatBudgetError() };
    const { start, end, currentUserId } = period;

    // "self"/"partner" require knowing who "self" is — without it we cannot
    // honestly split the household total, and showing it under either label
    // would be exactly the HUB-14 failure this resolver exists to avoid.
    if (scope !== "household" && !currentUserId) {
      return { text: formatBudgetError() };
    }

    const transactions = scopeTransactions(
      period.transactions,
      scope,
      currentUserId,
    );

    const total = transactions.reduce((sum, t) => sum + (t.amount ?? 0), 0);

    // Category aggregation
    const catMap: Record<string, number> = {};
    for (const t of transactions) {
      const name = t.category?.name ?? "Uncategorized";
      catMap[name] = (catMap[name] ?? 0) + t.amount;
    }

    let filteredTotal = total;
    let topCategory: string | null = null;
    let topAmount: number | null = null;

    if (categoryHint) {
      const key = Object.keys(catMap).find((k) =>
        k.toLowerCase().includes(categoryHint.toLowerCase()),
      );
      if (key) {
        filteredTotal = catMap[key];
        topCategory = key;
        topAmount = catMap[key];
      }
    } else {
      // Top category by amount
      const sorted = Object.entries(catMap).sort(([, a], [, b]) => b - a);
      if (sorted.length > 0) {
        [topCategory, topAmount] = [sorted[0][0], sorted[0][1]];
      }
    }

    return {
      text: formatMonthSpend({
        total: filteredTotal,
        scope,
        topCategory: categoryHint ? topCategory : topCategory,
        topAmount,
        currency: "USD",
      }),
      metadata: { total: filteredTotal, scope, start, end },
    };
  } catch {
    return { text: formatBudgetError() };
  }
}

// ---------------------------------------------------------------------------
// showAnalytics
// ---------------------------------------------------------------------------

interface AnalyticsMonth {
  month: string;
  income: number;
  expense: number;
  savingsRate: number;
  transactionCount: number;
  categoryBreakdown: Array<{ name: string; amount: number }>;
}

/**
 * Spoken summary of the analytics page: this month's in/out, savings rate,
 * top three categories, and the month-over-month delta.
 *
 * Pulls two months from `/api/analytics` so the comparison line has
 * something to compare against — that route buckets by calendar month
 * (`tx.date.slice(0,7)`), which is deliberately left alone here since the
 * Analytics dashboard's month tiles depend on it and changing it is a
 * separate, larger piece of work. What DOES change (HUB-13): the headline
 * `expense`/`transactionCount`/top-category figures are re-sourced from the
 * same custom-billing-month window `resolveMonthSpend` uses, via the same
 * `/api/transactions` fetch — so "how much did I spend this month" and
 * "show my analytics" can no longer disagree about the current period's
 * total on a household whose billing month doesn't start on the 1st.
 * `income`/`savingsRate` and the previous-period comparison stay
 * calendar-month-based (from `/api/analytics`) — narrower fix, not a
 * re-architecture of the analytics resolver.
 */
export async function resolveShowAnalytics(): Promise<ResolveResult> {
  try {
    const [analyticsRes, period] = await Promise.all([
      safeFetch("/api/analytics?months=2&ownership=all", { timeoutMs: 10_000 }),
      fetchCurrentPeriodTransactions(),
    ]);
    if (!analyticsRes.ok) return { text: formatAnalyticsError() };

    const data: { months?: AnalyticsMonth[] } = await analyticsRes.json();
    const months = data.months ?? [];
    if (months.length === 0) {
      return {
        text: formatAnalytics({
          monthLabel: monthKeyToLabel(new Date().toISOString().slice(0, 7)),
          income: 0,
          expense: 0,
          savingsRate: 0,
          transactionCount: 0,
          topCategories: [],
          previousExpense: null,
        }),
        metadata: { months: 0 },
      };
    }

    const current = months[months.length - 1];
    const previous = months.length > 1 ? months[months.length - 2] : null;

    // Custom-billing-month figures (HUB-13) — fall back to the calendar-month
    // figure if the transactions fetch failed, rather than losing the reply.
    let expense = current.expense;
    let transactionCount = current.transactionCount;
    let topCategories = (current.categoryBreakdown ?? [])
      .slice(0, 3)
      .map((c) => ({ name: c.name, amount: c.amount }));

    if (period) {
      const catMap: Record<string, number> = {};
      for (const t of period.transactions) {
        const name = t.category?.name ?? "Uncategorized";
        catMap[name] = (catMap[name] ?? 0) + t.amount;
      }
      expense = period.transactions.reduce((sum, t) => sum + (t.amount ?? 0), 0);
      transactionCount = period.transactions.length;
      topCategories = Object.entries(catMap)
        .sort(([, a], [, b]) => b - a)
        .slice(0, 3)
        .map(([name, amount]) => ({ name, amount }));
    }

    return {
      text: formatAnalytics({
        monthLabel: monthKeyToLabel(current.month),
        income: current.income,
        expense,
        savingsRate: current.savingsRate,
        transactionCount,
        topCategories,
        previousExpense: previous?.expense ?? null,
      }),
      metadata: {
        month: current.month,
        income: current.income,
        expense,
        savingsRate: current.savingsRate,
        transactionCount,
        topCategories,
      },
    };
  } catch {
    return { text: formatAnalyticsError() };
  }
}

// ---------------------------------------------------------------------------
// draftTransaction
// ---------------------------------------------------------------------------

/**
 * Turn "I paid $25 on fuel" into a real draft transaction.
 *
 * The write itself still lives in `useEraBudgetSubmit` — it needs the user's
 * accounts, categories and the React Query client to invalidate, plus it owns
 * the Undo toast required by Hard Rule #1. This resolver takes that hook's
 * `submit` as an injected capability so the *decision and the reply* live on
 * the resolver path like every other intent, instead of being special-cased in
 * CommandBar. When no submitter is available (no accounts loaded yet, or a
 * caller outside the hub) we fail with the same wording as a no-account result
 * rather than silently doing nothing.
 */
export async function resolveDraftTransaction(
  rawText: string,
  submitDraft?: (sentence: string) => Promise<EraBudgetSubmitResult>,
): Promise<ResolveResult> {
  if (!submitDraft) {
    return { text: formatDraftTransactionError("no-account") };
  }

  const result = await submitDraft(rawText);

  if (!result.ok) {
    return {
      text: formatDraftTransactionError(result.reason, result.message),
      metadata: { draftFailed: result.reason },
    };
  }

  return {
    text: formatDraftTransaction({
      amount: result.parsed.amount ?? 0,
      categoryName: result.parsed.categoryName,
      subcategoryName: result.parsed.subcategoryName,
    }),
    metadata: {
      draftId: result.draftId,
      accountId: result.accountId,
      amount: result.parsed.amount ?? 0,
      categoryName: result.parsed.categoryName ?? null,
    },
  };
}

// ---------------------------------------------------------------------------
// transfer
// ---------------------------------------------------------------------------

interface AccountLite {
  id: string;
  name: string;
  type?: string;
}

/**
 * Fuzzy-match a spoken account name against the user's real accounts.
 * Substring containment either direction — same tolerance level as
 * `categoryHint` matching in resolveMonthSpend. Returns null on no match or
 * more than one equally-good match (never guesses between two accounts when
 * money is moving).
 */
function fuzzyMatchAccount(accounts: AccountLite[], hint: string): AccountLite | null {
  const h = hint.trim().toLowerCase();
  if (!h) return null;

  const exact = accounts.find((a) => a.name.toLowerCase() === h);
  if (exact) return exact;

  const contains = accounts.filter(
    (a) => a.name.toLowerCase().includes(h) || h.includes(a.name.toLowerCase()),
  );
  return contains.length === 1 ? contains[0] : null;
}

/**
 * "Transfer $50 from wallet to savings" -> a real transfer between the
 * user's own accounts. Household transfers (to a partner) need recipient
 * resolution and fee/returned-amount handling the router doesn't attempt to
 * parse from one utterance -- this resolver only ever creates `transfer_type:
 * "self"`. Undo is intentionally NOT offered here (no toast fired) -- same
 * precedent as resolveDraftReminder: a real, immediate write confirmed by
 * the spoken reply, undoable from the Transfers page's own delete action.
 */
export async function resolveTransfer(
  amount: number | undefined,
  fromHint: string | undefined,
  toHint: string | undefined,
): Promise<ResolveResult> {
  if (!amount || amount <= 0) {
    return { text: formatTransferError("no-amount") };
  }
  if (!fromHint || !toHint) {
    return { text: formatTransferError("no-accounts") };
  }

  try {
    const accountsRes = await safeFetch("/api/accounts?own=true", {
      timeoutMs: 8_000,
    });
    if (!accountsRes.ok) return { text: formatTransferError("request-failed") };
    const accounts: AccountLite[] = await accountsRes.json();

    const fromAccount = fuzzyMatchAccount(accounts, fromHint);
    if (!fromAccount) return { text: formatTransferError("account-not-found", fromHint) };
    const toAccount = fuzzyMatchAccount(accounts, toHint);
    if (!toAccount) return { text: formatTransferError("account-not-found", toHint) };
    if (fromAccount.id === toAccount.id) {
      return { text: formatTransferError("same-account") };
    }

    const res = await safeFetch("/api/transfers", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        from_account_id: fromAccount.id,
        to_account_id: toAccount.id,
        amount,
      }),
      timeoutMs: 8_000,
    });

    if (!res.ok) {
      const err = await res.json().catch(() => ({ error: undefined }));
      return { text: formatTransferError("request-failed", err.error) };
    }

    const transfer = await res.json();

    return {
      text: formatTransferCreated({
        amount,
        fromName: fromAccount.name,
        toName: toAccount.name,
      }),
      metadata: {
        transferId: transfer.id,
        amount,
        fromAccountId: fromAccount.id,
        toAccountId: toAccount.id,
      },
    };
  } catch {
    return { text: formatTransferError("request-failed") };
  }
}

// ---------------------------------------------------------------------------
// recordDebt
// ---------------------------------------------------------------------------

/**
 * "John owes me $30 for lunch" -> a standalone debt (no linked transaction,
 * no balance effect -- a pure receivable, via `/api/debts/standalone`). The
 * richer flow (an expense you paid that a friend partially owes back) needs
 * an account and category the router can't reliably parse from one
 * utterance -- that stays a manual /expense + Debts task.
 */
export async function resolveRecordDebt(
  debtorName: string | undefined,
  amount: number | undefined,
  notes: string | undefined,
): Promise<ResolveResult> {
  if (!debtorName || !amount || amount <= 0) {
    return { text: formatRecordDebtError("missing-fields") };
  }

  try {
    const res = await safeFetch("/api/debts/standalone", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ debtor_name: debtorName, amount, notes: notes || null }),
      timeoutMs: 8_000,
    });

    if (!res.ok) {
      const err = await res.json().catch(() => ({ error: undefined }));
      return { text: formatRecordDebtError("request-failed", err.error) };
    }

    const { debt } = (await res.json()) as { debt: { id: string } };

    return {
      text: formatDebtRecorded({ debtorName, amount }),
      metadata: { debtId: debt.id, debtorName, amount },
    };
  } catch {
    return { text: formatRecordDebtError("request-failed") };
  }
}

// ---------------------------------------------------------------------------
// listDrafts
// ---------------------------------------------------------------------------

interface DraftRow {
  id: string;
  amount: number;
  description?: string | null;
  category?: { name: string } | null;
}

async function fetchDrafts(): Promise<DraftRow[] | null> {
  const res = await safeFetch("/api/drafts", { timeoutMs: 8_000 });
  if (!res.ok) return null;
  const { drafts } = (await res.json()) as { drafts: DraftRow[] };
  return drafts;
}

export async function resolveListDrafts(): Promise<ResolveResult> {
  try {
    const drafts = await fetchDrafts();
    if (!drafts) return { text: formatListDraftsError() };

    return {
      text: formatDraftsList(
        drafts.map((d) => ({ amount: d.amount, description: d.description ?? d.category?.name })),
      ),
      metadata: { count: drafts.length, draftIds: drafts.map((d) => d.id) },
    };
  } catch {
    return { text: formatListDraftsError() };
  }
}

// ---------------------------------------------------------------------------
// confirmDraft
// ---------------------------------------------------------------------------

/**
 * "Confirm my last draft" / "confirm the fuel draft" -> converts a pending
 * draft to a real transaction via the same PATCH the Drafts drawer uses.
 * That endpoint overwrites the row rather than partial-patching, so this
 * resolver echoes the draft's own fields back -- it changes nothing about
 * the draft except `is_draft`. No hint -> most recent (GET /api/drafts
 * already orders by inserted_at desc). A hint that matches more than one
 * draft asks the user to use Drafts directly rather than guessing which one.
 */
export async function resolveConfirmDraft(hint: string | undefined): Promise<ResolveResult> {
  try {
    const drafts = await fetchDrafts();
    if (!drafts) return { text: formatConfirmDraftError("request-failed") };
    if (drafts.length === 0) return { text: formatConfirmDraftError("none-pending") };

    let target: DraftRow | undefined;
    if (!hint) {
      target = drafts[0]; // most recent
    } else {
      const h = hint.toLowerCase();
      const matches = drafts.filter(
        (d) =>
          d.description?.toLowerCase().includes(h) ||
          d.category?.name?.toLowerCase().includes(h),
      );
      if (matches.length === 0) return { text: formatConfirmDraftError("not-found", hint) };
      if (matches.length > 1) return { text: formatConfirmDraftError("ambiguous", hint) };
      target = matches[0];
    }

    // The PATCH endpoint overwrites the row, so re-fetch full field values
    // (amount/category/account/date) rather than trust the summarized list shape.
    const fullRes = await safeFetch(`/api/drafts`, { timeoutMs: 8_000 });
    const fullDrafts = fullRes.ok
      ? ((await fullRes.json()).drafts as Array<{
          id: string;
          amount: number;
          category_id: string | null;
          subcategory_id: string | null;
          description: string | null;
          date: string;
          account_id: string;
          category?: { name: string } | null;
        }>)
      : [];
    const full = fullDrafts.find((d) => d.id === target!.id);
    if (!full) return { text: formatConfirmDraftError("request-failed") };

    const res = await safeFetch(`/api/drafts/${full.id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        amount: full.amount,
        category_id: full.category_id,
        subcategory_id: full.subcategory_id,
        description: full.description,
        date: full.date,
        account_id: full.account_id,
      }),
      timeoutMs: 8_000,
    });

    if (!res.ok) {
      return { text: formatConfirmDraftError("request-failed") };
    }

    const { transaction } = (await res.json()) as {
      transaction: { id: string; amount: number };
    };

    return {
      text: formatDraftConfirmed({ amount: full.amount, categoryName: full.category?.name }),
      metadata: { transactionId: transaction.id, amount: full.amount },
    };
  } catch {
    return { text: formatConfirmDraftError("request-failed") };
  }
}
