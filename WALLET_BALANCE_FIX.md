# Wallet Balance Fix - Migration Instructions

## Problem

The wallet balance was being incorrectly updated by adjusting a stored value every time a transaction was added or deleted. This caused the balance to drift and not reflect the actual state.

## Solution

Changed the balance system to:

1. Store an **initial balance** and **timestamp when it was set**
2. **Calculate current balance dynamically** from: `initial_balance - SUM(transactions since balance_set_at)`
3. Remove all balance adjustment logic from transaction APIs

## Migration Steps

### 1. Run the Database Migration

Execute this SQL in your Supabase SQL Editor:

```sql
-- Add balance_set_at column to track when balance was manually set
ALTER TABLE public.account_balances
ADD COLUMN IF NOT EXISTS balance_set_at timestamp with time zone NOT NULL DEFAULT now();

-- Update existing records to use their updated_at as balance_set_at
UPDATE public.account_balances
SET balance_set_at = updated_at
WHERE balance_set_at IS NULL OR balance_set_at = now();

-- Add comment to explain the column
COMMENT ON COLUMN public.account_balances.balance_set_at IS
'Timestamp when the balance was last manually set. Used to calculate current balance from transactions after this date.';
```

### 2. Reset Your Account Balance

After running the migration:

1. Go to the expense page
2. Edit your wallet balance to the **current actual amount** (e.g., 300)
3. This sets the `balance_set_at` timestamp to now

### 3. How It Works Now

#### Setting Balance

When you set your wallet balance to 300 today:

- Stores: `balance = 300`, `balance_set_at = 2025-11-21 10:00:00`

#### Adding Transactions

Tomorrow you pay 100:

- Transaction is created with `amount = 100`
- Balance API calculates: `300 - 100 = 200` (reads from transactions table)

#### Test Transactions

You test with 10:

- Transaction created with `amount = 10`
- Balance calculates: `300 - 100 - 10 = 190`

#### Deleting Test Transactions

You delete the test entry:

- Transaction is deleted
- Balance automatically recalculates: `300 - 100 = 200` ✅

## Changes Made

### Files Modified

1. **`migrations/add_balance_set_at.sql`** (NEW)
   - Adds `balance_set_at` column to track when balance was manually set

2. **`src/app/api/accounts/[id]/balance/route.ts`**
   - GET: Now calculates balance from initial value + sum of transactions since `balance_set_at`
   - POST: Sets `balance_set_at` to current timestamp when manually updating balance
   - PATCH: Removed entirely (no longer needed)

3. **`src/app/api/transactions/route.ts`**
   - Removed all balance update logic from POST endpoint
   - Transactions no longer modify the balance table

## Testing

After migration and resetting your balance:

1. **Add expense**: Balance should decrease by transaction amount
2. **Add another expense**: Balance should decrease by both transactions
3. **Delete one transaction**: Balance should increase back
4. **Edit transaction amount**: Balance should reflect the new amount
5. **Set balance again**: This resets the baseline, ignoring all previous transactions

## Benefits

✅ Balance always reflects actual state  
✅ No drift from manual adjustments  
✅ Deleting transactions correctly updates balance  
✅ Editing transactions automatically recalculates  
✅ Can reset balance at any time to reconcile with physical wallet
