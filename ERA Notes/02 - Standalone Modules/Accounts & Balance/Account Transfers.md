---
created: 2026-03-23
type: feature-doc
module: transfers
module-type: standalone
status: active
tags:
  - type/feature-doc
  - module/transfers
---

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

### 2b. NFC / URL Transfer Shortcut

Implemented 2026-06-25: `/expense?transfer=salary-wallet` opens the mobile
expense entry form and immediately shows a small transfer prompt.

Optimized 2026-06-27: the prompt now supports **single-URL template slugs** and
**quick-template toggle chips** inside the modal, so a single NFC tag URL covers
all common transfer patterns without requiring `from` / `to` params.

#### New single-URL template slugs

| URL | Template pre-selected | From | To |
|-----|-----------------------|------|----|
| `/expense?transfer=salary-deposit` | Salary Deposit | Salary | Drawer |
| `/expense?transfer=refill-wallet` | Refill Wallet | Drawer | Wallet |
| `/expense?transfer=savings` | Savings | *(user picks)* | Wallet |
| `/expense?transfer=transfer` | *(none — picker shown)* | *(user picks)* | *(user picks)* |

The slug alone determines the preset. No `from` / `to` params are needed.

#### In-modal template chips

Three quick-toggle chips appear at the top of every transfer prompt:
**Salary Deposit · Refill Wallet · Savings**

Tapping a chip pre-fills the accounts for that template. The user can still
override the accounts via the selects. The Savings chip leaves the From account
open for the user to specify.

#### Legacy slugs (backward compat)

The old slugs (`salary-wallet`, `salary-to-wallet`, `wallet-refill`) continue to
work unchanged. They rely on explicit `from` / `to` URL params (or the Salary /
Wallet name-match defaults) and do not pre-select a template chip.

#### General behaviour

- The prompt fetches the signed-in user's own visible accounts through
  `useMyAccounts()`.
- Account resolution: UUID first, then case-insensitive exact name, then
  contains-match fallback — so name-based URLs work across household users.
- If a template's fixed account can't be matched, an amber warning is shown and
  the selects remain open for manual pick.
- Optional `amount` param still works for all slugs, e.g.
  `/expense?transfer=salary-deposit&amount=400`.
- `/expense` preserves the full shortcut query through login via
  `/login?redirect=...`, so unauthenticated taps return to the prompt after
  sign-in.
- The prompt is intentionally **own-account only** — uses `useMyAccounts()` so
  tapping the same NFC URL never presets the partner's Salary or Wallet.
- UUID `from` / `to` URL params still work on legacy slugs and visibly preselect
  the matching accounts in the selects.

### 2c. Shared Household Accounts

Implemented 2026-06-26: accounts can be private or public.

- Private accounts are the default and behave like the original owner-only account model.
- Public accounts are visible to the active household partner when the account is also visible.
- Both household users can open a public account, adjust its balance, add/deduct transactions against it, and transfer to or from it.
- The account row remains owned by the creator (`accounts.user_id`); partner writes are authorized through `src/lib/accountAccess.ts` and balance rows continue to belong to the account owner.
- Partner access does not make private transactions visible. Partner reads still filter out transactions where `transactions.is_private=true`.
- Exception: `/expense?transfer=salary-wallet` stays own-account scoped even in a
  household, because a physical NFC tap should fund the logged-in user's Wallet
  from the logged-in user's Salary.

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
The reversal is logged to `account_balance_history` as `transfer_deleted` for
both affected accounts and links back to the soft-deleted transfer row.
The API only reverses rows whose `deleted_at` is still null, so retries or
double-submits cannot reverse the same transfer twice.

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
- Balance history rows use `transfer_in` / `transfer_out` on create and
  `transfer_updated` / `transfer_deleted` for lifecycle reversals.

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
- `src/components/expense/NfcWalletTransferPrompt.tsx` - URL/NFC wallet refill prompt

### Modified Files

- `src/components/expense/AccountBalance.tsx` - Added transfer button
- `src/components/layouts/TabContainer.tsx` - Opens the wallet refill prompt from `/expense?transfer=salary-wallet`
- `src/app/expense/ExpenseClientWrapper.tsx` - Watch-mode expense page wrapper
- `src/app/expense/page.tsx` - Preserves expense shortcut query params through login redirects

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
- [x] Quick transfer templates (e.g., "Monthly Savings") *(IMPLEMENTED 2026-06-27)*
- [ ] Recurring transfers (auto-transfer on payday)
- [ ] Transfer insights (how much moved between accounts over time)
