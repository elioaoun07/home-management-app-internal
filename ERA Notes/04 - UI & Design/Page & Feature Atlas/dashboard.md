---
slug: dashboard
title: Dashboard
category: main-tab
route: /dashboard
type: page
parent: null
children: []
status: active
tags: []
---

# Dashboard

> Default landing surface after login — KPI cards, recent transactions, mini-charts, user-configurable section order.

## Files

- **Page**: `src/app/dashboard/page.tsx`
- **Client root**: `src/app/dashboard/DashboardClientPage.tsx`
- **Wrapper**: `src/app/dashboard/DashboardClientWrapper.tsx`
- **Layout**: `src/app/dashboard/layout.tsx`
- **Sub-components**:
  - `src/components/dashboard/EnhancedMobileDashboard.tsx`
  - `src/components/reminder/RemindersInsightsPage.tsx`
  - `src/components/dashboard/TransactionsTable.tsx`
  - `src/components/dashboard/CategoryDetailView.tsx`
  - `src/components/dashboard/SwipeableTransactionItem.tsx`
  - `src/components/dashboard/TransactionDetailModal.tsx`
  - `src/components/web/WebDashboard.tsx`
  - `src/components/web/WebTabletMissionControl.tsx`
  - `src/components/expense/EditableWidgetGrid.tsx`
  - `src/components/dashboard-v2/ReviewV2Dashboard.tsx` — "Review v2" web view (6 tabs)
  - `src/components/dashboard-v2/ReviewV3Dashboard.tsx` — "Review v3" web view (Insight · Monthly · Categories)
  - `src/components/dashboard-v2/widgets/InsightTabContent.tsx` — v3 Insight tab
  - `src/components/dashboard-v2/widgets/InsightFocusPanel.tsx` — v3 Insight drill-down / focus panel

## Hooks

- `src/features/preferences/useSectionOrder` — section order
- `src/features/transactions/useDashboardTransactions` — current-cycle transactions

## API routes

- Aggregates over multiple endpoints — no dedicated dashboard API. See individual feature routes.

## DB tables

- No owned tables. Reads `transactions`, `accounts`, `account_balances`, `user_preferences`.

## How to get here

- Default redirect after login
- Tap **Home/Dashboard** icon in bottom nav (mobile)
- Direct URL: `/dashboard`

## What it links to

- `/expense` — expense entry
- Transaction detail modal (in-place, no route change)
- Category drill-down (in-place)

## Related vault doc

- `ERA Notes/02 - Standalone Modules/Dashboard/`

## Notes

- Mobile `Insights` tab renders Schedule/reminder stats moved from `/reminders` on 2026-06-19.
- Prefetch on startup via `src/components/EagerDataPrefetch.tsx` and on hover via `src/lib/prefetch/prefetchDashboard.ts`.
- Theme changes invalidate all queries — full refetch on theme switch.
- Section order is drag-configurable via `EditableWidgetGrid`.
- Web dashboard view toggle (`WebDashboard.tsx`) has: Overview · Analytics · Review · Review v2 · **Review v3** (added 2026-06-26). Review v3 is an experimental simplified view — **Insight** (stacked-by-category monthly spend with a runtime outlier toggle, total-budget reference line, and an Income/Expense/Expected-Savings pie), plus **Monthly** and **Categories** tabs that reuse the v2 `MonthlyDistributionTabContent` / `CategoriesV2TabContent`. Intended to be merged back into v2 once validated.
- Insight tab outlier detection (`detectTransactionOutliers` in `src/lib/utils/anomalyDetection.ts`, 2026-06-26) flags two kinds of transactions: in-category **spikes** (median/MAD-based, immune to the outlier skewing its own baseline) and **rare** transactions in intermittent/novel categories judged against overall spending (e.g. a once-a-year gift or a one-off trip) — fixed recurring bills are excluded from that global baseline so they can't mask genuinely rare large expenses. Results back both the existing hide-toggle and a reviewable list (grouped by month, spike/rare badges).
- Categories with two legitimate spending modes (e.g. Groceries: everyday snacks + a periodic full shopping run) are handled via `splitByLargestGap` — the category splits at its single largest proportional gap once the "high" side itself recurs enough to be trusted as normal, so the recurring big-ticket mode scores against its own median/MAD instead of being flagged as a spike against the everyday mode. Near-zero transactions (e.g. a $0.01 rounding/refund row) are excluded from anchoring that split (`bimodalMinAnchor`, default $1) — otherwise their proximity to zero produces a spuriously huge ratio gap that hijacks the split point and merges the real high mode back in with everything below it.
- Some categories have more than two natural price tiers with no single clean amount gap (e.g. Food: snacks + casual dining + grocery runs all blending together) — the amount-based split alone can fail to find any boundary. A second, independent signal covers this: any transaction description that recurs ≥4 times across ≥3 distinct months within an established category is treated as a recognized recurring merchant/pattern and never flagged as a spike, regardless of where its amount falls in the distribution.
- Insight tab is **interactive** (`InsightFocusPanel.tsx`, 2026-06-26). Tapping a stacked bar segment focuses that **month + category**; tapping a legend chip focuses a **category** across all 12 months; the pie month dropdown focuses a **month**. Focus dims non-selected bars (reusing the `WidgetCard` filter badge + reset to clear) and the pie follows the focused month. While focused, a right-hand panel (stacks below on mobile) shows one of four adaptive views with removable [month]/[category] chips: **month** (total, rank-of-12, vs prev / 12-mo avg, income + expected savings, budget-left, top categories with tap-to-drill, that month's outliers), **category** (12-mo total + % share, avg/active month, latest-vs-avg trend, peak month, category budget, clickable 12-mo sparkline, flagged outliers, largest transactions), and **month×category** (amount vs the category's own average, share-of-month / -of-year, full transaction list with outlier badges).
