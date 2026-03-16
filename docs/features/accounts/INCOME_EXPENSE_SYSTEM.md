# Income vs Expense System

## Overview

A comprehensive solution for separating income and expense tracking throughout the application. This prevents income transactions from interfering with expense analytics and provides clear visibility into cash flow.

## Problem Solved

Previously, income entries (salary, bonuses) would appear as outliers in expense dashboards, skewing category analytics and making it difficult to track actual spending patterns.

## Implementation

### 1. Utility Functions (`src/lib/utils/incomeExpense.ts`)

**Core Functions:**

- `getAccountType()` - Get account type (income/expense) for an account ID
- `isIncomeAccount()` / `isExpenseAccount()` - Check account type
- `filterTransactionsByAccountType()` - Filter transactions by account type
- `getExpenseTransactions()` / `getIncomeTransactions()` - Get filtered transaction lists
- `calculateIncomeExpenseSummary()` - Calculate income vs expense totals and net balance
- `groupExpensesByCategory()` - Group only expense transactions by category
- `calculateSavingsRate()` - Calculate (income - expenses) / income \* 100
- `getExpenseCategories()` - Get unique expense categories (excludes income)

**Type Definitions:**

```typescript
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
```

### 2. Web Dashboard (`src/components/web/WebDashboard.tsx`)

**Added Features:**

1. **Account Type Filter Toggle**
   - Three options: Expenses (default), All, Income
   - Located in header below ownership filter
   - Visual indicators: Red for expenses, Green for income, Gray for all

2. **Income vs Expense Widget**
   - Shows total income, total expenses, and net balance/savings
   - Displays transaction counts for each type
   - Visual bars comparing income to expenses
   - Calculates savings rate percentage
   - Color-coded: Green for income, Red for expenses, Cyan for positive savings, Amber for deficit

3. **Filtered Analytics**
   - All category analytics default to expense accounts only
   - Income transactions don't affect expense category breakdowns
   - Spending velocity and projections based on expenses only
   - Health score calculated from expense patterns

**Usage:**

```typescript
const incomeExpenseSummary = calculateIncomeExpenseSummary(
  transactions,
  accounts
);
const savingsRate =
  (incomeExpenseSummary.netBalance / incomeExpenseSummary.totalIncome) * 100;
```

### 3. Mobile Dashboard (`src/components/dashboard/EnhancedMobileDashboard.tsx`)

**Added Features:**

1. **Account Type Filter State**
   - `accountTypeFilter`: "expense" | "income" | "all"
   - Defaults to "expense" for clean analytics

2. **Type-Filtered Transactions**
   - Filters transactions before applying other filters
   - Ensures categories only show relevant type
   - Maintains performance with memoization

3. **Income/Expense Summary**
   - Same summary data available as web dashboard
   - Can be displayed in mobile widgets
   - Supports swipe actions on filtered lists

### 4. Database Structure

**Accounts Table:**

```sql
CREATE TABLE public.accounts (
  id uuid NOT NULL DEFAULT uuid_generate_v4(),
  user_id uuid NOT NULL,
  name text NOT NULL,
  type text NOT NULL CHECK (type = ANY (ARRAY['income'::text, 'expense'::text])),
  inserted_at timestamp with time zone NOT NULL DEFAULT now(),
  is_default boolean DEFAULT false,
  CONSTRAINT accounts_pkey PRIMARY KEY (id)
);
```

**Transaction Relationship:**

- Each transaction belongs to an account via `account_id`
- Account type determines if transaction is income or expense
- No transaction-level type field needed

## User Workflow

### Setting Up Accounts

1. Create income accounts (e.g., "Salary Account", "Freelance Income")
2. Create expense accounts (e.g., "Wallet", "Credit Card")
3. Set one expense account as default for quick entry

### Adding Income

1. Select income account in account dropdown
2. Add amount, category (optional, e.g., "Salary", "Bonus")
3. Transaction saved with income account type

### Viewing Analytics

1. **Default View (Expenses Only)**
   - Dashboard shows only expense transactions
   - Categories reflect actual spending
   - Projections based on expense patterns

2. **Income View**
   - Switch filter to "Income"
   - See all income sources
   - Track income categories

3. **Combined View (All)**
   - See all transactions together
   - Compare income vs expenses
   - View net cash flow

### Budget Tracking

- Budgets automatically track expense accounts only
- Income doesn't affect budget calculations
- Clean separation ensures accurate budget alerts

## Benefits

1. **Clean Expense Analytics**
   - No income outliers in category breakdowns
   - Accurate spending patterns
   - Meaningful projections

2. **Clear Cash Flow Visibility**
   - See income, expenses, and net balance separately
   - Calculate savings rate
   - Track financial health

3. **Accurate Budgeting**
   - Budgets based on actual expenses
   - No confusion from income entries
   - Proper alerts when overspending

4. **Flexible Reporting**
   - Switch between income/expense/all views
   - Filter by account type anytime
   - Maintain separate category lists

## Technical Details

### Performance Optimization

- All filtering uses `useMemo` for memoization
- Account lookup uses Map for O(1) performance
- Filters applied before stats calculation
- TypeScript for type safety

### State Management

- Account type filter stored in component state
- Defaults to "expense" for clean UX
- Resets with "Clear Filters" button
- Syncs with URL parameters for shareable links

### TypeScript Types

```typescript
type AccountType = "expense" | "income";
type AccountTypeFilter = "all" | "expense" | "income";

type Account = {
  id: UUID;
  user_id: UUID;
  name: string;
  type: AccountType;
  is_default?: boolean;
  inserted_at: string;
};
```

## Future Enhancements

1. **Income vs Expense Trends**
   - Monthly income/expense comparison chart
   - Identify income stability vs expense variability

2. **Cash Flow Forecasting**
   - Predict future income based on patterns
   - Project expenses and net balance

3. **Savings Goals**
   - Set savings rate targets
   - Track progress toward financial goals

4. **Export Reports**
   - Generate income vs expense reports
   - Tax-ready income summaries
   - Expense categorization for reimbursements

## Migration Notes

For existing users:

1. All existing accounts default to "expense" type
2. User must manually categorize income accounts
3. Historical transactions inherit account type
4. No data migration needed - filter applied on-the-fly

## Testing Checklist

- [x] Income transactions don't appear in expense category lists
- [x] Expense transactions don't appear in income category lists
- [x] "All" filter shows both types
- [x] Income/Expense widget displays correct totals
- [x] Savings rate calculation accurate
- [x] Category analytics exclude income by default
- [x] Budget calculations ignore income accounts
- [x] Filter state persists across navigation
- [x] Mobile and web views consistent
- [x] TypeScript compilation successful
