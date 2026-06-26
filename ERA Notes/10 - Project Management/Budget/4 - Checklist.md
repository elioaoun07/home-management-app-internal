---
created: 2026-06-20
updated: 2026-06-26
type: checklist
status: active
owner: Elio
tags:
  - pm/checklist
  - scope/module
  - module/budget
---

# Budget - 4 - Checklist

> **Command Center:** [\_index](_index.md) - [1 - Feature State](<1 - Feature State.md>) - [2 - Vision & Roadmap](<2 - Vision & Roadmap.md>) - [3 - Action Plan](<3 - Action Plan.md>) - [4 - Checklist](<4 - Checklist.md>)
>
> **What this file is:** the single flat, checkable surface for Budget - every actionable item as one checkbox, grouped Now / Next / Later. Done items stay as the record (Hard Rule #25 - no orphan fixes).
>
> **Legend:** Sev blocker / friction / annoyance / parked. Effort S/M/H.

---

## Now - Foundation (protect the money)

- [x] **N1** `balance-utils` unit tests - expense/income/saving directions, reconcile. Done 2026-06-10 (`src/lib/balance-utils.test.ts`, 28 tests green). _(blocker - M)_
- [x] **N2** Recurring next-due unit tests. Done 2026-06-10 (`src/lib/recurring.test.ts`). Still open: confirm -> transaction flow + exceptions - see [FABLED Gaps G1](<FABLED/2 - FABLED - Gaps & Missing.md>). _(blocker - M)_
- [x] **N3** Reconciliation checkpoint - "last checked" date + 7-day stale glow + one-tap match/correct in `BalanceHistoryDrawer` (with Undo). Done 2026-06-16. See [Balance System - Reconciliation Checkpoint](<../../02 - Standalone Modules/Accounts & Balance/Balance System.md>). _(friction - M)_
- [ ] **N4** Remove/guard `analytics/debug` - a debug endpoint should not be in the prod surface. _(annoyance - S)_

## Next - First Enhancement

- [x] **X0** Salary -> Wallet URL/NFC refill shortcut - `/expense?transfer=salary-wallet` opens the mobile expense form with an amount prompt, resolves current-user Salary/Wallet account IDs by name, and creates a self transfer through `useCreateTransfer()`. Done 2026-06-25; shell-mounted prompt follow-up fixed 2026-06-26. _(friction - S)_
- [x] **X0b** Public/shared accounts - account creation and edit mode support private/public visibility; public visible accounts are collaborative for active household partners across balances, transactions, categories, and transfers. Done 2026-06-26. _(friction - M)_
- [ ] **X1** Allocation workflow across accounts - make Salary -> Wallet funding, available Wallet balance, recurring commitments, and category envelopes feel like one intentional flow. _(friction - M)_
- [ ] **X2** Merchant-map -> manual entry - reuse the statement-import merchant -> category map to auto-suggest on manual entry (gap 1b). _(annoyance - S-M)_

## Later - Connect Outward

- [ ] **L1** Recurring -> Schedule due-date unify - coordinate with [Schedule - 4 - Checklist](<../Schedule/4 - Checklist.md>). _(friction - H)_
- [ ] **L2** Cashflow forecast -> ERA briefing - project balances forward; scope after core tests exist. _(friction - H)_
- [ ] **L3** 50/30/20 budgeting templates + Dashboard V2 widgets. _(annoyance - M)_
  - [x] Monthly Savings reads the flat `Our Savings` account balance instead of monthly saving-account transaction totals. Done 2026-06-25.
  - [x] Monthly adds `Expected Savings` (`Income - Expense`) and visibility toggles for Income / Expense / Savings / Expected Savings. Done 2026-06-25.
  - [x] **Review v3** experimental dashboard view (`ReviewV3Dashboard`) — simplified surface with an **Insight** tab (monthly spend stacked by category + runtime outlier toggle reusing `detectTransactionAnomalies`, total-budget reference line, Income/Expense/Expected-Savings pie) plus reused Monthly/Categories tabs. Web view toggle in `WebDashboard.tsx`; to be merged back into v2 once validated. Done 2026-06-26.
- [ ] **L4** Allocation auto-suggest from recurring commitments. Fold into X1 if it becomes part of the allocation workflow redesign. _(annoyance - M)_
- [ ] **L5** Future Purchase -> Transaction auto-complete on linked purchase. _(annoyance - S-M)_
- [ ] **L6** Debt -> Schedule auto-reminder on collection date. _(annoyance - S-M)_
- [ ] **L7** Split the expense + recurring mega-forms into testable units (only when next touched). _(parked - M)_
- [ ] **L8** Statement Import -> Inventory/Catalogue price pre-fill. _(parked - M)_

---

## Definition Of Done - This Period

- [x] **D1** `balance-utils` has unit coverage; expense/income/saving directions verified; `pnpm test` green.
- [ ] **D2** Recurring next-due + auto-post (confirm -> transaction) covered by tests.
- [ ] **D3** `analytics/debug` removed or guarded.
- [ ] **D4** [1 - Feature State](<1 - Feature State.md>) updated to drop the "untested" notes this work closes.
