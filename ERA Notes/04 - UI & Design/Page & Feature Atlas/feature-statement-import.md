---
slug: feature-statement-import
title: Feature · Statement Import
category: feature
route: n/a
type: feature
parent: null
children: []
status: active
tags:
  - feature-module
---

# Feature · Statement Import

> Standalone feature module behind the `/statement-import` page: parse → reconcile → commit. Hosts the hooks and the pure session model. Not directly routable.

## Files

- **Module dir**: `src/features/statement-import/`
  - `hooks.ts` — parse / reconcile / commit mutations + merchant-mapping writes
  - `sessionModel.ts` — pure: buckets, category resolution, decision → commit actions (tested)
- **Pure logic outside the module dir** (shared / server-safe):
  - `src/lib/statement-reconcile.ts` — the matcher (tested)
  - `src/lib/statement-revert.ts` — the reverse planner: ledger + live rows → per-row updates and balance deltas (tested)
  - `src/lib/statementImportSession.ts` — IndexedDB session persistence
  - `src/lib/bank-statement-parser.ts` — parsing + statement hash v2

## Hooks

- `useParseStatement`, `useReconcileStatement`, `useCommitStatement`, `useStatementImports`, `useStatementImportDetail`, `useRevertStatementImport`, `useSaveMerchantMapping`, `useDeleteMerchantMapping` — `src/features/statement-import/hooks.ts`
- `useMerchantMappings` — `src/hooks/useMerchantMappings.ts` (shared read hook, lives outside the feature dir so Transactions can use it)

## API routes

- `POST /api/statement-import/parse`
- `POST /api/statement-import/reconcile`
- `POST /api/statement-import/commit`
- `GET /api/statement-import/imports` · `GET /api/statement-import/imports/[id]` · `POST /api/statement-import/imports/[id]/revert`

## DB tables

- `transactions` (`statement_hash`, `is_imported`, `is_debt_return`), `merchant_mappings`, `statement_imports`

## How to get here

- Rendered by `/statement-import` — see [[statement-import]].

## What it links to

- Page: [[statement-import]]
- Settings → Statement Import panel (launcher + Merchant Mappings dialog)

## Related vault doc

- `ERA Notes/02 - Standalone Modules/Statement Import/`

## Screenshots

- n/a

## Notes

- Money-critical: the commit route's invariants (stamping is balance-neutral, credits add back, retries are no-ops) are pinned by `src/app/api/statement-import/commit/route.test.ts`.
