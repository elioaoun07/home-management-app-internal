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
  accounts: Account[] | undefined
): "income" | "expense" | undefined {
  return accounts?.find((a) => a.id === accountId)?.type;
}

/**
 * Check if an account is an income account
 */
export function isIncomeAccount(
  accountId: string,
  accounts: Account[] | undefined
): boolean {
  return getAccountType(accountId, accounts) === "income";
}

/**
 * Check if an account is an expense account
 */
export function isExpenseAccount(
  accountId: string,
  accounts: Account[] | undefined
): boolean {
  return getAccountType(accountId, accounts) === "expense";
}

/**
 * Filter transactions by account type
 */
export function filterTransactionsByAccountType(
  transactions: TransactionWithAccount[],
  accounts: Account[] | undefined,
  type: "income" | "expense"
): TransactionWithAccount[] {
  if (!accounts || accounts.length === 0) return [];

  const accountIds = new Set(
    accounts.filter((a) => a.type === type).map((a) => a.id)
  );

  return transactions.filter((t) => accountIds.has(t.account_id));
}

/**
 * Get only expense transactions (default view for most dashboards)
 */
export function getExpenseTransactions(
  transactions: TransactionWithAccount[],
  accounts: Account[] | undefined
): TransactionWithAccount[] {
  return filterTransactionsByAccountType(transactions, accounts, "expense");
}

/**
 * Get only income transactions
 */
export function getIncomeTransactions(
  transactions: TransactionWithAccount[],
  accounts: Account[] | undefined
): TransactionWithAccount[] {
  return filterTransactionsByAccountType(transactions, accounts, "income");
}

/**
 * Calculate income vs expense summary
 */
export function calculateIncomeExpenseSummary(
  transactions: TransactionWithAccount[],
  accounts: Account[] | undefined
): IncomeExpenseSummary {
  const incomeTransactions = getIncomeTransactions(transactions, accounts);
  const expenseTransactions = getExpenseTransactions(transactions, accounts);

  const totalIncome = incomeTransactions.reduce(
    (sum, t) => sum + Number(t.amount),
    0
  );
  const totalExpense = expenseTransactions.reduce(
    (sum, t) => sum + Number(t.amount),
    0
  );

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
 * Group transactions by category (expense accounts only)
 */
export function groupExpensesByCategory(
  transactions: TransactionWithAccount[],
  accounts: Account[] | undefined
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
    >
  );
}

/**
 * Group transactions by account type
 */
export function groupTransactionsByAccountType(
  transactions: TransactionWithAccount[],
  accounts: Account[] | undefined
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

  const accountTypeMap = new Map<string, "income" | "expense">();
  accounts.forEach((a) => {
    accountTypeMap.set(a.id, a.type);
  });

  const result = {
    income: [] as TransactionWithAccount[],
    expense: [] as TransactionWithAccount[],
    unknown: [] as TransactionWithAccount[],
  };

  transactions.forEach((t) => {
    const type = accountTypeMap.get(t.account_id);
    if (type === "income") {
      result.income.push(t);
    } else if (type === "expense") {
      result.expense.push(t);
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
  accounts: Account[] | undefined
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
  accounts: Account[] | undefined
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
