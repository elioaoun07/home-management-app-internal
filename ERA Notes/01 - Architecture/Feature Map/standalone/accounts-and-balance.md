# Accounts & Balance

**Type:** Standalone
**Routes:** part of `/expense`, `/dashboard` (no dedicated `/accounts` route)
**Vault doc:** `ERA Notes/02 - Standalone Modules/Accounts & Balance/`

## What it does

Accounts are financial buckets: `expense`, `income`, `saving`. Each carries a current balance (`account_balances`) and a history (`account_balance_history`). The Balance card on the expense form shows the current account total; the history drawer shows changes over time. A new-account drawer creates accounts in-place from the expense form.

## Files at a glance

- **UI (within expense)**:
  - `src/components/expense/AccountBalance.tsx`
  - `src/components/expense/AccountSelect.tsx`
  - `src/components/expense/NewAccountDrawer.tsx`
  - `src/components/expense/BalanceHistoryDrawer.tsx`
- **Hooks**:
  - `src/features/accounts/hooks.ts`
  - `src/features/balance/hooks.ts`
  - `src/features/balance/archiveHooks.ts`
- **API routes**:
  - `src/app/api/accounts/route.ts` (list / create; household-linking pattern lives here — see Hard Rule #13)
  - `src/app/api/accounts/[id]/route.ts`
- **DB tables**: `accounts`, `account_balances`, `account_balance_history`
- **Balance math**: `src/lib/balance-utils.ts` (account type → balance direction)
- **Cache config**: `BALANCE = 5 min` staleTime in `src/lib/queryConfig.ts`

## Common edit scenarios

- **"Change how an account is created"** → `src/components/expense/NewAccountDrawer.tsx` + `src/app/api/accounts/route.ts` (zod schema).
- **"Edit balance card UI"** → `src/components/expense/AccountBalance.tsx`.
- **"Change account type behavior"** → `src/lib/balance-utils.ts` decides whether a transaction adds or subtracts. CHECK constraints in `migrations/schema.sql` enforce the enum.
- **"History drawer rendering"** → `src/components/expense/BalanceHistoryDrawer.tsx` + `src/features/balance/archiveHooks.ts`.

## Gotchas

- The household-linking pattern (Hard Rule #13) was first written in `src/app/api/accounts/route.ts` — use it as the canonical reference.
- Balance must update via the hook's optimistic mutation; don't read from `transactions` directly.
- Account type (`expense`/`income`/`saving`) affects sign — read `balance-utils.ts` before changing math.

## Connected modules

- **Transactions** ([./transactions.md](./transactions.md)) — the form picks an account.
- **Recurring Payments** ([./recurring-payments.md](./recurring-payments.md)) — auto-debit an account on schedule.
- **Transfers** ([./transfers.md](./transfers.md)) — moves between accounts.
- **Analytics** ([./analytics.md](./analytics.md)) — net worth aggregates account balances.
- **Household Sharing** ([../junction/household-sharing.md](../junction/household-sharing.md)) — partner accounts are visible.
