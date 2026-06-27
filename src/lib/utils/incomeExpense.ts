/**
 * Income vs Expense utility functions
 * Separates transactions by account type to prevent income from interfering with expense analytics
 */

import type { Account } from "@/types/domain";

export type TransactionWithAccount = {
  id: string;
  amount: number;
  account_id: string;
  account_name?: string;
  date: string;
  category?: string | null;
  subcategory?: string | null;
  [key: string]: any;
};

export type IncomeExpenseSummary = {
  totalIncome: number;
  totalExpense: number;
  netBalance: number;
  incomeTransactions: TransactionWithAccount[];
  expenseTransactions: TransactionWithAccount[];
};

/**
 * Get account type for a given account ID
 */
export function getAccountType(
  accountId: string,
  accounts: Account[] | undefined,
): "income" | "expense" | "saving" | undefined {
  return accounts?.find((a) => a.id === accountId)?.type;
}

/**
 * Check if an account is a saving account
 */
export function isSavingAccount(
  accountId: string,
  accounts: Account[] | undefined,
): boolean {
  return getAccountType(accountId, accounts) === "saving";
}

/**
 * Check if an account uses positive balance logic (income or saving)
 * These account types treat positive amounts as additions to balance
 */
export function isPositiveBalanceAccount(
  accountId: string,
  accounts: Account[] | undefined,
): boolean {
  const type = getAccountType(accountId, accounts);
  return type === "income" || type === "saving";
}

/**
 * Check if an account is an income account
 */
export function isIncomeAccount(
  accountId: string,
  accounts: Account[] | undefined,
): boolean {
  return getAccountType(accountId, accounts) === "income";
}

/**
 * Check if an account is an expense account
 */
export function isExpenseAccount(
  accountId: string,
  accounts: Account[] | undefined,
): boolean {
  return getAccountType(accountId, accounts) === "expense";
}

/**
 * Filter transactions by account type
 */
export function filterTransactionsByAccountType(
  transactions: TransactionWithAccount[],
  accounts: Account[] | undefined,
  type: "income" | "expense" | "saving",
): TransactionWithAccount[] {
  if (!accounts || accounts.length === 0) return [];

  const accountIds = new Set(
    accounts.filter((a) => a.type === type).map((a) => a.id),
  );

  return transactions.filter((t) => accountIds.has(t.account_id));
}

/**
 * Get only expense transactions (default view for most dashboards)
 */
export function getExpenseTransactions(
  transactions: TransactionWithAccount[],
  accounts: Account[] | undefined,
): TransactionWithAccount[] {
  return filterTransactionsByAccountType(transactions, accounts, "expense");
}

/**
 * Get only income transactions
 */
export function getIncomeTransactions(
  transactions: TransactionWithAccount[],
  accounts: Account[] | undefined,
): TransactionWithAccount[] {
  return filterTransactionsByAccountType(transactions, accounts, "income");
}

/**
 * Get only saving transactions
 */
export function getSavingTransactions(
  transactions: TransactionWithAccount[],
  accounts: Account[] | undefined,
): TransactionWithAccount[] {
  return filterTransactionsByAccountType(transactions, accounts, "saving");
}

/**
 * Calculate income vs expense summary
 * Note: Debt return transactions (is_debt_return=true) are excluded from income totals
 * as they represent money being returned, not actual earned income
 */
export function calculateIncomeExpenseSummary(
  transactions: TransactionWithAccount[],
  accounts: Account[] | undefined,
): IncomeExpenseSummary {
  const incomeTransactions = getIncomeTransactions(transactions, accounts);
  const expenseTransactions = getExpenseTransactions(transactions, accounts);

  // Filter out debt returns from income calculation
  const realIncomeTransactions = incomeTransactions.filter(
    (t) => !t.is_debt_return,
  );

  const totalIncome = realIncomeTransactions.reduce(
    (sum, t) => sum + Number(t.amount),
    0,
  );
  // For debt transactions, use net cost (original - returned) instead of the full amount
  // This way a $50 expense where $25 was returned only counts as $25 in totals
  const totalExpense = expenseTransactions.reduce((sum, t) => {
    const tx = t as any;
    if (tx.debt_id && tx.debt_net_cost != null) {
      return sum + Number(tx.debt_net_cost);
    }
    return sum + Number(t.amount);
  }, 0);

  return {
    totalIncome,
    totalExpense,
    netBalance: totalIncome - totalExpense,
    incomeTransactions,
    expenseTransactions,
  };
}

/**
 * Get expense accounts only
 */
export function getExpenseAccounts(accounts: Account[] | undefined): Account[] {
  return accounts?.filter((a) => a.type === "expense") ?? [];
}

/**
 * Get income accounts only
 */
export function getIncomeAccounts(accounts: Account[] | undefined): Account[] {
  return accounts?.filter((a) => a.type === "income") ?? [];
}

/**
 * Get saving accounts only
 */
export function getSavingAccounts(accounts: Account[] | undefined): Account[] {
  return accounts?.filter((a) => a.type === "saving") ?? [];
}

/**
 * Get accounts that use positive balance logic (income + saving)
 */
export function getPositiveBalanceAccounts(
  accounts: Account[] | undefined,
): Account[] {
  return (
    accounts?.filter((a) => a.type === "income" || a.type === "saving") ?? []
  );
}

/**
 * Group transactions by category (expense accounts only)
 */
export function groupExpensesByCategory(
  transactions: TransactionWithAccount[],
  accounts: Account[] | undefined,
): Record<
  string,
  { amount: number; count: number; transactions: TransactionWithAccount[] }
> {
  const expenseTransactions = getExpenseTransactions(transactions, accounts);

  return expenseTransactions.reduce(
    (acc, transaction) => {
      const category = transaction.category || "Uncategorized";

      if (!acc[category]) {
        acc[category] = {
          amount: 0,
          count: 0,
          transactions: [],
        };
      }

      acc[category].amount += Number(transaction.amount);
      acc[category].count += 1;
      acc[category].transactions.push(transaction);

      return acc;
    },
    {} as Record<
      string,
      { amount: number; count: number; transactions: TransactionWithAccount[] }
    >,
  );
}

/**
 * Group transactions by account type
 */
export function groupTransactionsByAccountType(
  transactions: TransactionWithAccount[],
  accounts: Account[] | undefined,
): {
  income: TransactionWithAccount[];
  expense: TransactionWithAccount[];
  unknown: TransactionWithAccount[];
} {
  if (!accounts || accounts.length === 0) {
    return {
      income: [],
      expense: [],
      unknown: transactions,
    };
  }

  const accountTypeMap = new Map<string, "income" | "expense" | "saving">();
  accounts.forEach((a) => {
    accountTypeMap.set(a.id, a.type);
  });

  const result = {
    income: [] as TransactionWithAccount[],
    expense: [] as TransactionWithAccount[],
    saving: [] as TransactionWithAccount[],
    unknown: [] as TransactionWithAccount[],
  };

  transactions.forEach((t) => {
    const type = accountTypeMap.get(t.account_id);
    if (type === "income") {
      result.income.push(t);
    } else if (type === "expense") {
      result.expense.push(t);
    } else if (type === "saving") {
      result.saving.push(t);
    } else {
      result.unknown.push(t);
    }
  });

  return result;
}

/**
 * Calculate savings rate (income - expenses) / income * 100
 */
export function calculateSavingsRate(
  transactions: TransactionWithAccount[],
  accounts: Account[] | undefined,
): number {
  const summary = calculateIncomeExpenseSummary(transactions, accounts);

  if (summary.totalIncome === 0) return 0;

  return (summary.netBalance / summary.totalIncome) * 100;
}

/**
 * Get expense categories (excludes income categories)
 */
export function getExpenseCategories(
  transactions: TransactionWithAccount[],
  accounts: Account[] | undefined,
): string[] {
  const expenseTransactions = getExpenseTransactions(transactions, accounts);
  const categories = new Set<string>();

  expenseTransactions.forEach((t) => {
    if (t.category) {
      categories.add(t.category);
    }
  });

  return Array.from(categories).sort();
}

// ===========================================================================
// Canonical "spending" definition — SINGLE SOURCE OF TRUTH
// ---------------------------------------------------------------------------
// Every surface that shows a "spent" figure (Insight pie, Categories total,
// Monthly bars, Budget "Spent" card) MUST derive it from these helpers so the
// numbers reconcile to the penny. Diverging ad-hoc sums are what caused the
// Insight/Monthly/Categories/Budget totals to disagree.
//
// Rules:
//  - expense-type accounts only
//  - debt-return rows (is_debt_return) are excluded — they are money coming
//    back to you (a repayment), not spending
//  - draft rows (is_draft) are excluded — drafts are unconfirmed/voice/future
//    entries, not real spending (the spend queries also filter these out)
//  - restricted to [start, end] inclusive when a window is supplied, compared
//    on the YYYY-MM-DD prefix so custom-month ranges line up exactly
//  - amount is the absolute, full transaction amount
//
// Partner-private filtering is applied upstream (transaction service on the
// client, API query on the server), so the transactions handed in here are
// already privacy-scoped — do not re-implement it per surface.
// ===========================================================================

export type SpendWindow = { start?: string; end?: string };

/** Canonical per-transaction spend amount (absolute, full amount). */
export function spendAmount(t: TransactionWithAccount): number {
  return Math.abs(Number(t.amount) || 0);
}

/**
 * Canonical filter for transactions that count as spending in a period.
 */
export function getSpendingTransactions(
  transactions: TransactionWithAccount[],
  accounts: Account[] | undefined,
  window: SpendWindow = {},
): TransactionWithAccount[] {
  const { start, end } = window;
  return getExpenseTransactions(transactions, accounts).filter((t) => {
    const tx = t as { is_debt_return?: boolean; is_draft?: boolean };
    if (tx.is_debt_return) return false;
    if (tx.is_draft) return false;
    const d = t.date.slice(0, 10);
    if (start && d < start) return false;
    if (end && d > end) return false;
    return true;
  });
}

/**
 * Canonical total spending for a period. Use everywhere a "spent" figure is
 * shown so all surfaces agree.
 */
export function sumSpending(
  transactions: TransactionWithAccount[],
  accounts: Account[] | undefined,
  window: SpendWindow = {},
): number {
  return getSpendingTransactions(transactions, accounts, window).reduce(
    (sum, t) => sum + spendAmount(t),
    0,
  );
}
