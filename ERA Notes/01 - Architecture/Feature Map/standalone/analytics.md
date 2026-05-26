# Analytics

**Type:** Standalone
**Vault doc:** `ERA Notes/02 - Standalone Modules/Analytics/`

## What it does

Net-worth tracking, spending breakdowns, mini-charts, and a world map of spend (e.g. by transaction country).

## Files at a glance

- **Components**:
  - `src/components/charts/MiniCharts.tsx`
  - `src/components/charts/WorldMap.tsx`
  - `src/components/charts/InteractiveWorldMap.tsx`
- **Hooks**:
  - `src/features/analytics/useAnalytics.ts`
  - `src/features/analytics/useNetWorth.ts`
- **API routes**: `src/app/api/analytics/`
- **DB tables**: aggregates over `transactions`, `account_balances`, `account_balance_history`

## Common edit scenarios

- **"Edit net worth math"** → `useNetWorth.ts`.
- **"Change a chart"** → matching file in `src/components/charts/`.

## Connected modules

- **Accounts & Balance** — net worth source.
- **Transactions** — spend breakdowns.
- **Dashboard** — embeds charts.
