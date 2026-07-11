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
  - `src/features/statement-import/hooks.ts` — re-exports `useMerchantMappings` from the shared hook below; owns the write mutations (`useSaveMerchantMapping`, `useDeleteMerchantMapping`, `useParseStatement`, `useImportTransactions`).
  - `src/features/statement-import/index.ts`
  - `src/hooks/useMerchantMappings.ts` — the shared **read** hook for `merchant_mappings`, lives outside this feature dir so Transactions (also standalone) can reuse the data without a cross-standalone import. Query key: `qk.merchantMappings()`.
- **Shared lib**: `src/lib/merchantMatch.ts` — pure `matchMerchantMapping(text, mappings)` (exact-then-substring) plus `resolveCategoryRef(ref, categories)` (id → slug → name fallback) for resolving a mapping's category against a **different user's or account's** category list. Used by Transactions' manual-entry auto-suggest (see [../standalone/transactions.md](../standalone/transactions.md)). Not currently used by the statement parser itself, which keeps its own matching in `src/lib/bank-statement-parser.ts` (also includes the built-in `LEBANESE_MERCHANTS` fallback list, which manual entry does not use).
- **API behavior**: `GET /api/merchant-mappings` returns the user's own mappings by default; `?household=true` also includes the active partner's mappings (verified via `getActiveHouseholdPartnerId`, read via `supabaseAdmin` — same pattern as `/api/categories`), enriched with `category_slug/name` + `subcategory_slug/name` for cross-account resolution, own mappings winning pattern duplicates. POST/DELETE remain own-rows-only.
- **API routes**:
  - `src/app/api/statement-import/`
  - `src/app/api/merchant-mappings/`
- **DB tables**: `merchant_mappings`, bulk inserts into `transactions`

## Common edit scenarios

- **"Change parser behavior"** → server logic in `src/app/api/statement-import/route.ts`. Pass `timeoutMs` ≥ 60_000 from the client side (parsing can take time).
- **"Edit merchant mapping UI"** → `MerchantMappingsManager.tsx`.
- **"Change how merchant mappings are matched/reused elsewhere"** → the statement parser's own matcher lives in `bank-statement-parser.ts` (`findMerchantMapping`, unexported); the shared cross-module matcher used by manual entry is `src/lib/merchantMatch.ts`. They are intentionally separate — don't merge them without re-verifying both call sites (statement import is money-adjacent/bulk-creates transactions).

## Gotchas

- Parser endpoints are slow — Hard Rule #6 timeout default of 3 s would falsely flag the app offline. Always pass `timeoutMs`.

## Connected modules

- **Transactions** — bulk-creates them; also reads the merchant map (via the shared hook) to auto-suggest a category on manual entry (gap 1b, done 2026-07-11).
- **Categories** — merchant mappings target a category.
