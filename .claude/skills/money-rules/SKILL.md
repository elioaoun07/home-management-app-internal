---
name: money-rules
description: "Financial-correctness invariants for ALL money modules (accounts, transactions, transfers, recurring payments, debts, budget allocation, drafts, analytics, trip budgets). MANDATORY before editing anything that creates, edits, deletes, or displays money amounts or balances. Requires a worked before/after balance example and a test for changed money math."
---

# /money-rules — Money Correctness Invariants

> **Contract:** money bugs are silent — the app keeps working while balances drift. So this skill trades speed for proof: before you edit money logic you must (1) state which invariants below your change touches, (2) write a worked example with concrete numbers proving the before/after balance, and (3) add or update a test for any changed calculation. A money change without a worked example is not reviewable — don't ship it.

Applies to: `src/features/accounts|balance|transactions|transfers|recurring|debts|budget|drafts|analytics/`, `src/app/api/accounts|transactions|transfers|recurring-payments/`, `src/lib/balance.ts`, `src/lib/balance-utils.ts`, trip budgets.

## The balance model (verified against `ERA Notes/.../Balance System.md` + `src/lib/balance.ts`)

Baseline + dynamic delta:

```
Current Balance = Initial Balance ± SUM(transactions WHERE date >= balance_set_at::date)
```

| Account type | Transactions… |
|---|---|
| `expense` | **subtract** from balance |
| `income`, `saving` | **add** to balance |

Two non-obvious rules that exist because of real bugs:
- **Balance math uses the transaction's `date` (when it occurred), never `inserted_at` (when typed)** — otherwise backdated entries corrupt the current balance.
- **Display balance subtracts pending drafts** (`GET /api/accounts/[id]/balance`).

## Invariant 1 — All balance writes go through the choke point

`adjustAccountBalance(accountId, delta, changeType, metadata?)` in `src/lib/balance.ts` is **the only way** stored balances change — every transaction/transfer/split/debt operation calls it. It updates `account_balances.balance` atomically, logs to `account_balance_history`, auto-creates a missing balance row, and short-circuits on `delta === 0`.

- **Never** write `account_balances` or `account_balance_history` directly from feature code.
- `changeType` must be one of the existing `CHECK` taxonomy values (see Balance System doc §Database: `transaction_expense`, `transaction_income`, `transaction_deleted`, `transfer_in`, `transfer_out`, `transfer_updated`, `transfer_deleted`, `split_bill_paid`, `split_bill_received`, `draft_confirmed`, `manual_set`, `manual_adjustment`, `reconciliation`, `statement_import`, …). A new kind of money event ⇒ extend the CHECK constraint via db-migration, don't overload an existing type.
- Every mutation that calls it must have a working **inverse** for the Undo toast (create ⇄ delete with the opposite delta).

## Invariant 2 — Read paths never mutate money

`GET`/refresh/load paths are **read-only**. The former auto-reconciliation-on-load was deliberately disabled because hidden write-backs compound bad balances — do not reintroduce silent balance "fixes" on any read path. Balance repairs are explicit and user-initiated only (see `data-repair` skill).

## Invariant 3 — `balance_set_at` is the reconciliation checkpoint

`balance_set_at` means "when the user last verified the balance against reality." Only the manual `POST /api/accounts/[id]/balance` moves it. `adjustAccountBalance()` updates `balance` + `updated_at` but must **never** touch `balance_set_at` — if your change moves it as a side effect, the checkpoint UI ("Checked X ago") and the baseline-date delta math both break.

## Invariant 4 — Transfers are not income or expense

A transfer moves money between accounts: one `transfer_out`, one `transfer_in`, net household change = 0. Transfers must never appear as spend/income in analytics, category totals, envelopes, or period summaries. When touching transfers, read `ERA Notes/02 - Standalone Modules/Accounts & Balance/Account Transfers.md` and verify every aggregate you touched still excludes them.

## Invariant 5 — No double-counting across linked flows

The dangerous seams, and the rule at each:
- **Recurring payment confirm** creates a transaction; **mark-covered** (`POST /api/recurring-payments/[id]/mark-covered`) reconciles an *existing* transaction by advancing `last_processed_date`/`next_due_date` **without creating new spend**. A payment must land in balances exactly once, whichever path covers it. (Deeper rules: `recurrence-safety` skill.)
- **Draft confirmed** → the draft stops being subtracted from display balance AND the real transaction starts counting — never both.
- **Statement import** rows must not duplicate manually-logged transactions they match.
- Deleting a transaction must reverse exactly the delta it applied (same amount, same account, opposite sign).

## Invariant 6 — Period math uses the custom billing month

Users set a billing-cycle start day (1–31). Any "this month" money aggregation uses `startOfCustomMonth(date, monthStartDay)` from `src/lib/utils/date.ts` — never calendar months. Recurring commitments use the billing period as their grace window (due → missed only when the period closes uncovered).

## Invariant 7 — Currency (LBP) is special-cased

The app is dual-currency (USD/LBP) with a module rule: **LBP in thousands** (Preferences). Before touching any LBP math or display, read `ERA Notes/02 - Standalone Modules/Transactions/LBP Change Feature.md` and `src/features/preferences/useLbpSettings.ts` — do not infer the conversion or storage unit from variable names.

## Invariant 8 — Decimals and rounding

Amounts are DB `numeric`; JS math on them is float. Rules: round only at display time, never accumulate rounding across rows (sum first, round once), and never compare money with `===` after arithmetic — compare rounded values. Any new rounding behavior needs a test with cent-level assertions.

## The proof obligation (do this in your response before editing)

```
WORKED EXAMPLE
Accounts: Wallet (expense) balance 100, set 2026-07-01
Action:   <your change, concrete numbers, incl. dates vs balance_set_at>
Before:   Wallet 100 | history: []
After:    Wallet 87.50 | history: [transaction_expense -12.50]
Undo:     Wallet 100  | history restored
Also unchanged: <the aggregates that must NOT move — e.g. partner's accounts, transfer totals>
```

Then: **any changed calculation gets a test** — canonical home `src/lib/balance.test.ts` (`pnpm vitest run src/lib/balance.test.ts`). Cover: both account-type directions, the date-vs-inserted_at boundary, a custom-month boundary if period math changed, and the Undo inverse.

## Checklist before leaving this skill

- [ ] Invariants touched are named; worked example written with real numbers
- [ ] All balance writes go through `adjustAccountBalance` with a valid `changeType`
- [ ] No mutation on any read path; `balance_set_at` untouched by automatic flows
- [ ] Transfers still excluded from spend/income aggregates you touched
- [ ] Exactly-once accounting across confirm/mark-covered/draft/import seams
- [ ] Custom billing month used for period math; LBP docs read if LBP touched
- [ ] Test added/updated and passing; Undo path verified with the inverse delta
