---
created: 2026-05-30
type: overview
module: dashboard
module-type: standalone
status: active
tags:
  - type/overview
  - module/dashboard
related:
  - "[[Common Patterns]]"
---

# Dashboard

> **Page:** `src/app/dashboard/` | **Components:** `src/components/dashboard/`
> **Type:** Standalone (main tab — default landing after login)
> **Route:** `/dashboard`

## Overview

The default landing surface after login. Renders KPI cards (balance, spend, income), a recent-transactions list, and mini-charts. Section order is user-configurable via Preferences. On web it renders `WebDashboard.tsx`; on mobile `EnhancedMobileDashboard.tsx`. The dashboard is a **renderer, not an owner** — it reads from every standalone module but owns no DB tables of its own.

**2026-06-19:** Mobile Dashboard also owns the `Insights` tab for Schedule/reminder stats, rendered through `src/components/reminder/RemindersInsightsPage.tsx`. This tab moved out of `/reminders` so `/reminders` can focus on day planning and flexible assignment.

**2026-06-25:** Review V2 Monthly tab keeps Income and Expense as monthly distributions, but Savings now reads the current balance from the `Our Savings` saving account via `analytics.accounts`. This is intentionally a flat amount until savings transfers are modeled month-by-month. The same tab also includes `Expected Savings` (`Income - Expense`) and per-metric visibility toggles for Income, Expense, Savings, and Expected Savings.

## Architecture

Data is prefetched eagerly via `EagerDataPrefetch.tsx` on first paint so the dashboard feels instant. Prefetch logic lives in `src/lib/prefetch/prefetchDashboard.ts` (moved from `src/features/dashboard/`). Transactions are fetched for the current billing cycle (custom month start from Preferences) via `useDashboardTransactions`. Theme changes trigger a full query invalidation — the dashboard refetches everything.

Section order (`useSectionOrder`) is persisted in user preferences and drives the order of widget cards on mobile. `EditableWidgetGrid` handles the drag-to-reorder UI on mobile.

## Database

No owned tables. Reads from `transactions`, `accounts`, `account_balances`, `user_preferences` (for section order + custom month start).

## Key Files

- `src/app/dashboard/page.tsx` — RSC entry, passes server data down
- `src/app/dashboard/DashboardClientPage.tsx` — client root, tab context
- `src/components/dashboard/EnhancedMobileDashboard.tsx` — mobile layout
- `src/components/reminder/RemindersInsightsPage.tsx` - mobile Dashboard `Insights` tab (schedule/reminder stats)
- `src/components/web/WebDashboard.tsx` — desktop layout
- `src/components/dashboard/TransactionsTable.tsx` — recent transactions list
- `src/components/dashboard/CategoryDetailView.tsx` — category drill-down
- `src/components/dashboard/SwipeableTransactionItem.tsx` — swipe-to-delete row
- `src/components/expense/EditableWidgetGrid.tsx` — section reorder UI
- `src/features/preferences/useSectionOrder.ts` — section order hook
- `src/lib/prefetch/prefetchDashboard.ts` — hover/navigation prefetch
- `src/components/EagerDataPrefetch.tsx` — startup prefetch root

## Gotchas

- Adding heavy fetches to `EagerDataPrefetch.tsx` tanks TTI — be conservative.
- Theme changes invalidate all queries; the dashboard will fully refetch.
- Prefetch uses `src/lib/prefetch/` (not `src/features/dashboard/` — that dir was deleted).

## See Also

- [[Common Patterns]]
- [[Preferences]] — section order, custom month start
- [[Transactions]] — `useDashboardTransactions`
