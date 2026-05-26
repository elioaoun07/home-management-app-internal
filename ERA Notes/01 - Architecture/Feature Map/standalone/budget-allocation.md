# Budget Allocation

**Type:** Standalone
**Vault doc:** `ERA Notes/02 - Standalone Modules/Budget Allocation/`

## What it does

Envelope-style budget allocation. Pre-allocate amounts per category for the current period; the dashboard shows spend-vs-allocated per envelope.

## Files at a glance

- **Components**: `src/components/web/WebBudget.tsx`
- **Hooks**:
  - `src/features/budget/hooks.ts`
  - `src/features/budget/index.ts`
- **API routes**: `src/app/api/budget-allocations/`
- **DB tables**: `budget_allocations` (confirm in `schema.sql`)

## Common edit scenarios

- **"Edit the envelope grid"** → `WebBudget.tsx`.
- **"Change how spend rolls up"** → `src/features/budget/hooks.ts` (joins transactions by category for the current period).

## Gotchas

- The "current period" is the **custom month** (user's preferred start day), not a calendar month. Use `startOfCustomMonth()` in `src/lib/utils/date.ts`.

## Connected modules

- **Categories** — envelopes are per-category.
- **Transactions** — spend rolls up here.
- **Preferences** — custom month start day.
