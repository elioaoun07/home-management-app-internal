// src/features/era/intents/resolvers/budgetFamilies.ts
// HUB-79 — core Budget families beyond the pilot, ordered by the owner
// export. Each reuses an existing contract; none adds money math.
//   income.record   → handoff: /expense on the default income account (owner 2026-09-27)
//   split.create    → handoff: /expense with the Split toggle on (owner 2026-09-27; HUB-6)
//   balance.read    → GET /api/accounts/[id]/balance (read only)
//   recurring.cover → link an EXISTING transaction via mark-covered, behind a
//                     confirm card re-checked on tap; no match → prefilled form

import { safeFetch } from "@/lib/safeFetch";
import { getCachedPreferences } from "@/lib/queryConfig";
import { getDefaultDateRange } from "@/lib/utils/date";
import { HANDOFF_TTL_MS, type EraHandoff } from "../../engine";
import type { EraActiveProposal, EraNativeAction, EraPendingTurn } from "../../types";
import { moneyIn } from "../formatters/budget";
import { normalizeTitle } from "./reminderLookup";
import { slot } from "./slotBuilders";

interface Result {
  text: string;
  metadata?: Record<string, unknown>;
  ok?: boolean;
  pending?: EraPendingTurn | null;
  proposal?: EraActiveProposal;
  handoff?: EraHandoff;
}

interface AccountLite {
  id: string;
  name: string;
  type?: string;
  currency?: string;
  is_default?: boolean;
  is_default_income?: boolean;
}

async function ownAccounts(): Promise<AccountLite[] | null> {
  try {
    const res = await safeFetch("/api/accounts?own=true", { timeoutMs: 8_000 });
    return res.ok ? ((await res.json()) as AccountLite[]) : null;
  } catch {
    return null;
  }
}

const expires = () => new Date(Date.now() + HANDOFF_TTL_MS).toISOString();

// ───────────────────────────── income ─────────────────────────────

export async function resolveIncome(amount: number | undefined, currency: string | undefined, rawText: string): Promise<Result> {
  const accounts = await ownAccounts();
  const income =
    accounts?.find((a) => a.is_default_income) ??
    accounts?.find((a) => a.type === "income" && (!currency || (a.currency ?? "USD") === currency));
  return {
    text: amount ? `Income · ${moneyIn(amount, currency)}` : "Income",
    handoff: {
      kind: "income",
      amount,
      currency,
      accountId: income?.id,
      description: rawText,
      expiresAt: expires(),
    },
  };
}

// ───────────────────────────── split ─────────────────────────────

export function resolveSplit(amount: number | undefined, withName: string | undefined, rawText: string): Result {
  return {
    text: `Split · ${amount ? moneyIn(amount) : ""}${withName ? ` · ${withName}` : ""}`.replace(/ · $/, ""),
    handoff: {
      kind: "split",
      amount,
      totalBill: amount,
      description: rawText,
      expiresAt: expires(),
    },
  };
}

// ───────────────────────────── balance ─────────────────────────────

export async function resolveBalance(accountHint: string | undefined): Promise<Result> {
  const accounts = await ownAccounts();
  if (!accounts?.length) return { text: "Couldn't read your balance.", ok: false };
  const h = accountHint ? normalizeTitle(accountHint) : "";
  const matches = h
    ? accounts.filter((a) => {
        const n = normalizeTitle(a.name);
        return n === h || n.includes(h) || h.includes(n);
      })
    : [];
  const target = matches.length === 1 ? matches[0] : accounts.find((a) => a.is_default) ?? accounts[0];
  if (h && matches.length !== 1) {
    return { text: matches.length ? `Which one — ${matches.map((m) => m.name).join(", ")}?` : `No account called "${accountHint}".`, ok: false };
  }
  try {
    const res = await safeFetch(`/api/accounts/${target.id}/balance`, { timeoutMs: 8_000 });
    if (!res.ok) return { text: "Couldn't read your balance.", ok: false };
    const data = (await res.json()) as { balance?: number; current_balance?: number; displayBalance?: number };
    const value = data.displayBalance ?? data.current_balance ?? data.balance;
    if (typeof value !== "number") return { text: "Couldn't read your balance.", ok: false };
    return {
      text: `${target.name} · ${moneyIn(value, target.currency)}`,
      metadata: { accountId: target.id, balance: value },
    };
  } catch {
    return { text: "Couldn't read your balance.", ok: false };
  }
}

// ───────────────────────────── recurring covered ─────────────────────────────

interface RecurringLite {
  id: string;
  user_id: string;
  name: string;
  amount: number;
  account_id: string;
  category_id: string | null;
  subcategory_id: string | null;
  next_due_date: string;
  last_processed_date: string | null;
  is_active: boolean;
}

interface TxLite {
  id: string;
  amount: number;
  date: string;
  account_id?: string;
  category_id?: string | null;
  is_draft?: boolean;
  user_id?: string;
}

/**
 * "mark rent as paid" / "I paid the rent". Recurrence-safety: this only
 * LINKS an existing, non-draft transaction (mark-covered creates no spend).
 * With no matching transaction in the current billing period ERA never
 * creates one itself — it opens the form prefilled from the commitment.
 */
export async function prepareCoverRecurring(nameHint: string, rawText: string): Promise<Result> {
  try {
    const res = await safeFetch("/api/recurring-payments", { timeoutMs: 8_000 });
    if (!res.ok) return { text: "Couldn't read your recurring payments.", ok: false };
    const { recurring_payments } = (await res.json()) as { recurring_payments: RecurringLite[] };
    const h = normalizeTitle(nameHint);
    const active = recurring_payments.filter((p) => p.is_active);
    const exact = active.filter((p) => normalizeTitle(p.name) === h);
    const loose = exact.length
      ? exact
      : active.filter((p) => {
          const n = normalizeTitle(p.name);
          return n.includes(h) || h.includes(n);
        });
    if (loose.length === 0) return { text: `No recurring payment called "${nameHint}".`, ok: false };
    if (loose.length > 1) return { text: `Which one — ${loose.map((p) => p.name).join(", ")}?`, ok: false };
    const payment = loose[0];

    const prefs = getCachedPreferences();
    const monthStartDay = Number(prefs?.date_start?.split("-")[1] ?? "1") || 1;
    const { start, end } = getDefaultDateRange(monthStartDay);
    const txRes = await safeFetch(`/api/transactions?start=${start}&end=${end}`, { timeoutMs: 10_000 });
    const txs: TxLite[] = txRes.ok ? await txRes.json() : [];
    const candidates = (Array.isArray(txs) ? txs : []).filter(
      (t) =>
        !t.is_draft &&
        (!t.user_id || t.user_id === payment.user_id) &&
        Math.abs(Number(t.amount) - Number(payment.amount)) < 0.005 &&
        (!payment.category_id || !t.category_id || t.category_id === payment.category_id),
    );

    if (candidates.length === 0) {
      return {
        text: `${payment.name} · no matching payment yet`,
        handoff: {
          kind: "spend",
          amount: Number(payment.amount),
          accountId: payment.account_id,
          categoryId: payment.category_id ?? undefined,
          subcategoryId: payment.subcategory_id ?? undefined,
          description: payment.name,
          expiresAt: expires(),
        },
      };
    }

    const snapshot = {
      paymentId: payment.id,
      name: payment.name,
      amount: Number(payment.amount),
      previousLastProcessed: payment.last_processed_date,
      previousNextDue: payment.next_due_date,
    };
    if (candidates.length > 1) {
      return slot(
        "recurring.link",
        "transactionId",
        `${payment.name} · which payment?`,
        candidates.slice(0, 4).map((t) => ({ label: `${moneyIn(Number(t.amount))} · ${t.date}`, value: t.id })),
        { ...snapshot, candidates: candidates.slice(0, 4) },
        rawText,
      );
    }
    return coverCard({ ...snapshot, transactionId: candidates[0].id, txDate: candidates[0].date }, rawText);
  } catch {
    return { text: "Couldn't read your recurring payments.", ok: false };
  }
}

export function coverCard(action: Omit<Extract<EraNativeAction, { type: "recurringCover" }>, "type">, rawText: string): Result {
  const text = `${action.name} · paid · ${moneyIn(action.amount)} · ${action.txDate}`;
  return {
    text,
    metadata: { proposed: "recurringCover", paymentId: action.paymentId },
    proposal: { kind: "native_action", text, sourceText: rawText, action: { type: "recurringCover", ...action } },
  };
}

/**
 * Runs only from the card. Component 7 "revalidated on tap": mark-covered
 * advances next_due_date on EVERY call (no duplicate guard — Budget pain),
 * so refuse if the payment moved since the card was built.
 */
export async function executeCoverRecurring(
  action: Extract<EraNativeAction, { type: "recurringCover" }>,
): Promise<{ text: string; ok: boolean; outcome: "done" | "failed" | "uncertain"; metadata?: Record<string, unknown> }> {
  try {
    const listRes = await safeFetch("/api/recurring-payments", { timeoutMs: 8_000 });
    if (!listRes.ok) return { text: "Couldn't check it first.", ok: false, outcome: "failed" };
    const { recurring_payments } = (await listRes.json()) as { recurring_payments: RecurringLite[] };
    const now = recurring_payments.find((p) => p.id === action.paymentId);
    if (!now || now.next_due_date !== action.previousNextDue) {
      return { text: `${action.name} is already covered.`, ok: false, outcome: "failed" };
    }
  } catch {
    return { text: "Couldn't check it first.", ok: false, outcome: "failed" };
  }
  try {
    const res = await safeFetch(`/api/recurring-payments/${action.paymentId}/mark-covered`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ transaction_id: action.transactionId }),
      timeoutMs: 8_000,
    });
    if (!res.ok) return { text: `Couldn't mark ${action.name} paid.`, ok: false, outcome: "failed" };
    const data = (await res.json()) as { next_due_date?: string };
    return {
      text: `${action.name} · paid${data.next_due_date ? ` · next ${data.next_due_date}` : ""}`,
      ok: true,
      outcome: "done",
      metadata: { paymentId: action.paymentId, transactionId: action.transactionId, nextDue: data.next_due_date },
    };
  } catch {
    return { text: `Not sure ${action.name} was marked. Check Recurring before retrying.`, ok: false, outcome: "uncertain" };
  }
}

/** Inverse — the Recurring page's own Undo: restore the previous dates. */
export async function undoCoverRecurring(action: Extract<EraNativeAction, { type: "recurringCover" }>): Promise<boolean> {
  const res = await safeFetch(`/api/recurring-payments/${action.paymentId}`, {
    method: "PATCH",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      last_processed_date: action.previousLastProcessed,
      next_due_date: action.previousNextDue,
    }),
    timeoutMs: 8_000,
  });
  return res.ok;
}
