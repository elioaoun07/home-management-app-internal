# Account Transfers Feature

## Overview

The Account Transfers feature allows you to move money between your accounts. This is essential for:

1. **Transferring from Income to Savings** - e.g., Move $200 from Salary to Savings
2. **Funding your Wallet** - e.g., Move $400 from Salary to Wallet Balance
3. **Rebalancing accounts** - Move funds between any accounts as needed

## Your Use Case

```
Monthly Income: $1,000 (Salary Account - income type)
↓
Transfer $200 → Savings Account
Transfer $400 → Wallet Balance
↓
Remaining in Salary: $400 for other expenses
Wallet Balance: +$400 (shows as positive, like income)
```

## How It Works

### Balance Updates

When you create a transfer:

- **Source account**: Balance decreases by the transfer amount
- **Destination account**: Balance increases by the transfer amount (appears positive)

This means transfers TO your wallet will increase the wallet balance, maintaining reconciliation accuracy.

### Transfer Display

Transfers appear distinctly from regular transactions:

- They show the source and destination accounts
- They are tracked separately in the `transfers` table
- They don't affect your spending analytics (budget tracking)

## Setup

### 1. Run the Database Migration

Execute this SQL in your Supabase SQL Editor:

```sql
-- See: migrations/add_transfers.sql
```

Or run the full migration file:

```bash
psql "YOUR_CONNECTION_STRING" -f migrations/add_transfers.sql
```

### 2. Using Transfers

1. Go to the expense page
2. Look for the **Transfer** button (→ icon) next to the balance edit button
3. Click it to open the Transfer dialog
4. Select:
   - **From Account**: Source account (e.g., Salary)
   - **To Account**: Destination account (e.g., Wallet, Savings)
   - **Amount**: How much to transfer
   - **Description**: Optional note
   - **Date**: When the transfer occurred

### 3. Viewing Transfers

Transfers can be viewed via:

- The API: `GET /api/transfers`
- Future: A dedicated transfers history view

## API Endpoints

### List Transfers

```
GET /api/transfers?start=2025-01-01&end=2025-01-31
```

### Create Transfer

```
POST /api/transfers
{
  "from_account_id": "uuid",
  "to_account_id": "uuid",
  "amount": 400,
  "description": "Fund wallet for January",
  "date": "2025-01-15"
}
```

### Update Transfer

```
PATCH /api/transfers/{id}
{
  "amount": 450,
  "description": "Updated amount"
}
```

### Delete Transfer

```
DELETE /api/transfers/{id}
```

This will reverse the balance changes automatically.

## Architecture

### Database Schema

```sql
CREATE TABLE public.transfers (
  id uuid PRIMARY KEY,
  user_id uuid NOT NULL,
  from_account_id uuid NOT NULL,
  to_account_id uuid NOT NULL,
  amount numeric NOT NULL CHECK (amount > 0),
  description text,
  date date NOT NULL,
  created_at timestamp with time zone,
  updated_at timestamp with time zone
);
```

### Balance Calculation

Transfers directly update the `account_balances` table:

- Creates balance record if it doesn't exist
- Adjusts both source (-) and destination (+) balances atomically

### React Query Integration

The feature uses React Query hooks for:

- `useTransfers()` - Fetch transfer list
- `useCreateTransfer()` - Create with optimistic updates
- `useUpdateTransfer()` - Update with cache invalidation
- `useDeleteTransfer()` - Delete with balance reversal

## Files Created/Modified

### New Files

- `migrations/add_transfers.sql` - Database schema
- `src/app/api/transfers/route.ts` - API endpoints (GET, POST)
- `src/app/api/transfers/[id]/route.ts` - API endpoints (GET, PATCH, DELETE)
- `src/features/transfers/hooks.ts` - React Query hooks
- `src/components/expense/TransferDialog.tsx` - Transfer UI component

### Modified Files

- `src/components/expense/AccountBalance.tsx` - Added transfer button

## Wallet Balance Reconciliation

Your wallet balance feature now works seamlessly with transfers:

1. **Set initial wallet balance**: e.g., $50 (physical cash you have)
2. **Add transfer from Salary**: +$400
3. **Wallet balance now shows**: $450
4. **Spend $30 on groceries**: -$30 (regular transaction)
5. **Current balance**: $420

The balance always reflects:

- Initial set balance
- Plus: All incoming transfers
- Minus: All expense transactions

This maintains accurate reconciliation against your physical wallet.

## Future Enhancements

- [ ] Transfers history view in the UI
- [ ] Quick transfer templates (e.g., "Monthly Savings")
- [ ] Recurring transfers (auto-transfer on payday)
- [ ] Transfer insights (how much moved between accounts over time)
