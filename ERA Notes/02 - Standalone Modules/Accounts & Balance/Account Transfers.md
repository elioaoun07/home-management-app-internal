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
- A **household transfer destination** may also be any visible partner account, including a private one. This is deliberately narrower than ordinary account access: private partner accounts remain unavailable for direct adjustments and transactions.
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
  "date": "2025-01-15",
  "id": "client-generated uuid (optional idempotency key)"
}
```

**Exactly-once (BUD-87, 2026-11-03).** `id` is the idempotency key. `useCreateTransfer` mints it, ERA mints it with the confirm card (`clientId`). A repeat POST with the same id hits the primary key (`23505`) and gets the committed row back with no further balance movement. The same id with a different payload, or a transfer already undone, returns `409`. Callers that send no id (statement reconcile) behave as before.
Why: on 2026-10-28 a create took longer than the 8 s `safeFetch` budget, the still-filled dialog was re-submitted, and two rows were inserted 8.46 s apart.

### Update Transfer

```
PATCH /api/transfers/{id}
{
  "amount": 450,
  "description": "Updated amount"
}
```

Zod-validated. The row update runs first, guarded on `updated_at` (an overlapping edit gets `409`, and no money moves). The balance diff runs after it. The body holds absolute values, so a replayed PATCH computes a zero diff.

### Cross-Currency Conversion Transfers (2026-08-04)

For moving money between accounts with **different currencies** (e.g. a USD Wallet → a EUR trip-cash account), `self`-type transfers accept an optional `to_amount`: the destination-currency amount actually received, after any owner rounding override (a cash-exchange booth rarely gives you the textbook rate).

```
POST /api/transfers
{
  "from_account_id": "wallet-usd-uuid",
  "to_account_id": "trip-italy-eur-uuid",
  "amount": 100,
  "to_amount": 92,
  "transfer_type": "self"
}
```

- `to_amount` is **rejected on `household` transfers** — the fee/returned-amount math there assumes a single currency.
- The API stores `exchange_rate = to_amount / amount` alongside `to_amount`. Both are `null` on ordinary same-currency transfers (legacy symmetric behavior — the destination leg equals `amount`).
- Balance deltas become asymmetric: source loses `amount` (its own currency), destination gains `to_amount` (its own currency) instead of the same number. See `getTransferDeltas(amount, returnedAmount, transferType, toAmount)` in `src/lib/balance-utils.ts`.
- **PATCH recompute rule:** editing `amount` on an existing conversion transfer without also passing `to_amount` recomputes `to_amount` at the *same* stored rate, so the destination leg never silently goes stale.
- The UI (`TransferDialog.tsx`) shows a "They receive" field, prefilled from the two accounts' `exchange_rate` (both stored on `accounts`, see [[Overview]] → Currency & Exchange Rates), editable for rounding.
- **Undo/delete-recreate must carry `to_amount` forward** (`src/features/transfers/hooks.ts`) — omitting it on a deleted conversion transfer's Undo would recreate it as a symmetric same-currency transfer and corrupt the destination balance.

### Delete Transfer

```
DELETE /api/transfers/{id}
```

This will reverse the balance changes automatically.
The reversal is logged to `account_balance_history` as `transfer_deleted` for
both affected accounts and links back to the soft-deleted transfer row.
Only the request whose soft-delete actually flips `deleted_at` (the update
returns the row) reverses the balances. A retry or second tap gets
`{ success: true, alreadyDeleted: true }` and moves nothing. *(Before BUD-87
the guard ignored affected rows, so two overlapping DELETEs both reversed.)*

Implemented 2026-07-04: account balance history surfaces also exclude
soft-deleted transfers. Daily and archive balance summaries filter
`transfers.deleted_at IS NULL`, and direct transfer lookup returns 404 for
deleted rows, so removed transfers do not re-enter reconstructed balance totals.
Follow-up 2026-07-04: automatic balance write-back from refresh/reconcile paths
was disabled. Refresh must not create `correction` history rows or mutate
`account_balances`; polluted stored balances require an explicit repair.

## Architecture

### Database Schema

```sql
CREATE TABLE public.transfers (
  id uuid PRIMARY KEY,
  user_id uuid NOT NULL,
  from_account_id uuid NOT NULL,
  to_account_id uuid NOT NULL,
  amount numeric NOT NULL CHECK (amount > 0),
  to_amount numeric CHECK (to_amount > 0),      -- cross-currency destination amount (2026-08-04); null = same-currency
  exchange_rate numeric CHECK (exchange_rate > 0), -- to_amount / amount, stored for display; null when to_amount is null
  description text,
  date date NOT NULL,
  created_at timestamp with time zone,
  updated_at timestamp with time zone
);
```

### Balance Calculation

Transfers directly update the `account_balances` table:

- Creates balance record if it doesn't exist
- Adjusts source (-) and destination (+) through `adjustAccountBalance`, in parallel. Each leg is a compare-and-swap on the stored value, so overlapping writers on one account both count (BUD-87).
- **Not atomic with the row:** the insert and the two legs are separate PostgREST calls. A server death between them leaves a row with no balance effect. The single-transaction fix is **BUD-63** (SQL increment + history RPC, owner-run migration).
- Balance history rows use `transfer_in` / `transfer_out` on create and
  `transfer_updated` / `transfer_deleted` for lifecycle reversals. Until `migrations/2026-11-03_balance-history-change-types.sql` runs, the live `abh_change_type_check` rejects the last two. The balance still moves, but the history row is dropped and logged to `error_logs` (**BUD-88**, confirmed 2026-10-28).

### React Query Integration

The feature uses React Query hooks for:

- `useTransfers()` - Fetch transfer list
- `useCreateTransfer()` - Optimistic: the list row and both `["account-balance", id]` caches move before the request leaves. It retries a slow request (15 s budget, then 0.8 s / 2.5 s) with the same id. If the outcome stays unconfirmed, it rolls back, refetches, and shows a **Retry** toast with the same id. Re-submitting the same payload also reuses that id. `TransferDialog` closes on submit.
- `useUpdateTransfer()` - Optimistic list row + balance diff (mirrors the route's `to_amount` recompute)
- `useDeleteTransfer()` - Optimistic removal + balance reversal; Undo re-creates with a new id

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
- Excluding: Soft-deleted transfers
- Minus: All expense transactions

This maintains accurate reconciliation against your physical wallet.

## Future Enhancements

- [ ] Transfers history view in the UI
- [x] Quick transfer templates (e.g., "Monthly Savings") *(IMPLEMENTED 2026-06-27)*
- [ ] Recurring transfers (auto-transfer on payday)
- [ ] Transfer insights (how much moved between accounts over time)
