# Drafts

**Type:** Standalone
**Vault doc:** `ERA Notes/02 - Standalone Modules/Drafts/`

## What it does

A partial expense (e.g. amount only, no category) is saved as a draft instead of dropped. The drafts drawer + dialog lets you resume them. A badge surfaces the count.

## Files at a glance

- **Components**:
  - `src/components/expense/DraftsDrawer.tsx`
  - `src/components/expense/DraftTransactionsDialog.tsx`
  - `src/components/expense/DraftTransactionsBadge.tsx`
- **Hooks**: `src/features/drafts/useDrafts.ts`
- **API routes**: `src/app/api/drafts/`
- **DB tables**: `transaction_drafts` (or similar — confirm in `schema.sql`)

## Common edit scenarios

- **"Change the drafts list UI"** → `DraftsDrawer.tsx`, `DraftTransactionsDialog.tsx`.
- **"Edit which fields constitute a 'complete' transaction"** → `useDrafts.ts` + draft-promotion logic.

## Connected modules

- **Transactions** — a promoted draft becomes a transaction.
