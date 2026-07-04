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

`GET /api/accounts/[id]/balance` — fetches the stored account balance, subtracts pending drafts, and returns the display balance. It must be read-only.

`POST /api/accounts/[id]/balance` — sets new baseline, stamps `balance_set_at = now()`. Also accepts `balanceSetAt` (override the stamped timestamp) and `restoreHistoryId` (undo path — see Reconciliation Checkpoint below) for the Undo flow on the reconciliation toast.

**Important**: Transaction and transfer API routes update the stored running balance immediately for responsive reads. GET/refresh paths must never mutate money. Any balance repair must be explicit and user-initiated.

### Query invalidation

After any transaction create/edit/delete, call:
```typescript
queryClient.invalidateQueries({ queryKey: ["account-balance", accountId] });
```

## Balance History (Audit Trail)

The `account_balance_history` table logs every non-transaction balance event.

### What gets logged
- `transfer_updated` / `transfer_deleted` - transfer edits and undo/delete reversals
- `statement_import` - bulk imported statement rows summarized per affected account
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

## Reconciliation Checkpoint *(added 2026-06-16)*

`balance_set_at` doubles as **"last time the user manually checked/verified the balance against their real wallet."** This works because `adjustAccountBalance()` (`src/lib/balance.ts`) — the function every transaction/transfer/split/auto-reconciliation goes through — updates `balance` and `updated_at` but **never** `balance_set_at`. Only the manual `POST /api/accounts/[id]/balance` (Edit-balance pencil, or the reconcile flow below) moves it.

### UI

- **`AccountBalance.tsx`** shows the checkpoint as "Checked _X ago_" (relative time via `date-fns formatDistanceToNow`). If more than `RECONCILE_STALE_DAYS` (7) days have passed, the label turns red and pulses via the `.glow-pulse-danger` CSS class (`src/app/globals.css`) — a theme-independent alert glow, since staleness is not a person-identity color (Hard Rule #14 doesn't apply).
- Clicking the checkpoint date or the balance opens **`BalanceHistoryDrawer`**, which has a "Reconciliation checkpoint" panel right under the Current Balance header with two actions:
  - **"Balance matches ✓"** — one-tap confirm. POSTs the *same* balance value with `is_reconciliation: true`, which just re-stamps `balance_set_at` to now (no actual balance change, `change_amount = 0`).
  - **"Doesn't match — correct it"** — reveals an amount + optional note input. POSTs the real wallet amount as the new balance with `discrepancy_explanation`, so the discrepancy is visible later in the Activity tab (`account_balance_history.discrepancy_amount`/`discrepancy_explanation`, columns that already existed for this purpose).

### Undo

Both reconcile actions show a `toast.success("Balance checked", { action: { label: "Undo", ... } })` (Hard Rule #1). Undo calls the same POST endpoint with:
- `balance` = the response's `previous_balance`
- `balanceSetAt` = the response's `previous_balance_set_at` (restores the prior checkpoint date instead of stamping "now")
- `restoreHistoryId` = the response's `history_id` (the route deletes that history row instead of inserting a new one, and skips the normal history insert)

This fully reverses a reconciliation: the stored balance, the checkpoint date, and the audit trail all return to their pre-reconcile state. (Edge case: undoing a reconciliation on an account that has *never* had a balance set has no `previous_balance_set_at` to restore — the undo falls back to stamping "now" instead. Not a practical concern since reconciliation targets already-tracked accounts.)

## Database

```sql
-- account_balances: one row per account
balance           numeric    -- the baseline value
balance_set_at    timestamptz -- when the baseline was set (used for delta calculation)

-- account_balance_history: change_type constraint
CHECK (change_type IN ('initial_set','manual_set','manual_adjustment',
  'transfer_in','transfer_out','transfer_updated','transfer_deleted',
  'transaction_expense','transaction_income','transaction_deleted',
  'split_bill_paid','split_bill_received','draft_confirmed','correction',
  'transaction','transfer','split_bill','future_payment','debt_settled',
  'statement_import','auto_reconciliation'))
```

## Key Files

- `src/app/api/accounts/[id]/balance/route.ts` — balance GET/POST with dynamic calculation
- `src/app/api/accounts/[id]/balance/history/route.ts` — history API
- `src/components/expense/AccountBalance.tsx` — balance display with offline support
- `src/components/expense/BalanceHistoryDrawer.tsx` — 3-tab history UI
- `src/features/balance/` — React Query hooks

## Gotchas

- Balance GET is read-only. Do not write `account_balances` or `account_balance_history` from a refresh path.
- The former auto-reconciliation path is disabled because hidden write-back on app load/refresh can compound bad balances.
- Deleting or editing a transaction automatically updates the balance (via query invalidation)
- When offline, `AccountBalance` reads from localStorage cache and shows a grey gradient + "Cached" label
- Setting balance creates a clean baseline — all transactions before `balance_set_at::date` are ignored
- `account_balance_history` filters out individual transaction entries by default; pass `?exclude_transactions=false` to include them (debug mode)
