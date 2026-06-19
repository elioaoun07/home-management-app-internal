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
