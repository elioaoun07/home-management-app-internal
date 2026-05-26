# Statement Import

**Type:** Standalone
**Vault doc:** `ERA Notes/02 - Standalone Modules/Statement Import/`

## What it does

Upload a bank statement (CSV/PDF), preview parsed rows, and bulk-create transactions. Merchant mappings remember "this merchant string → this category" so the next import is faster.

## Files at a glance

- **Components**:
  - `src/components/statement-import/StatementImportDialog.tsx`
  - `src/components/statement-import/MerchantMappingsManager.tsx`
  - `src/components/statement-import/index.ts`
- **Hooks**:
  - `src/features/statement-import/hooks.ts`
  - `src/features/statement-import/index.ts`
- **API routes**:
  - `src/app/api/statement-import/`
  - `src/app/api/merchant-mappings/`
- **DB tables**: `merchant_mappings`, bulk inserts into `transactions`

## Common edit scenarios

- **"Change parser behavior"** → server logic in `src/app/api/statement-import/route.ts`. Pass `timeoutMs` ≥ 60_000 from the client side (parsing can take time).
- **"Edit merchant mapping UI"** → `MerchantMappingsManager.tsx`.

## Gotchas

- Parser endpoints are slow — Hard Rule #6 timeout default of 3 s would falsely flag the app offline. Always pass `timeoutMs`.

## Connected modules

- **Transactions** — bulk-creates them.
- **Categories** — merchant mappings target a category.
