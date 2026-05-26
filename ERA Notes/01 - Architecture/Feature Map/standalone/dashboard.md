# Dashboard

**Type:** Standalone (main tab)
**Route:** `/dashboard`

## What it does

The default landing surface after login. Shows KPI cards, recent transactions, mini-charts. Section order is user-configurable via Preferences.

## Files at a glance

- **Page entry**:
  - `src/app/dashboard/page.tsx`
  - `src/app/dashboard/DashboardClientWrapper.tsx`
  - `src/app/dashboard/DashboardClientPage.tsx`
  - `src/app/dashboard/layout.tsx`
- **Components**:
  - `src/components/dashboard/EnhancedMobileDashboard.tsx`
  - `src/components/dashboard/SwipeableTransactionItem.tsx`
  - `src/components/dashboard/TransactionDetailModal.tsx`
  - `src/components/dashboard/CategoryDetailView.tsx`
  - `src/components/dashboard/TransactionsTable.tsx`
  - `src/components/web/WebDashboard.tsx`
  - `src/components/web/WebTabletMissionControl.tsx`
- **Prefetch**: `src/features/dashboard/prefetchDashboard.ts`
- **Eager prefetch root**: `src/components/EagerDataPrefetch.tsx`
- **Editable widget grid**: `src/components/expense/EditableWidgetGrid.tsx`
- **API routes**: aggregates over multiple endpoints; check `src/app/api/`

## Common edit scenarios

- **"Edit the dashboard sections / order"** → `EnhancedMobileDashboard.tsx` + section order in `src/features/preferences/useSectionOrder.ts`.
- **"Change the recent transactions list on dashboard"** → `TransactionsTable.tsx` + `useDashboardTransactions.ts` in transactions feature.
- **"Edit category drill-down view"** → `CategoryDetailView.tsx`.

## Gotchas

- Prefetch happens via `EagerDataPrefetch.tsx` on first paint — adding heavy fetches here will tank TTI.
- Theme changes invalidate all queries; the dashboard will refetch.

## Connected modules

- Reads from every standalone module — treat it as a renderer, not an owner.
