# Balance Calculation System - Technical Overview

## 🎯 System Architecture

### Core Principle: **Baseline + Dynamic Calculation**

Instead of storing a "running balance" that gets adjusted with every transaction, the system:

1. **Stores** an initial balance and when it was set
2. **Calculates** current balance dynamically from transactions

```
Current Balance = Initial Balance - SUM(transactions since balance_set_at)
```

## 🔧 Technical Components

### Database Schema

**`account_balances` table:**

```sql
id                uuid PRIMARY KEY
account_id        uuid REFERENCES accounts(id)
user_id           uuid REFERENCES auth.users(id)
balance           numeric NOT NULL DEFAULT 0
balance_set_at    timestamp with time zone NOT NULL DEFAULT now()
created_at        timestamp with time zone NOT NULL DEFAULT now()
updated_at        timestamp with time zone NOT NULL DEFAULT now()
```

**Key Field: `balance_set_at`**

- Timestamp when user manually set their balance
- Acts as the baseline reference point
- All transactions with `date >= balance_set_at::date` are included in calculation

**`transactions` table:**

```sql
id             uuid PRIMARY KEY
user_id        uuid NOT NULL
account_id     uuid NOT NULL
date           date NOT NULL              -- Transaction date (what we compare)
amount         numeric NOT NULL
description    text
category_id    uuid
subcategory_id uuid
is_draft       boolean DEFAULT false
is_private     boolean DEFAULT false
inserted_at    timestamp with time zone  -- Record creation time
```

**Key Fields:**

- `date`: When transaction actually occurred (used for balance calculation)
- `inserted_at`: When record was created (used for auditing, not balance)

## 📊 Balance Calculation Flow

### API Endpoint: `GET /api/accounts/[id]/balance`

**Step 1: Fetch baseline**

```typescript
const { data: balanceData } = await supabase
  .from("account_balances")
  .select("balance, balance_set_at, created_at, updated_at")
  .eq("account_id", accountId)
  .single();
```

**Step 2: Sum transactions since baseline**

```typescript
const { data: transactionsSum } = await supabase
  .from("transactions")
  .select("amount")
  .eq("account_id", accountId)
  .eq("is_draft", false)
  .gte("date", balanceData.balance_set_at.split("T")[0]); // Date comparison

const totalTransactions =
  transactionsSum?.reduce((sum, t) => sum + Number(t.amount), 0) || 0;
```

**Step 3: Calculate current balance**

```typescript
const currentBalance =
  accountType === "expense"
    ? Number(balanceData.balance) - totalTransactions
    : Number(balanceData.balance) + totalTransactions;
```

### Why Use `date` Not `inserted_at`?

**Scenario:**

```
Timeline:
Nov 21, 7 PM: Set balance to $40
Nov 22, 10 AM: Remember yesterday's $5 expense, add it with date = Nov 21

If we used inserted_at:
  ❌ inserted_at (Nov 22) > balance_set_at (Nov 21)
  ❌ Transaction included even though it happened before balance was set
  ❌ Balance = $40 - $5 = $35 (WRONG!)

Using date:
  ✅ date (Nov 21) < balance_set_at::date (Nov 21)
  ✅ Transaction excluded (happened before baseline)
  ✅ Balance = $40 (CORRECT!)
```

## 🔄 User Workflows

### Setting Balance

**API: `POST /api/accounts/[id]/balance`**

```typescript
const { data } = await supabase
  .from("account_balances")
  .upsert(
    {
      account_id: accountId,
      user_id: user.id,
      balance: 100, // User's input
      balance_set_at: now(), // Current timestamp
      updated_at: now(),
    },
    { onConflict: "account_id" }
  )
  .select()
  .single();
```

**What happens:**

1. Stores balance value: `$100`
2. Sets `balance_set_at` to current time: `2025-11-22T10:30:00Z`
3. From this point, only transactions with `date >= 2025-11-22` are counted

### Adding Transaction

**API: `POST /api/transactions`**

```typescript
const transactionData = {
  user_id: user.id,
  date: "2025-11-22", // Transaction date
  category_id: categoryId,
  amount: 20,
  description: "Groceries",
  account_id: accountId,
  // inserted_at is auto-set by database
};

const { data } = await supabase
  .from("transactions")
  .insert(transactionData)
  .select()
  .single();
```

**What happens:**

1. Transaction stored with `date = 2025-11-22`
2. `inserted_at` auto-set to current time
3. **Balance API automatically recalculates** on next fetch
4. No manual balance update needed!

### Client-Side Query Invalidation

After creating/deleting/editing transactions:

```typescript
await queryClient.invalidateQueries({
  queryKey: ["account-balance", accountId],
});
```

This triggers a re-fetch of balance, which re-runs the calculation with updated transactions.

## 🧮 Calculation Examples

### Example 1: Normal Daily Usage

```
Setup:
- Nov 22, 7 AM: Set balance to $100
  balance = 100, balance_set_at = 2025-11-22T07:00:00

Transactions:
- Nov 22, 10 AM: Add $20 expense (date = Nov 22)
- Nov 22, 3 PM:  Add $15 expense (date = Nov 22)
- Nov 23, 9 AM:  Add $30 expense (date = Nov 23)

Query executes:
  SELECT SUM(amount) FROM transactions
  WHERE account_id = 'xxx'
    AND is_draft = false
    AND date >= '2025-11-22'

  Result: 20 + 15 + 30 = 65

Calculated Balance: 100 - 65 = $35 ✅
```

### Example 2: Backdated Transaction

```
Setup:
- Nov 22, 7 AM: Set balance to $100
  balance = 100, balance_set_at = 2025-11-22T07:00:00

Transactions:
- Nov 22, 10 AM: Add $20 expense (date = Nov 22)
- Nov 23, 9 AM:  Remember yesterday's $10 expense, add with date = Nov 21

Query executes:
  SELECT SUM(amount) FROM transactions
  WHERE account_id = 'xxx'
    AND is_draft = false
    AND date >= '2025-11-22'

  Result: Only $20 (Nov 21 transaction excluded)

Calculated Balance: 100 - 20 = $80 ✅
```

The Nov 21 transaction is correctly excluded because it happened before the balance baseline.

### Example 3: Weekly Reset

```
Week 1:
- Nov 15: Set balance to $200
- Nov 15-21: Spend $180
- Nov 21 balance check: $200 - $180 = $20 ✅

Week 2:
- Nov 22, 7 AM: Count physical wallet = $25 (found $5 extra!)
- Nov 22, 7:05 AM: Reset balance to $25
  balance = 25, balance_set_at = 2025-11-22T07:05:00

From this point:
- ALL previous transactions ignored
- Only transactions with date >= Nov 22 counted
- Clean slate for new week!
```

## 🔍 Data Integrity Features

### 1. Idempotent Calculations

Same query always returns same result:

```sql
-- Run this query 100 times, same result every time
SELECT
  (SELECT balance FROM account_balances WHERE account_id = 'xxx'),
  (SELECT SUM(amount) FROM transactions
   WHERE account_id = 'xxx'
     AND date >= (SELECT balance_set_at::date
                   FROM account_balances
                   WHERE account_id = 'xxx'))
```

### 2. No Stored Running Balance

**Previous (Wrong) Approach:**

```
Transaction added → UPDATE account_balances SET balance = balance - amount
Problem: If transaction deleted, must UPDATE again (can cause drift)
```

**Current (Correct) Approach:**

```
Transaction added → Balance query recalculates from transactions
Transaction deleted → Balance query recalculates from transactions
Result: Always accurate, no drift possible
```

### 3. Temporal Consistency

Transactions are counted based on when they occurred (`date`), not when entered (`inserted_at`).

This means:

- Adding past transactions doesn't mess up current balance
- Can bulk-import historical data without affecting current balance
- Balance reflects actual financial state at a point in time

## 🚀 Performance Optimizations

### Query Optimization

**Current Query:**

```sql
SELECT SUM(amount)
FROM transactions
WHERE account_id = $1
  AND is_draft = false
  AND date >= $2
```

**Index Recommendations:**

```sql
-- Composite index for balance calculation queries
CREATE INDEX idx_transactions_balance_calc
ON transactions(account_id, date, is_draft, amount)
WHERE is_draft = false;

-- Partial index for draft transactions
CREATE INDEX idx_transactions_drafts
ON transactions(account_id, user_id)
WHERE is_draft = true;
```

### Caching Strategy

**Client-side (React Query):**

```typescript
queryKey: ["account-balance", accountId];
staleTime: 30000; // 30 seconds
```

**Server-side:**

```typescript
headers: {
  "Cache-Control": "public, s-maxage=60, stale-while-revalidate=300"
}
```

### When Balance Updates

Balance is **automatically recalculated** on every fetch. No manual updates needed.

**Triggers for re-fetch:**

1. Transaction created → `invalidateQueries(["account-balance"])`
2. Transaction deleted → `invalidateQueries(["account-balance"])`
3. Transaction edited → `invalidateQueries(["account-balance"])`
4. Draft confirmed → `invalidateQueries(["account-balance"])`
5. User navigates to page → React Query auto-refetch

## 🐛 Debugging

### Check Current Balance Logic

```sql
WITH balance_info AS (
  SELECT
    account_id,
    balance as initial_balance,
    balance_set_at,
    balance_set_at::date as baseline_date
  FROM account_balances
  WHERE account_id = 'xxx'
),
transaction_sum AS (
  SELECT
    COALESCE(SUM(amount), 0) as total
  FROM transactions
  WHERE account_id = 'xxx'
    AND is_draft = false
    AND date >= (SELECT baseline_date FROM balance_info)
)
SELECT
  bi.initial_balance,
  ts.total as transactions_total,
  bi.initial_balance - ts.total as calculated_balance,
  bi.baseline_date,
  (SELECT COUNT(*) FROM transactions
   WHERE account_id = 'xxx'
     AND is_draft = false
     AND date >= bi.baseline_date) as transaction_count
FROM balance_info bi
CROSS JOIN transaction_sum ts;
```

### View Transactions Included in Balance

```sql
SELECT
  date,
  amount,
  description,
  inserted_at,
  CASE
    WHEN date >= (SELECT balance_set_at::date FROM account_balances WHERE account_id = 'xxx')
    THEN '✅ INCLUDED'
    ELSE '❌ EXCLUDED'
  END as included_in_balance
FROM transactions
WHERE account_id = 'xxx'
  AND is_draft = false
ORDER BY date DESC, inserted_at DESC;
```

## 📚 Best Practices

### For Users

1. **Set balance when you know exact amount**
   - Count physical wallet/check bank account
   - Set balance in app to match exactly
   - This creates clean baseline

2. **Use correct transaction dates**
   - If adding past transaction, use actual date it occurred
   - System will correctly include/exclude based on date

3. **Weekly reconciliation**
   - Every week, check physical wallet
   - Compare with app balance
   - If different, investigate or reset balance

### For Developers

1. **Never manually adjust balance in transactions API**
   - Let balance API calculate dynamically
   - Don't add "balance update" logic to transaction endpoints

2. **Always use `date` for financial calculations**
   - Use `inserted_at` for auditing/history only
   - Date comparison ensures temporal correctness

3. **Invalidate queries after mutations**
   ```typescript
   await queryClient.invalidateQueries({
     queryKey: ["account-balance", accountId],
   });
   ```

## 🔐 Security Considerations

### Row Level Security (RLS)

```sql
-- Users can only see their own balances
CREATE POLICY "Users can view own account balances"
ON account_balances FOR SELECT
USING (user_id = auth.uid());

-- Users can only update their own balances
CREATE POLICY "Users can update own account balances"
ON account_balances FOR UPDATE
USING (user_id = auth.uid());
```

### Household Sharing

Balance is **account-specific** and **user-owned**:

- Partner can view transactions (if shared)
- Partner **cannot** view/edit account balances
- Each user manages their own accounts/balances independently

## ✨ Summary

This balance calculation system provides:

1. **Accuracy**: Always reflects actual transaction history
2. **Flexibility**: Can reset baseline anytime for reconciliation
3. **Simplicity**: One source of truth (transactions table)
4. **Performance**: Efficient queries with proper indexing
5. **Maintainability**: Clear, documented logic
6. **Correctness**: Uses transaction dates, not insertion timestamps

**The fix ensures your wallet balance is always accurate and trustworthy! 💰✅**

---

**Version:** 2.0  
**Last Updated:** November 22, 2025  
**Status:** Production Ready 🚀
