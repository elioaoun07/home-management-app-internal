# Debts

**Type:** Standalone
**Routes:** modal surfaces in `/expense`
**Vault doc:** `ERA Notes/02 - Standalone Modules/Debts/`

## What it does

Track money owed to or by another person. Open the drawer from the expense form; settle a debt via a settlement modal that posts an offsetting transaction.

## Files at a glance

- **Components**:
  - `src/components/expense/DebtsDrawer.tsx`
  - `src/components/expense/DebtSettlementModal.tsx`
- **Hooks + types**:
  - `src/features/debts/useDebts.ts`
  - `src/features/debts/types.ts`
- **API routes**: `src/app/api/debts/`
- **DB tables**: `debts` (confirm in `schema.sql`)

## Common edit scenarios

- **"Edit the debts drawer"** → `DebtsDrawer.tsx`.
- **"Change settlement math"** → `useDebts.ts` + `DebtSettlementModal.tsx`. Settlements typically post a transaction; coordinate with Transactions module.

## Connected modules

- **Transactions** — settling posts a transaction.
- **Accounts & Balance** — affected by settlements.
