---
created: 2026-03-23
type: overview
module: accounts
module-type: standalone
tags:
  - type/overview
  - module/accounts
---

# Accounts & Balance

> **Source:** `src/features/accounts/`, `src/features/balance/`
> **API:** `src/app/api/accounts/`
> **DB Tables:** `accounts`, `account_balances`, `account_balance_history`
> **Type:** Standalone

## Docs in This Module

- [[Balance System]]
- [[Income Expense System]]
- [[Account Transfers]]
- [[Default Account]]

## Key Concepts

- Baseline + delta balance model
- Account visibility: accounts are private by default; `is_public=true` makes a visible account shared with the active household partner for viewing, balance edits, transactions, categories, and transfers.
- Account types: `expense`, `income`, `saving` — affect balance direction
- Custom month start day for billing cycles
- **Currency (2026-08-04):** every account has `currency` (ISO 4217, default `USD`) and `exchange_rate` (current USD value of 1 unit of that currency). Account balances stay in the account's own currency — nothing converts a stored balance. Set/edit via `NewAccountDrawer` (create) or the account wiggle-mode's in-card currency action beside the visibility control → `AccountCurrencyDialog` (edit an existing account, e.g. flipping a manually-created trip account to EUR).

## Currency & Exchange Rates

Added to support foreign-currency accounts (e.g. a EUR trip-cash account) without breaking USD-denominated dashboards.

- **Frozen per-transaction rate, not the account's live rate.** `transactions.exchange_rate` is stamped once, at insert (or when a transaction's `account_id` changes), by a `SECURITY DEFINER` DB trigger — `stamp_transaction_exchange_rate()` / `trg_stamp_tx_exchange_rate` (`migrations/2026-08-04_multi-currency.sql`). It copies whatever `accounts.exchange_rate` is *at that moment*. Editing the account's rate later never changes past transactions' frozen rate — a €100 expense logged at 1.09 always shows as $109 on USD dashboards, even after the account rate moves to 1.05.
- **Why a trigger, not app code:** there are 5 independent transaction-insert paths (manual entry, drafts, statement import, debt returns, recurring-payment confirm) via `src/services/transaction.service.ts`, `src/app/api/drafts/`, `src/app/api/statement-import/import/`, `src/app/api/debts/[id]/`, `src/app/api/recurring-payments/[id]/`. A trigger is the single choke point instead of 5 call sites to keep in sync.
- **Conversion at read time:** `toUsd(amount, exchangeRate)` in `src/lib/balance-utils.ts` is the one function that does `amount * (exchangeRate ?? 1)`. Used by `/api/analytics` (server rollups) and `WebDashboard`'s `usdTransactions` memo (client aggregation) — both convert every transaction to its frozen USD equivalent before summing into categories/months. Net worth (`useNetWorth.ts`) instead uses each account's **current** rate, since it reports what the money is worth *today*, not what it cost when spent.
- **NULL rate = USD / pre-migration row.** `toUsd` treats `null`/`undefined` as `1`, so existing data needs no backfill (an optional commented backfill query exists in the migration file if the owner wants historical non-USD rows stamped retroactively).
- Statement import: rows import in the destination account's native currency (no currency field on the import review table — the owner sets the account's rate before importing; the trigger stamps every imported row the same as manual entry).
- **Display symbol + quick-amount chips (2026-08-06):** `src/lib/currency.ts` maps each of the 6 `AccountCurrencyDialog` currency codes to a display symbol (`getCurrencySymbol`) and a set of real banknote denominations (`getQuickAmounts`). Every single-account-scoped `$` in the expense flow keys off `selectedAccount?.currency` (or an explicit `currency` prop threaded down): amount input + quick chips, `AccountBalance`, `BalanceHistoryDrawer`, `FuturePaymentsDrawer`, `TransferDialog`'s from-leg, `ExpenseTagsBar`, and toast descriptions. Cross-account surfaces resolve currency **per row** instead of from the form's selected account: `DraftsDrawer`/`DraftTransactionsDialog` via a `currency` field added to `/api/drafts`' `accounts` join, `OfflinePendingDrawer` via each queued op's own `account_id`. USD-converted surfaces (dashboard, analytics) are untouched and always show `$`, since they already display `toUsd()` totals regardless of account currency. **Not covered** (currency is genuinely ambiguous, not just unwired): `DebtsDrawer`/`DebtSettlementModal` — debts have no `currency` column, derived from an arbitrary origin transaction; `SplitBillModal`/`SplitBillHandler` — the payer picks their own account, which can differ from the partner's original currency; `NfcWalletTransferPrompt` (NFC Tags module) — same from/to ambiguity as `TransferDialog`.

## See Also

- [[Common Patterns]] — optimistic mutations
- [[Transfers Overview|Transfers]]
