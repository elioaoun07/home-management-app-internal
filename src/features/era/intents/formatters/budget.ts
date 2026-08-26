// Budget face reply formatter
//
// Pools + slots, per `src/lib/era/phrasing.ts`. Money figures are facts: every
// variant in a pool states the same numbers. Only the framing moves.

import {
  ACK_DONE,
  ACK_LOOKED_UP,
  errorReply,
  listOut,
  money,
  pick,
  plural,
  say,
} from "@/lib/era/phrasing";

export interface BudgetSpendData {
  total: number;
  scope: "self" | "partner" | "household";
  topCategory: string | null;
  topAmount: number | null;
  currency: "USD" | "LBP";
}

// ---------------------------------------------------------------------------
// monthSpend
// ---------------------------------------------------------------------------

/**
 * Scope changes the grammatical subject, so each scope needs its own pool
 * rather than a shared template with a swapped pronoun — "Your partner has
 * spent" and "You've spent" don't fit the same sentence frames.
 *
 * Slots: {total}
 */
const SPEND_SELF = [
  "You've spent {total} so far this period.",
  "{total} out the door this period.",
  "You're at {total} for the period so far.",
  "So far this period: {total}.",
  "That's {total} spent this period.",
  "Running total for the period: {total}.",
] as const;

const SPEND_PARTNER = [
  "Your partner has spent {total} so far this period.",
  "Your partner is at {total} for the period.",
  "On your partner's side: {total} so far this period.",
  "Your partner's spending this period comes to {total}.",
] as const;

const SPEND_HOUSEHOLD = [
  "Between the two of you, {total} this period.",
  "Household spending is at {total} for the period.",
  "Together you're at {total} so far this period.",
  "The two of you have spent {total} this period.",
  "Combined, that's {total} this period.",
] as const;

const SPEND_POOLS: Record<BudgetSpendData["scope"], readonly string[]> = {
  self: SPEND_SELF,
  partner: SPEND_PARTNER,
  household: SPEND_HOUSEHOLD,
};

/** Slots: {category} */
const SPEND_ZERO = [
  "Nothing spent this period{category}. Clean run.",
  "Not a cent this period{category}.",
  "Zero so far this period{category}. Nice.",
  "Nothing logged this period{category} yet.",
  "Blank slate this period{category}.",
] as const;

/** Slots: {category}, {amount} */
const TOP_CATEGORY = [
  "Most of it went to {category} — {amount}.",
  "{category} took the biggest bite at {amount}.",
  "The bulk of that is {category}: {amount}.",
  "Biggest line is {category}, {amount}.",
  "{category} leads at {amount}.",
  "Where it went: mostly {category}, {amount}.",
] as const;

export function formatMonthSpend(data: BudgetSpendData): string {
  const { total, scope, topCategory, topAmount } = data;

  if (total === 0) {
    return say(SPEND_ZERO, { category: topCategory ? `on ${topCategory}` : "" });
  }

  const parts: string[] = [say(SPEND_POOLS[scope], { total: money(total) })];

  if (topCategory && topAmount) {
    parts.push(say(TOP_CATEGORY, { category: topCategory, amount: money(topAmount) }));
  }

  return parts.join(" ");
}

export function formatBudgetError(): string {
  return errorReply("I couldn't pull your spending data.");
}

// ---------------------------------------------------------------------------
// showAnalytics
// ---------------------------------------------------------------------------

export interface AnalyticsData {
  /** Label of the month being summarized, e.g. "August". */
  monthLabel: string;
  income: number;
  expense: number;
  savingsRate: number;
  transactionCount: number;
  /** Up to three categories, largest first. */
  topCategories: Array<{ name: string; amount: number }>;
  /** Previous month's expense, when we have one to compare against. */
  previousExpense: number | null;
}

/** Month key "2026-08" → "August". Falls back to the raw key if malformed. */
export function monthKeyToLabel(monthKey: string): string {
  const m = /^(\d{4})-(\d{2})$/.exec(monthKey);
  if (!m) return monthKey;
  const d = new Date(Number(m[1]), Number(m[2]) - 1, 1);
  return d.toLocaleDateString("en-US", { month: "long" });
}

/** Slots: {month} */
const ANALYTICS_EMPTY = [
  "Nothing logged for {month} yet, so there's nothing to chart. Add a few transactions and ask me again.",
  "{month} is empty so far — no transactions to work with yet.",
  "I've got no data for {month} yet. Log some spending and I'll have something to show you.",
  "Nothing on the books for {month}. Come back once there's a transaction or two.",
] as const;

/** Slots: {ack}, {month}, {out}, {in}, {count} */
const ANALYTICS_HEADLINE = [
  "{ack} {month} so far — {out} out{in}, across {count}.",
  "{month} so far: {out} out{in} over {count}.",
  "{ack} in {month} you've moved {out} out{in}, across {count}.",
  "Here's {month}: {out} spent{in}, {count} in total.",
  "{ack} {month} to date — {out} out{in} over {count}.",
] as const;

/** Slots: {rate} */
const SAVINGS_POSITIVE = [
  "That's a {rate}% savings rate.",
  "You're keeping {rate}% of what came in.",
  "Savings rate sits at {rate}%.",
  "{rate}% of income is staying put.",
] as const;

/** Slots: {rate} */
const SAVINGS_NEGATIVE = [
  "You're {rate}% over what came in.",
  "That's {rate}% more out than in.",
  "Spending is outrunning income by {rate}%.",
  "You're running {rate}% past what you earned.",
] as const;

/** Slots: {list} */
const BUCKETS_MANY = [
  "Biggest buckets: {list}.",
  "Most of it: {list}.",
  "Top of the list — {list}.",
  "The big three are {list}.",
  "Where it's going: {list}.",
] as const;

/** Slots: {list} */
const BUCKETS_ONE = [
  "It all went to {list}.",
  "That's entirely {list}.",
  "One bucket: {list}.",
  "All of it under {list}.",
] as const;

/** Slots: {pct} */
const TREND_UP = [
  "That's {pct}% more than last month.",
  "Up {pct}% on last month.",
  "You're running {pct}% hotter than last month.",
  "That's {pct}% above where you were last month.",
] as const;

/** Slots: {pct} */
const TREND_DOWN = [
  "That's {pct}% less than last month — nice.",
  "Down {pct}% on last month. Good direction.",
  "You're {pct}% below last month.",
  "That's {pct}% lighter than last month.",
] as const;

const TREND_FLAT = [
  "Roughly in line with last month.",
  "About the same as last month.",
  "Level with last month.",
  "Basically last month again.",
] as const;

export function formatAnalytics(data: AnalyticsData): string {
  const {
    monthLabel,
    income,
    expense,
    savingsRate,
    transactionCount,
    topCategories,
    previousExpense,
  } = data;

  if (transactionCount === 0 && expense === 0 && income === 0) {
    return say(ANALYTICS_EMPTY, { month: monthLabel });
  }

  const parts: string[] = [
    say(ANALYTICS_HEADLINE, {
      ack: pick(ACK_LOOKED_UP),
      month: monthLabel,
      out: money(expense),
      in: income > 0 ? `and ${money(income)} in` : "",
      count: plural(transactionCount, "transaction"),
    }),
  ];

  if (income > 0) {
    parts.push(
      savingsRate >= 0
        ? say(SAVINGS_POSITIVE, { rate: Math.round(savingsRate) })
        : say(SAVINGS_NEGATIVE, { rate: Math.abs(Math.round(savingsRate)) }),
    );
  }

  if (topCategories.length > 0) {
    const list = listOut(
      topCategories.map((c) => `${c.name} (${money(c.amount)})`),
    );
    parts.push(say(topCategories.length === 1 ? BUCKETS_ONE : BUCKETS_MANY, { list }));
  }

  if (previousExpense !== null && previousExpense > 0) {
    const delta = expense - previousExpense;
    const pct = Math.round(Math.abs(delta / previousExpense) * 100);
    if (pct < 5) {
      parts.push(pick(TREND_FLAT));
    } else {
      parts.push(say(delta > 0 ? TREND_UP : TREND_DOWN, { pct }));
    }
  }

  return parts.join(" ");
}

export function formatAnalyticsError(): string {
  return errorReply("I couldn't pull your analytics.");
}

// ---------------------------------------------------------------------------
// draftTransaction
// ---------------------------------------------------------------------------

export interface DraftTransactionData {
  amount: number;
  categoryName?: string | null;
  subcategoryName?: string | null;
}

/** Slots: {ack}, {amount}, {where} e.g. "under Car / Fuel" */
const DRAFT_SAVED = [
  "{ack} {amount}{where}. It's waiting in Drafts for you to confirm.",
  "{ack} drafted {amount}{where}. Confirm it in Drafts when you're ready.",
  "Drafted {amount}{where}. Have a look in Drafts and confirm.",
  "{ack} {amount}{where} is sitting in Drafts.",
  "I've put {amount}{where} in Drafts for you to sign off.",
  "{ack} that's {amount}{where}, parked in Drafts.",
] as const;

export function formatDraftTransaction(data: DraftTransactionData): string {
  const { amount, categoryName, subcategoryName } = data;
  return say(DRAFT_SAVED, {
    ack: pick(ACK_DONE),
    amount: money(amount),
    where: categoryName
      ? `under ${categoryName}${subcategoryName ? ` / ${subcategoryName}` : ""}`
      : "",
  });
}

const DRAFT_NO_ACCOUNT = [
  "I don't have an account to draft that against. Add one in Accounts and I'll be able to log spending.",
  "There's no account set up yet, so I've nowhere to put that. Create one in Accounts first.",
  "I need an account before I can log spending — set one up in Accounts.",
] as const;

const DRAFT_NO_AMOUNT = [
  'I couldn\'t find an amount in that. Try something like "I paid $25 for car fuel".',
  'No number in there that I could read as money. Something like "I paid $25 for car fuel" works.',
  'I missed the amount. Give it to me like "spent $25 on fuel".',
  'That didn\'t have a figure I could use — try "I paid $25 for car fuel".',
] as const;

const DRAFT_OFFLINE = [
  "You're offline, so I couldn't save that draft. Tell me again once you're back on.",
  "No connection right now — that draft didn't save. Try again when you're online.",
  "That didn't go through; you're offline. Repeat it when you've got signal.",
] as const;

export function formatDraftTransactionError(
  reason: "no-account" | "no-amount" | "request-failed" | "offline",
  message?: string,
): string {
  switch (reason) {
    case "no-account":
      return pick(DRAFT_NO_ACCOUNT);
    case "no-amount":
      return pick(DRAFT_NO_AMOUNT);
    case "offline":
      return pick(DRAFT_OFFLINE);
    default:
      return errorReply(
        message ? `I couldn't save that draft — ${message}` : "I couldn't save that draft.",
      );
  }
}

// ---------------------------------------------------------------------------
// transfer
// ---------------------------------------------------------------------------

/** Slots: {ack}, {amount}, {from}, {to} */
const TRANSFER_DONE = [
  "{ack} moved {amount} from {from} to {to}.",
  "{ack} {amount} is now in {to}, out of {from}.",
  "Transferred {amount} from {from} to {to}.",
  "{ack} that's {amount} across, from {from} to {to}.",
  "Done — {amount} from {from} into {to}.",
] as const;

export function formatTransferCreated(data: {
  amount: number;
  fromName: string;
  toName: string;
}): string {
  return say(TRANSFER_DONE, {
    ack: pick(ACK_DONE),
    amount: money(data.amount),
    from: data.fromName,
    to: data.toName,
  });
}

const TRANSFER_NO_AMOUNT = [
  'I need an amount and two accounts — try "transfer $50 from wallet to savings".',
  'Missing the amount there. Something like "move $50 from wallet to savings" works.',
] as const;

const TRANSFER_NO_ACCOUNTS = [
  'I need both accounts named — try "transfer $50 from wallet to savings".',
  "I caught the amount but not which two accounts. Name both, like \"from wallet to savings\".",
] as const;

/** Slots: {hint} */
const TRANSFER_ACCOUNT_NOT_FOUND = [
  "I couldn't find an account matching \"{hint}\". Check the name in Accounts.",
  "No account named anything like \"{hint}\" — have a look in Accounts.",
] as const;

const TRANSFER_SAME_ACCOUNT = [
  "That's the same account twice — I need two different ones.",
  "Both of those matched the same account. Pick two different ones.",
] as const;

export function formatTransferError(
  reason: "no-amount" | "no-accounts" | "same-account" | "account-not-found" | "request-failed",
  detail?: string,
): string {
  switch (reason) {
    case "no-amount":
      return pick(TRANSFER_NO_AMOUNT);
    case "no-accounts":
      return pick(TRANSFER_NO_ACCOUNTS);
    case "same-account":
      return pick(TRANSFER_SAME_ACCOUNT);
    case "account-not-found":
      return say(TRANSFER_ACCOUNT_NOT_FOUND, { hint: detail ?? "" });
    default:
      return errorReply(
        detail ? `I couldn't make that transfer — ${detail}` : "I couldn't make that transfer.",
      );
  }
}

// ---------------------------------------------------------------------------
// recordDebt
// ---------------------------------------------------------------------------

/** Slots: {ack}, {name}, {amount} */
const DEBT_RECORDED = [
  "{ack} noted — {name} owes you {amount}.",
  "{ack} tracking {amount} from {name}.",
  "Got it — {name} owes {amount}. Filed under Debts.",
  "{ack} {name}'s down for {amount} in Debts.",
] as const;

export function formatDebtRecorded(data: { debtorName: string; amount: number }): string {
  return say(DEBT_RECORDED, {
    ack: pick(ACK_DONE),
    name: data.debtorName,
    amount: money(data.amount),
  });
}

const DEBT_MISSING_FIELDS = [
  'I need who owes you and how much — try "John owes me $30 for lunch".',
  'Missing a name or an amount there. Something like "Sara owes 20" works.',
] as const;

export function formatRecordDebtError(
  reason: "missing-fields" | "request-failed",
  detail?: string,
): string {
  return reason === "missing-fields"
    ? pick(DEBT_MISSING_FIELDS)
    : errorReply(
        detail ? `I couldn't save that debt — ${detail}` : "I couldn't save that debt.",
      );
}

// ---------------------------------------------------------------------------
// listDrafts
// ---------------------------------------------------------------------------

/** Slots: {count}, {list} */
const DRAFTS_LIST = [
  "You've got {count} waiting: {list}.",
  "{count} sitting in Drafts: {list}.",
  "Pending: {list} — {count} in total.",
] as const;

const DRAFTS_EMPTY = [
  "Nothing waiting in Drafts.",
  "Drafts is empty — you're all caught up.",
  "No pending drafts right now.",
] as const;

export function formatDraftsList(
  drafts: Array<{ amount: number; description?: string | null }>,
): string {
  if (drafts.length === 0) return pick(DRAFTS_EMPTY);
  const list = listOut(
    drafts.map((d) => `${money(d.amount)}${d.description ? ` (${d.description})` : ""}`),
  );
  return say(DRAFTS_LIST, { count: plural(drafts.length, "draft"), list });
}

export function formatListDraftsError(): string {
  return errorReply("I couldn't pull your drafts.");
}

// ---------------------------------------------------------------------------
// confirmDraft
// ---------------------------------------------------------------------------

/** Slots: {ack}, {amount}, {where} */
const DRAFT_CONFIRMED = [
  "{ack} confirmed {amount}{where}.",
  "{ack} that's logged now — {amount}{where}.",
  "Confirmed — {amount}{where} is a real transaction now.",
] as const;

export function formatDraftConfirmed(data: {
  amount: number;
  categoryName?: string | null;
}): string {
  return say(DRAFT_CONFIRMED, {
    ack: pick(ACK_DONE),
    amount: money(data.amount),
    where: data.categoryName ? ` under ${data.categoryName}` : "",
  });
}

const DRAFT_NONE_PENDING = [
  "There's nothing in Drafts to confirm.",
  "Drafts is empty — nothing to confirm there.",
] as const;

/** Slots: {hint} */
const DRAFT_HINT_NOT_FOUND = [
  "I couldn't find a draft matching \"{hint}\".",
  "Nothing in Drafts looks like \"{hint}\".",
] as const;

const DRAFT_HINT_AMBIGUOUS = [
  "More than one draft matches that — open Drafts and confirm it there.",
  "A few drafts match \"{hint}\" — pick the right one from Drafts.",
] as const;

export function formatConfirmDraftError(
  reason: "none-pending" | "not-found" | "ambiguous" | "request-failed",
  hint?: string,
): string {
  switch (reason) {
    case "none-pending":
      return pick(DRAFT_NONE_PENDING);
    case "not-found":
      return say(DRAFT_HINT_NOT_FOUND, { hint: hint ?? "" });
    case "ambiguous":
      return say(DRAFT_HINT_AMBIGUOUS, { hint: hint ?? "" });
    default:
      return errorReply("I couldn't confirm that draft.");
  }
}
