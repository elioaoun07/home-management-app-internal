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
  - [x] **Review v3** experimental dashboard view (`ReviewV3Dashboard`) — simplified surface with an **Insight** tab (monthly spend stacked by category + runtime outlier toggle, total-budget reference line, Income/Expense/Expected-Savings pie) plus reused Monthly/Categories tabs. Web view toggle in `WebDashboard.tsx`; to be merged back into v2 once validated. Done 2026-06-26.
  - [x] **Robust outlier detection** for the Insight tab — replaced category-only mean/σ (`detectTransactionAnomalies`, skipped any category with <4 transactions) with `detectTransactionOutliers`: median/MAD "spike" detection for established categories (immune to the outlier inflating its own baseline) plus a "rare" branch judging intermittent/novel categories (one-off trips, occasional gifts) against overall household spending, excluding fixed recurring bills from that global baseline so rent/mortgage can't mask them. Reviewable list added (grouped by month, spike/rare badges) alongside the existing hide-toggle. Unit-tested (`anomalyDetection.test.ts`). Done 2026-06-26.
  - [x] **Bimodal-category handling** — fixed a false-positive class where a category has two legitimate spending modes (e.g. Groceries: everyday snacks + a periodic full shopping run). Single category-wide median/MAD was treating the recurring "big" mode as a spike against the "small" one forever, no matter how often it repeated. Now splits a category at its single largest proportional gap (`splitByLargestGap`, default 2.5× threshold) when the resulting "high" side has itself recurred enough (same established-category bar: ≥4 transactions, ≥3 distinct months) to be trusted as normal — each transaction then scores against its own mode's median/MAD instead of the mixed whole. A true outlier within the big-shop mode itself (e.g. an exceptionally expensive trip) still flags correctly. Done 2026-06-26.
  - [x] **Bimodal-split bug fix**: a near-zero transaction (e.g. a $0.01 rounding/refund row) produced a spuriously huge *ratio* gap purely from being close to zero, hijacking the split point and merging the real "big shop" mode in with every snack-tier purchase — reported live with real "Food" data (recurring $130/$156/$170 grocery runs still flagging as spikes after the bimodal fix above). Fixed by adding `bimodalMinAnchor` (default $1): amounts below it can no longer anchor a split. Regression test added using the actual reported amounts. Done 2026-06-26.
  - [x] **Recurring-merchant protection** — the amount-gap split still wasn't enough: real "Food" data has more than two price tiers (snacks, casual dining, grocery runs) blending together with no single clean gap, so the same SPINNEYS grocery runs kept flagging even after the anchor fix. Added an independent signal: within an established category, any description that recurs ≥4 times across ≥3 distinct months (same established-category bar) is treated as a recognized real-world pattern and never flagged as a spike, regardless of where its amount falls in the distribution — works even when the amount-based split fails to find a boundary at all. Regression test deliberately defeats the gap-split (filler transactions bridge the gap below the 2.5× threshold) to prove this signal works independently. Done 2026-06-26.
  - [x] **Multi-tier / rhythmic outlier overhaul** — addressed three live complaints: (1) Food still flagged a normal grocery run as a spike in a "random" month (August) — root-caused as the two-mode split failing on 3+ price tiers and scoring big runs against the snack-dominated median; fixed by computing the in-category spike z-score in **log space** (`logStats`), which tolerates multiplicative tiers (snack→delivery→grocery) without needing a perfect gap split. (2) Bank ref-code/channel noise split one merchant into many singletons so the recurrence exemption never fired — added `normalizeMerchant` (strips trailing store/ref codes, embedded `invoice #…` tokens, and channel words like "Online Purchase"/"POS Purchase"/"Bill Payment") so Toters/Spinneys/Alfa variants collapse; protection gate lowered to ≥3 occurrences across ≥2 months. (3) Rhythmic-but-sparse categories (monthly tithing, quarterly dues) were mislabeled "rare" purely on size — added date-based cadence detection (`isRecurringCadence`, monthly+ periods for the whole-category check) that promotes a steady rhythm to recurring and never flags it. Also wired the user-confirmed **`recurring_payments`** table into the detector (`recurringHints` param, sourced via `useRecurringPayments` in `ReviewV3Dashboard`, matched by category/merchant + ±40% amount band) as an authoritative suppression. Suppression is silent (no new UI). 8 new unit tests; all 25 green. Done 2026-06-26.
  - [x] **Insight interactive focus & drill-down** — the Insight tab is now explorable rather than static. Tapping a stacked bar **segment** focuses that **month + category** (toggles off on re-tap); tapping a **legend chip** focuses a **category** across all 12 months; the pie **month dropdown** focuses a **month**. Focus dims the non-selected bars and the pie follows the focused month. A contextual **focus panel** (`src/components/dashboard-v2/widgets/InsightFocusPanel.tsx`) appears as a right-hand column (stacks below on mobile, rendered only while focused) with removable [month][category] chips and four adaptive views: **month** (total, rank-of-12, vs prev / 12-mo avg, income/expected-savings, budget-left for current month, top categories with tap-to-drill, that month's outliers), **category** (12-mo total + % share, avg/active month, latest-vs-avg trend, peak month, category budget, clickable 12-mo sparkline, flagged outliers, largest transactions), and **month×category** (amount vs the category's own average, share of month / of year, full transaction list with outlier badges). Reuses the existing `WidgetCard` filter badge + reset for the clear-focus affordance. Done 2026-06-26.
  - [x] **Two-step zoom interaction** — click a stacked bar segment → first zoom zooms to the month as a whole (no category filter yet, panel shows month-level breakdown); second click on a specific segment in the focused month → filter by that category; clicking the same segment again → clear all focus and return to full 12-month view. Clicking a different month switches to that month. Legend chips still focus a category-only across all months. Done 2026-06-26.
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
