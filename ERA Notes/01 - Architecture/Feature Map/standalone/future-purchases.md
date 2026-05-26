# Future Purchases

**Type:** Standalone
**Routes:** dashboards / modules embed it
**Vault doc:** `ERA Notes/02 - Standalone Modules/Future Purchases/`

## What it does

Wishlist of upcoming purchases — things you want to buy later, with optional estimated cost.

## Files at a glance

- **Components**: `src/components/web/WebFuturePurchases.tsx`
- **Hooks**:
  - `src/features/future-purchases/hooks.ts`
  - `src/features/future-purchases/index.ts`
- **API routes**: `src/app/api/future-purchases/`
- **DB tables**: `future_purchases` (confirm in `schema.sql`)

## Common edit scenarios

- **"Edit the wishlist UI"** → `WebFuturePurchases.tsx`.
- **"Add a priority field"** → DB column → API zod → hooks → UI.

## Connected modules

- **Transactions** — promoting a future purchase posts a transaction.
- **Budget Allocation** — future purchase costs roll into envelope projections.
