# Balance History & Audit System - Architecture Design

## Overview

Transform the simple wallet balance tracking into a comprehensive financial audit system that:

1. Tracks every change to account balances
2. Records the source/cause of each change
3. Enables full reconciliation history
4. Shows discrepancy explanations

---

## Database Schema

### New Table: `account_balance_history`

```sql
CREATE TABLE public.account_balance_history (
  id uuid NOT NULL DEFAULT gen_random_uuid(),
  account_id uuid NOT NULL,
  user_id uuid NOT NULL,

  -- Balance values
  previous_balance numeric NOT NULL,
  new_balance numeric NOT NULL,
  change_amount numeric NOT NULL, -- Always: new_balance - previous_balance

  -- Change classification
  change_type text NOT NULL,
  -- Values: 'initial_set', 'manual_set', 'manual_adjustment',
  --         'transfer_in', 'transfer_out',
  --         'transaction_expense', 'transaction_deleted',
  --         'split_bill_paid', 'split_bill_received',
  --         'draft_confirmed'

  -- Source entity references (nullable - depends on change_type)
  transaction_id uuid,           -- For transaction-related changes
  transfer_id uuid,              -- For transfer-related changes

  -- Manual update metadata
  reason text,                   -- User-provided reason (for manual changes)
  is_reconciliation boolean NOT NULL DEFAULT false,  -- Was this to fix a mismatch?

  -- Reconciliation details (only for manual updates)
  expected_balance numeric,      -- What system calculated balance should be
  discrepancy_amount numeric,    -- Difference: expected - actual (before fix)
  discrepancy_explanation text,  -- Why the mismatch occurred

  -- Timestamps
  effective_date date NOT NULL DEFAULT CURRENT_DATE,  -- When change is effective
  created_at timestamp with time zone NOT NULL DEFAULT now(),

  -- Constraints
  CONSTRAINT account_balance_history_pkey PRIMARY KEY (id),
  CONSTRAINT abh_account_fkey FOREIGN KEY (account_id) REFERENCES public.accounts(id) ON DELETE CASCADE,
  CONSTRAINT abh_user_fkey FOREIGN KEY (user_id) REFERENCES auth.users(id) ON DELETE CASCADE,
  CONSTRAINT abh_transaction_fkey FOREIGN KEY (transaction_id) REFERENCES public.transactions(id) ON DELETE SET NULL,
  CONSTRAINT abh_transfer_fkey FOREIGN KEY (transfer_id) REFERENCES public.transfers(id) ON DELETE SET NULL,
  CONSTRAINT abh_change_type_check CHECK (
    change_type IN (
      'initial_set', 'manual_set', 'manual_adjustment',
      'transfer_in', 'transfer_out',
      'transaction_expense', 'transaction_deleted',
      'split_bill_paid', 'split_bill_received',
      'draft_confirmed'
    )
  )
);
```

---

## Change Types Explained

| Change Type           | Description                             | Triggered By                      |
| --------------------- | --------------------------------------- | --------------------------------- |
| `initial_set`         | First time balance is set for account   | User sets balance for new account |
| `manual_set`          | User explicitly sets balance to a value | Edit balance in UI                |
| `manual_adjustment`   | User adjusts balance by a delta         | "Adjust by" feature               |
| `transfer_in`         | Money received from another account     | Transfer (destination side)       |
| `transfer_out`        | Money sent to another account           | Transfer (source side)            |
| `transaction_expense` | Expense deducted from balance           | New transaction created           |
| `transaction_deleted` | Deleted transaction restored balance    | Transaction deleted               |
| `split_bill_paid`     | Split bill payment                      | User pays their split portion     |
| `split_bill_received` | Split bill contribution received        | Partner pays their portion        |
| `draft_confirmed`     | Draft transaction confirmed             | Draft → Confirmed                 |

---

## Reconciliation Tracking

When a user manually sets the balance, the system should:

1. **Calculate Expected Balance**: What the balance SHOULD be based on:
   - Last known set balance (`balance_set_at`)
   - Sum of all transactions since then
   - Sum of all transfers since then

2. **Detect Discrepancy**: Compare expected vs. what user is setting

3. **Record the Gap**: Store `discrepancy_amount` and allow user to provide explanation

### Example Scenario

```
User's wallet shows: $150 (system calculated)
User's actual wallet: $120 (physically counted)
Discrepancy: $30 missing

User sets balance to $120 with reason: "Found $30 was stolen/lost"

History Record:
  previous_balance: 150
  new_balance: 120
  change_amount: -30
  change_type: 'manual_set'
  is_reconciliation: true
  expected_balance: 150
  discrepancy_amount: -30
  discrepancy_explanation: "Found $30 was stolen/lost"
```

---

## UI Components

### 1. Balance History Drawer

Opens when clicking the Balance container. Shows:

```
┌────────────────────────────────────────────┐
│ 📊 Balance History - Wallet                │
│                                            │
│ Current Balance: $420.00                   │
│ ─────────────────────────────────────────  │
│                                            │
│ Today                                      │
│ ┌──────────────────────────────────────┐  │
│ │ ↓ -$15.00          Groceries         │  │
│ │   Transaction expense                 │  │
│ │   Balance: $420.00 → $405.00         │  │
│ └──────────────────────────────────────┘  │
│                                            │
│ Jan 17, 2026                               │
│ ┌──────────────────────────────────────┐  │
│ │ ↑ +$400.00        From: Salary       │  │
│ │   Transfer in                         │  │
│ │   Balance: $50.00 → $450.00          │  │
│ └──────────────────────────────────────┘  │
│                                            │
│ Jan 15, 2026                               │
│ ┌──────────────────────────────────────┐  │
│ │ ✎ Set to $50.00   Manual adjustment  │  │
│ │   Reason: Initial wallet count       │  │
│ │   ⚠️ Reconciliation: -$20 discrepancy│  │
│ └──────────────────────────────────────┘  │
│                                            │
└────────────────────────────────────────────┘
```

### 2. Manual Set Dialog (Enhanced)

When editing balance, show:

```
┌────────────────────────────────────────────┐
│ 💰 Update Balance                          │
│                                            │
│ Current Balance: $150.00                   │
│ Expected Balance: $150.00 ✓                │
│                                            │
│ New Balance: [_____$120.00_____]          │
│                                            │
│ ⚠️ This is $30.00 less than expected      │
│                                            │
│ Reason (required for reconciliation):     │
│ ┌──────────────────────────────────────┐  │
│ │ Cash lost/stolen during commute      │  │
│ └──────────────────────────────────────┘  │
│                                            │
│ [Cancel]                    [Save Balance] │
└────────────────────────────────────────────┘
```

---

## API Endpoints

### GET /api/accounts/[id]/balance/history

```typescript
// Query params
?limit=50
&offset=0
&start=2025-01-01
&end=2025-01-31

// Response
{
  account_id: "uuid",
  account_name: "Wallet",
  current_balance: 420.00,
  history: [
    {
      id: "uuid",
      change_type: "transaction_expense",
      previous_balance: 435.00,
      new_balance: 420.00,
      change_amount: -15.00,
      effective_date: "2026-01-18",
      created_at: "2026-01-18T10:30:00Z",
      transaction: {
        id: "uuid",
        description: "Groceries",
        category: "Food"
      },
      transfer: null,
      reason: null,
      is_reconciliation: false
    },
    {
      id: "uuid",
      change_type: "transfer_in",
      previous_balance: 50.00,
      new_balance: 450.00,
      change_amount: 400.00,
      effective_date: "2026-01-17",
      created_at: "2026-01-17T09:00:00Z",
      transaction: null,
      transfer: {
        id: "uuid",
        from_account_name: "Salary",
        description: "Monthly wallet funding"
      },
      reason: null,
      is_reconciliation: false
    },
    {
      id: "uuid",
      change_type: "manual_set",
      previous_balance: 70.00,
      new_balance: 50.00,
      change_amount: -20.00,
      effective_date: "2026-01-15",
      created_at: "2026-01-15T08:00:00Z",
      transaction: null,
      transfer: null,
      reason: "Initial wallet count - correcting system",
      is_reconciliation: true,
      expected_balance: 70.00,
      discrepancy_amount: -20.00,
      discrepancy_explanation: "Forgot to log coffee purchases"
    }
  ],
  pagination: {
    total: 45,
    limit: 50,
    offset: 0,
    has_more: false
  }
}
```

### POST /api/accounts/[id]/balance (Enhanced)

```typescript
// Request body
{
  balance: 120.00,
  reason: "Counted physical cash",           // Optional but recommended
  is_reconciliation: true,                   // User confirms this fixes a gap
  discrepancy_explanation: "Forgot to log taxi yesterday"  // Optional
}

// System will automatically:
// 1. Calculate expected_balance
// 2. Compute discrepancy_amount
// 3. Create history record
```

---

## Implementation Flow

### When Transaction is Created

```typescript
// After transaction.insert() succeeds:
await createBalanceHistoryEntry({
  account_id: transaction.account_id,
  user_id: userId,
  previous_balance: currentBalance,
  new_balance: currentBalance - transaction.amount,
  change_amount: -transaction.amount,
  change_type: "transaction_expense",
  transaction_id: transaction.id,
  effective_date: transaction.date,
});
```

### When Transfer is Created

```typescript
// Source account (FROM)
await createBalanceHistoryEntry({
  account_id: from_account_id,
  change_type: "transfer_out",
  change_amount: -amount,
  transfer_id: transfer.id,
});

// Destination account (TO)
await createBalanceHistoryEntry({
  account_id: to_account_id,
  change_type: "transfer_in",
  change_amount: +amount,
  transfer_id: transfer.id,
});
```

### When Balance is Manually Set

```typescript
// Calculate what balance SHOULD be
const expectedBalance = await calculateExpectedBalance(accountId);
const discrepancy = expectedBalance - newBalance;

await createBalanceHistoryEntry({
  account_id: accountId,
  previous_balance: expectedBalance,
  new_balance: newBalance,
  change_amount: newBalance - expectedBalance,
  change_type: discrepancy === 0 ? "manual_set" : "manual_adjustment",
  reason: userProvidedReason,
  is_reconciliation: Math.abs(discrepancy) > 0.01,
  expected_balance: expectedBalance,
  discrepancy_amount: discrepancy,
  discrepancy_explanation: userProvidedExplanation,
});
```

---

## Files to Create/Modify

### New Files

1. `migrations/add_account_balance_history.sql` - Database schema
2. `src/app/api/accounts/[id]/balance/history/route.ts` - History API
3. `src/components/expense/BalanceHistoryDrawer.tsx` - History UI
4. `src/features/balance/hooks.ts` - React Query hooks

### Modified Files

1. `src/app/api/accounts/[id]/balance/route.ts` - Add history logging
2. `src/app/api/transfers/route.ts` - Add history logging for transfers
3. `src/app/api/transfers/[id]/route.ts` - History on delete/update
4. `src/services/transaction.service.ts` - Add history logging
5. `src/components/expense/AccountBalance.tsx` - Click to open history

---

## Summary

This architecture provides:

✅ **Complete audit trail** - Every balance change is recorded  
✅ **Source tracking** - Know exactly what caused each change  
✅ **Reconciliation support** - Track and explain discrepancies  
✅ **Manual update accountability** - Reasons required for adjustments  
✅ **Historical analysis** - View balance over time  
✅ **Linked entities** - Navigate to related transactions/transfers

Shall I proceed with the implementation?
