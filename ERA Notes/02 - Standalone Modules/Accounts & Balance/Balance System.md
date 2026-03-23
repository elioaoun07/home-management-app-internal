---
created: 2026-03-23
type: feature-doc
module: accounts
module-type: standalone
status: active
tags:
  - type/feature-doc
  - module/accounts
---
# Balance System

> **Module:** `src/features/accounts/`, `src/features/balance/` | **API:** `src/app/api/accounts/[id]/balance/`
> **DB Tables:** `account_balances`, `account_balance_history`, `account_balance_archives`, `account_daily_summaries`
> **Status:** Active

## Overview

Each account tracks its balance using a **baseline + dynamic delta** model. A user manually sets a balance (the baseline), and the current balance is calculated in real time by summing all transactions since that baseline date.

## Architecture

### Balance formula

```
Current Balance = Initial Balance ± SUM(transactions WHERE date >= balance_set_at::date)
```

- `expense` accounts: transactions **subtract** from balance
- `income` / `saving` accounts: transactions **add** to balance

### Why `date` not `inserted_at`

Balance calculation uses the transaction's `date` (when it occurred), not `inserted_at` (when it was entered). This prevents backdated transactions from corrupting the current balance.

```
Example: Balance set Nov 21 @ 7PM ($40)
- You add a $5 transaction dated Nov 21 @ 6PM on Nov 22
- Using inserted_at (Nov 22) → incorrectly INCLUDED → wrong balance
- Using date (Nov 21 before 7PM) → correctly EXCLUDED → balance stays $40
```

### Key API endpoint

`GET /api/accounts/[id]/balance` — fetches `account_balances` baseline, sums transactions since `balance_set_at::date`, returns calculated balance.

`POST /api/accounts/[id]/balance` — sets new baseline, stamps `balance_set_at = now()`.

**Important**: Never manually adjust the balance in transaction API routes. Let the balance API recalculate dynamically.

### Query invalidation

After any transaction create/edit/delete, call:
```typescript
queryClient.invalidateQueries({ queryKey: ["account-balance", accountId] });
```

## Balance History (Audit Trail)

The `account_balance_history` table logs every non-transaction balance event.

### What gets logged
- `initial_set` / `manual_set` — user sets balance
- `manual_adjustment` — delta adjustment
- `transfer_in` / `transfer_out` — transfers between accounts
- `reconciliation` — manual fix with discrepancy explanation

### What does NOT get logged
Individual transactions are **not** logged here (too noisy). Instead, they appear in the **Daily Tab** as summarized entries.

### Three-tier history view (BalanceHistoryDrawer)

| Tab | Content |
|---|---|
| **Activity** | Transfers, manual sets, reconciliations — critical audit events |
| **Daily** | Summarized daily net (income − expenses) with category breakdown |
| **Archives** | Monthly snapshots: opening/closing balance, net change, transfer totals |

The `account_daily_summaries` table stores pre-computed daily summaries. The `account_balance_archives` table stores monthly snapshots.

## Database

```sql
-- account_balances: one row per account
balance           numeric    -- the baseline value
balance_set_at    timestamptz -- when the baseline was set (used for delta calculation)

-- account_balance_history: change_type constraint
CHECK (change_type IN ('initial_set','manual_set','manual_adjustment',
  'transfer_in','transfer_out','transaction_expense','transaction_income',
  'transaction_deleted','split_bill_paid','split_bill_received',
  'draft_confirmed','correction','transaction','transfer',
  'split_bill','future_payment','debt_settled','auto_reconciliation'))
```

## Key Files

- `src/app/api/accounts/[id]/balance/route.ts` — balance GET/POST with dynamic calculation
- `src/app/api/accounts/[id]/balance/history/route.ts` — history API
- `src/components/expense/AccountBalance.tsx` — balance display with offline support
- `src/components/expense/BalanceHistoryDrawer.tsx` — 3-tab history UI
- `src/features/balance/` — React Query hooks

## Gotchas

- Balance is always **recalculated on fetch** — there is no stored running balance
- Deleting or editing a transaction automatically updates the balance (via query invalidation)
- When offline, `AccountBalance` reads from localStorage cache and shows a grey gradient + "Cached" label
- Setting balance creates a clean baseline — all transactions before `balance_set_at::date` are ignored
- `account_balance_history` filters out individual transaction entries by default; pass `?exclude_transactions=false` to include them (debug mode)
