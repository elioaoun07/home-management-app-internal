// Budget resolver — fetches MTD transactions and aggregates
import { OfflineError, RequestTimeoutError, safeFetch } from "@/lib/safeFetch";
import { getCachedPreferences } from "@/lib/queryConfig";
import { supabaseBrowser } from "@/lib/supabase/client";
import { formatDate, getDefaultDateRange } from "@/lib/utils/date";
import {
  formatAnalytics,
  formatAnalyticsError,
  formatBudgetError,
  formatConfirmDraftError,
  formatDebtProposal,
  formatDebtRecorded,
  formatDraftConfirmed,
  formatDraftsList,
  formatDraftTransaction,
  formatDraftTransactionError,
  formatListDraftsError,
  formatMoneyUncertain,
  formatMonthSpend,
  formatRecordDebtError,
  formatTransferCreated,
  formatTransferError,
  formatTransferProposal,
  moneyIn,
  monthKeyToLabel,
} from "../formatters/budget";
import type { EraActiveProposal, EraNativeAction, EraPendingTurn } from "../../types";
import { transferSlot } from "./slotBuilders";
import { findDefault, resolveAlias } from "../../lexicon";
import { forgetLexiconRule, saveLexiconRule } from "../../useEraLexicon";
import { useEraStore } from "../../useEraStore";
import type { EraBudgetSubmitResult } from "../../useEraBudgetSubmit";
import { extractAmount } from "@/lib/nlp/amount";
import { eraArtifact, type EraArtifact } from "@/lib/era/artifacts";
import { HANDOFF_TTL_MS, type EraHandoff } from "../../engine";

interface ResolveResult {
  text: string;
  metadata?: Record<string, unknown>;
  /** HUB-34 — false on every graceful-error return; see resolveIntent.ts's ResolveResult doc. Only set on resolvers reachable through the capability registry (spend.month, draft.list, draft.confirm). */
  ok?: boolean;
  /** What this write left behind (src/lib/era/artifacts.ts). */
  artifacts?: EraArtifact[];
}

interface PeriodTransaction {
  amount: number;
  date?: string;
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
  window?: "today" | "yesterday" | "week",
): Promise<ResolveResult> {
  try {
    const period = await fetchCurrentPeriodTransactions();
    if (!period) return { text: formatBudgetError(), ok: false };
    const { start, end, currentUserId } = period;
    // HUB-79 — a shorter window filters the same billing-month fetch by date.
    if (window) {
      const today = new Date();
      const iso = (d: Date) => formatDate(d);
      const from = new Date(today);
      if (window === "yesterday") from.setDate(today.getDate() - 1);
      if (window === "week") from.setDate(today.getDate() - ((today.getDay() + 6) % 7));
      const to = window === "yesterday" ? iso(from) : iso(today);
      const inWindow = scopeTransactions(period.transactions, scope, currentUserId).filter(
        (t) => typeof t.date === "string" && t.date >= iso(from) && t.date <= to,
      );
      const total = inWindow.reduce((sum, t) => sum + (t.amount ?? 0), 0);
      const label = window === "week" ? "this week" : window;
      return {
        text: `${label.charAt(0).toUpperCase()}${label.slice(1)} · ${moneyIn(total)}`,
        metadata: { total, scope, window, count: inWindow.length },
      };
    }

    // "self"/"partner" require knowing who "self" is — without it we cannot
    // honestly split the household total, and showing it under either label
    // would be exactly the HUB-14 failure this resolver exists to avoid.
    if (scope !== "household" && !currentUserId) {
      return { text: formatBudgetError(), ok: false };
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
    return { text: formatBudgetError(), ok: false };
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
): Promise<ResolveResult & { handoff?: EraHandoff }> {
  if (!submitDraft) {
    return { text: formatDraftTransactionError("no-account") };
  }

  const result = await submitDraft(rawText);
  const expiresAt = new Date(Date.now() + HANDOFF_TTL_MS).toISOString();

  if (!result.ok) {
    // HUB-78 — a spend ERA can't finish (currency unclear, no account in that
    // currency, no amount) hands off to /expense prefilled instead of dying.
    const found = extractAmount(rawText);
    const handoff: EraHandoff | undefined =
      result.reason === "request-failed" || result.reason === "offline" || result.reason === "uncertain"
        ? undefined
        : {
            kind: "spend",
            amount: found?.value,
            currency: found?.currency ?? undefined,
            description: rawText,
            expiresAt,
          };
    return {
      text: formatDraftTransactionError(result.reason, result.message),
      metadata: {
        draftFailed: result.reason,
        ...(result.reason === "uncertain" ? { uncertain: true } : {}),
        ...(result.reason === "offline" ? { retryable: true } : {}),
      },
      ok: false,
      handoff,
    };
  }

  const amount = result.parsed.amount ?? 0;
  return {
    text: formatDraftTransaction({
      amount,
      categoryName: result.parsed.categoryName,
      subcategoryName: result.parsed.subcategoryName,
    }),
    metadata: {
      draftId: result.draftId,
      accountId: result.accountId,
      amount,
      currency: result.currency,
      categoryName: result.parsed.categoryName ?? null,
    },
    artifacts: [
      eraArtifact(
        "draft",
        "created",
        result.draftId,
        `${result.parsed.categoryName ?? "Expense"} · ${moneyIn(amount, result.currency)}`,
      ),
    ],
    // "Change" on the receipt opens this; the form deletes the draft on save.
    handoff: {
      kind: "spend",
      amount,
      currency: result.currency,
      accountId: result.accountId,
      categoryId: result.parsed.categoryId,
      subcategoryId: result.parsed.subcategoryId,
      description: rawText,
      date: result.parsed.date,
      draftId: result.draftId,
      expiresAt,
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
  currency?: string;
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

  // HUB-80 — a personal alias ("the box" → Drawer) wins, re-bound to the
  // accounts the speaker can use right now.
  const aliasId = resolveAlias(useEraStore.getState().lexicon, "transfer.create", h.replace(/^(?:the|my)\s+/, ""), new Set(accounts.map((a) => a.id)));
  const aliased = aliasId ? accounts.find((a) => a.id === aliasId) : undefined;
  if (aliased) return aliased;

  const exact = accounts.find((a) => a.name.toLowerCase() === h);
  if (exact) return exact;

  const contains = accounts.filter(
    (a) => a.name.toLowerCase().includes(h) || h.includes(a.name.toLowerCase()),
  );
  return contains.length === 1 ? contains[0] : null;
}

/**
 * HUB-76 — outcome of a money POST. A timeout or network drop AFTER the
 * request left the device is `uncertain`: the server may have committed it,
 * so ERA says so and never retries on its own (a retry could move the money
 * twice). Only a pre-flight offline refusal is a definite `failed` — nothing
 * was sent.
 */
export type MoneyPostOutcome<T> =
  | { status: "done"; data: T }
  | { status: "failed"; error?: string }
  | { status: "uncertain" };

async function postMoney<T>(url: string, body: unknown): Promise<MoneyPostOutcome<T>> {
  try {
    const res = await safeFetch(url, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(body),
      timeoutMs: 8_000,
    });
    if (!res.ok) {
      const err = await res.json().catch(() => ({ error: undefined }));
      return { status: "failed", error: err.error };
    }
    return { status: "done", data: (await res.json()) as T };
  } catch (err) {
    if (err instanceof RequestTimeoutError) return { status: "uncertain" };
    if (err instanceof OfflineError && /pre-flight/i.test(err.message)) {
      return { status: "failed" };
    }
    // A drop mid-request is indistinguishable from a lost response.
    return { status: "uncertain" };
  }
}

export type WithProposalResult = ResolveResult & {
  proposal?: EraActiveProposal;
  pending?: EraPendingTurn | null;
};
type WithProposal = WithProposalResult;

/**
 * "Transfer $50 from wallet to savings" → a CONFIRM CARD, never a write
 * (HUB-76; Plan §5: money movement always confirms). Resolves both accounts
 * and validates everything the card shows; the POST happens only in
 * `executeTransfer`, after the tap. Only `transfer_type: "self"` between the
 * user's own accounts — household transfers need recipient/fee handling.
 * Cross-currency is refused: the route needs a `to_amount` ERA cannot know,
 * and posting the same number on both sides would be a wrong money effect.
 */
export async function prepareTransfer(
  amount: number | undefined,
  currency: string | undefined,
  fromHint: string | undefined,
  toHint: string | undefined,
  rawText = "",
): Promise<WithProposal> {
  if (!amount || amount <= 0) {
    return { text: formatTransferError("no-amount"), ok: false };
  }
  if (!fromHint && !toHint) {
    return { text: formatTransferError("no-accounts"), ok: false };
  }

  try {
    const accountsRes = await safeFetch("/api/accounts?own=true", {
      timeoutMs: 8_000,
    });
    if (!accountsRes.ok) return { text: formatTransferError("request-failed"), ok: false };
    const accounts: AccountLite[] = await accountsRes.json();

    // HUB-78 — one side named ("I took 300$ from Drawer"): ask for the other
    // as chips, limited to own accounts in the same currency.
    if (!fromHint || !toHint) {
      const known = fuzzyMatchAccount(accounts, (fromHint ?? toHint)!);
      if (!known) {
        return { text: formatTransferError("account-not-found", fromHint ?? toHint), ok: false };
      }
      const knownCurrency = known.currency ?? "USD";
      if (currency && currency !== knownCurrency) {
        return { text: formatTransferError("currency-mismatch"), ok: false };
      }
      const candidates = accounts
        .filter((a) => a.id !== known.id && (a.currency ?? "USD") === knownCurrency)
        .map((a) => ({ name: a.name }));

      // HUB-80 — an "Always" default fills the missing side (re-bound to the
      // current accounts; a deleted/unshared account makes it inert). The
      // result is still a Confirm card: a default never lowers the tier.
      const store = useEraStore.getState();
      const missingSlot = fromHint ? "to" : "from";
      const def = findDefault(
        store.lexicon,
        "transfer.create",
        missingSlot,
        { [fromHint ? "from" : "to"]: known.id },
        new Set(accounts.map((a) => a.id)),
      );
      const defAccount = def ? accounts.find((a) => a.id === def.value.accountId) : undefined;
      if (def && defAccount && (defAccount.currency ?? "USD") === knownCurrency && defAccount.id !== known.id) {
        store.setLastAppliedRuleId(def.id);
        const [fromAcc, toAcc] = fromHint ? [known, defAccount] : [defAccount, known];
        const text = formatTransferProposal({ amount, currency: knownCurrency, fromName: fromAcc.name, toName: toAcc.name });
        return {
          text,
          metadata: { proposed: "transfer", amount, appliedRuleId: def.id },
          proposal: {
            kind: "native_action",
            text,
            sourceText: rawText,
            action: {
              type: "transfer",
              amount,
              currency: knownCurrency,
              fromAccountId: fromAcc.id,
              toAccountId: toAcc.id,
              fromName: fromAcc.name,
              toName: toAcc.name,
            },
          },
        };
      }
      const money = formatTransferProposal({ amount, currency: knownCurrency, fromName: "", toName: "" })
        .split(" · ")
        .pop();
      return transferSlot({
        amount,
        currency: knownCurrency,
        fromName: fromHint ? known.name : undefined,
        toName: toHint ? known.name : undefined,
        candidates,
        rawText,
        question: fromHint ? `${known.name} → ? · ${money}` : `? → ${known.name} · ${money}`,
      });
    }

    const fromAccount = fuzzyMatchAccount(accounts, fromHint);
    if (!fromAccount) return { text: formatTransferError("account-not-found", fromHint), ok: false };
    const toAccount = fuzzyMatchAccount(accounts, toHint);
    if (!toAccount) return { text: formatTransferError("account-not-found", toHint), ok: false };
    if (fromAccount.id === toAccount.id) {
      return { text: formatTransferError("same-account"), ok: false };
    }

    const fromCurrency = fromAccount.currency ?? "USD";
    const toCurrency = toAccount.currency ?? "USD";
    if (fromCurrency !== toCurrency || (currency && currency !== fromCurrency)) {
      return { text: formatTransferError("currency-mismatch"), ok: false };
    }

    const text = formatTransferProposal({
      amount,
      currency: fromCurrency,
      fromName: fromAccount.name,
      toName: toAccount.name,
    });
    return {
      text,
      metadata: {
        proposed: "transfer",
        amount,
        fromAccountId: fromAccount.id,
        toAccountId: toAccount.id,
      },
      proposal: {
        kind: "native_action",
        text,
        sourceText: rawText,
        action: {
          type: "transfer",
          amount,
          currency: fromCurrency,
          fromAccountId: fromAccount.id,
          toAccountId: toAccount.id,
          fromName: fromAccount.name,
          toName: toAccount.name,
        },
      },
    };
  } catch {
    return { text: formatTransferError("request-failed"), ok: false };
  }
}

export interface NativeExecuteResult extends ResolveResult {
  outcome: "done" | "failed" | "uncertain";
}

/** Runs ONLY from the confirm card. The route re-validates ownership. */
export async function executeTransfer(
  action: Extract<EraNativeAction, { type: "transfer" }>,
): Promise<NativeExecuteResult> {
  const outcome = await postMoney<{ id: string }>("/api/transfers", {
    from_account_id: action.fromAccountId,
    to_account_id: action.toAccountId,
    amount: action.amount,
  });
  if (outcome.status === "uncertain") {
    return { text: formatMoneyUncertain("transfer"), ok: false, outcome: "uncertain" };
  }
  if (outcome.status === "failed") {
    return {
      text: formatTransferError("request-failed", outcome.error),
      ok: false,
      outcome: "failed",
    };
  }
  return {
    text: formatTransferCreated({
      amount: action.amount,
      currency: action.currency,
      fromName: action.fromName,
      toName: action.toName,
    }),
    metadata: {
      transferId: outcome.data.id,
      amount: action.amount,
      fromAccountId: action.fromAccountId,
      toAccountId: action.toAccountId,
      fromName: action.fromName,
      toName: action.toName,
    },
    artifacts: [
      eraArtifact(
        "transfer",
        "created",
        outcome.data.id,
        `${moneyIn(action.amount, action.currency)} · ${action.fromName} → ${action.toName}`,
      ),
    ],
    outcome: "done",
  };
}

// ---------------------------------------------------------------------------
// defineAlias (HUB-80)
// ---------------------------------------------------------------------------

/** "the box means Drawer" → a personal alias. Act + Undo (the inverse is Forget). */
export async function resolveDefineAlias(phrase: string, target: string): Promise<ResolveResult> {
  try {
    const res = await safeFetch("/api/accounts?own=true", { timeoutMs: 8_000 });
    if (!res.ok) return { text: "Couldn't read your accounts.", ok: false };
    const accounts: AccountLite[] = await res.json();
    const t = target.trim().toLowerCase();
    const exact = accounts.filter((a) => a.name.toLowerCase() === t);
    const matches = exact.length ? exact : accounts.filter((a) => a.name.toLowerCase().includes(t));
    if (matches.length !== 1) {
      return { text: matches.length ? `Which one — ${matches.map((m) => m.name).join(", ")}?` : `No account called "${target}".`, ok: false };
    }
    const account = matches[0];
    const key = phrase.trim().toLowerCase().replace(/^(?:the|my)\s+/, "");
    const rule = await saveLexiconRule({
      kind: "alias",
      capability: "transfer.create",
      phrase: key,
      slot: null,
      conditions: {},
      value: { id: account.id, name: account.name },
      depends_on: [account.id],
    });
    if (!rule) return { text: "Couldn't save that yet.", ok: false };
    useEraStore.getState().setLastAppliedRuleId(rule.id);
    return { text: `${phrase} = ${account.name}`, metadata: { ruleId: rule.id, accountId: account.id } };
  } catch {
    return { text: "Couldn't save that yet.", ok: false };
  }
}

export { forgetLexiconRule };

// ---------------------------------------------------------------------------
// recordDebt
// ---------------------------------------------------------------------------

/**
 * "John owes me $30 for lunch" → a CONFIRM CARD (HUB-76). On tap,
 * `executeRecordDebt` creates a standalone debt (no linked transaction, no
 * balance effect — a pure receivable, via `/api/debts/standalone`). Debts
 * carry no currency column (USD), so a non-USD amount is refused rather than
 * stored as dollars. The richer flow (an expense a friend partially owes
 * back) stays a manual /expense + Debts task.
 */
export function prepareRecordDebt(
  debtorName: string | undefined,
  amount: number | undefined,
  notes: string | undefined,
  currency?: string,
  rawText = "",
): WithProposal {
  if (!debtorName || !amount || amount <= 0) {
    return { text: formatRecordDebtError("missing-fields"), ok: false };
  }
  if (currency && currency !== "USD") {
    return { text: formatRecordDebtError("usd-only"), ok: false };
  }
  const text = formatDebtProposal({ debtorName, amount });
  return {
    text,
    metadata: { proposed: "recordDebt", debtorName, amount },
    proposal: {
      kind: "native_action",
      text,
      sourceText: rawText,
      action: { type: "recordDebt", debtorName, amount, notes: notes ?? null },
    },
  };
}

/** Runs ONLY from the confirm card. */
export async function executeRecordDebt(
  action: Extract<EraNativeAction, { type: "recordDebt" }>,
): Promise<NativeExecuteResult> {
  const outcome = await postMoney<{ debt: { id: string } }>("/api/debts/standalone", {
    debtor_name: action.debtorName,
    amount: action.amount,
    notes: action.notes || null,
  });
  if (outcome.status === "uncertain") {
    return { text: formatMoneyUncertain("debt"), ok: false, outcome: "uncertain" };
  }
  if (outcome.status === "failed") {
    return {
      text: formatRecordDebtError("request-failed", outcome.error),
      ok: false,
      outcome: "failed",
    };
  }
  return {
    text: formatDebtRecorded({ debtorName: action.debtorName, amount: action.amount }),
    metadata: {
      debtId: outcome.data.debt.id,
      debtorName: action.debtorName,
      amount: action.amount,
    },
    artifacts: [eraArtifact("debt", "created", outcome.data.debt.id, `${action.debtorName} · ${moneyIn(action.amount)}`)],
    outcome: "done",
  };
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
    if (!drafts) return { text: formatListDraftsError(), ok: false };

    return {
      text: formatDraftsList(
        drafts.map((d) => ({ amount: d.amount, description: d.description ?? d.category?.name })),
      ),
      metadata: { count: drafts.length, draftIds: drafts.map((d) => d.id) },
    };
  } catch {
    return { text: formatListDraftsError(), ok: false };
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
    if (!drafts) return { text: formatConfirmDraftError("request-failed"), ok: false };
    if (drafts.length === 0) return { text: formatConfirmDraftError("none-pending"), ok: false };

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
      if (matches.length === 0) return { text: formatConfirmDraftError("not-found", hint), ok: false };
      if (matches.length > 1) return { text: formatConfirmDraftError("ambiguous", hint), ok: false };
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
    if (!full) return { text: formatConfirmDraftError("request-failed"), ok: false };

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
      return { text: formatConfirmDraftError("request-failed"), ok: false };
    }

    const { transaction } = (await res.json()) as {
      transaction: { id: string; amount: number };
    };

    return {
      text: formatDraftConfirmed({ amount: full.amount, categoryName: full.category?.name }),
      metadata: { transactionId: transaction.id, amount: full.amount },
      artifacts: [
        eraArtifact("transaction", "updated", transaction.id, `${full.category?.name ?? "Expense"} · ${moneyIn(full.amount)}`),
      ],
    };
  } catch {
    return { text: formatConfirmDraftError("request-failed"), ok: false };
  }
}
