# Statement Import

**Type:** Standalone
**Route:** `/statement-import` (full page; launched from Settings → Statement Import)
**Vault doc:** `ERA Notes/02 - Standalone Modules/Statement Import/`

## What it does

Uploads a bank statement (PDF/CSV) and **reconciles** it against transactions the
user already logged — matched rows need no work, only the remainder is
categorized. Merchant mappings remember "this merchant → this category" for next
time. See the vault guide for why it is an audit rather than an entry path.

## Files at a glance

- **Page**: `src/app/statement-import/page.tsx` — upload → working → review → receipt; owns the session state and the commit bar.
- **Components** (`src/components/statement-import/`):
  - `CategoryPicker.tsx` — category + subcategory selects **with inline creation** (uses `refetchQueries`, the only thing that beats the persisted 1 h category cache).
  - `MatchedRowCard.tsx` — statement row vs. its matched transaction, drift badges, accept/detach, ambiguous picker.
  - `ReviewGroupCard.tsx` — merchant group; group category is a default, per-row overrides win; date edit + bulk shift; detach/skip.
  - `MerchantMappingsManager.tsx` — manage learned mappings (still a dialog in Settings).
  - `ImportHistory.tsx` — past imports on the upload screen; expands to the per-row ledger and holds the batch **Revert**.
- **Pure logic**:
  - `src/lib/statement-reconcile.ts` — the matcher (window, tiers, scoring, one-to-one). Tested.
  - `src/lib/statement-revert.ts` — the reverse planner: ledger + live rows → what to write back and how the balance moves. Tested.
  - `src/features/statement-import/sessionModel.ts` — buckets, category resolution, decision → commit actions. Tested.
  - `src/lib/statementImportSession.ts` — IndexedDB persistence of an in-progress review.
  - `src/lib/bank-statement-parser.ts` — parsing + hash v2 + `convertToUITransactions`.
- **Hooks**: `src/features/statement-import/hooks.ts` — `useParseStatement`, `useReconcileStatement`, `useCommitStatement`, `useStatementImports` / `useStatementImportDetail` / `useRevertStatementImport`, mapping writes. Read hook for mappings lives at `src/hooks/useMerchantMappings.ts` (outside the feature dir so Transactions can reuse it without a cross-standalone import).
- **API routes** (`src/app/api/statement-import/`):
  - `parse/` — requires `account_id`; returns rows + `statement_id` + currency info.
  - `reconcile/` — classifies rows against existing transactions.
  - `commit/` — create / stamp / confirm_draft, per-row results, one balance write per account. Opens the import record and writes the revert ledger BEFORE touching money.
  - `imports/` — `GET` history · `GET [id]` one import + its ledger + live drift · `POST [id]/revert` walk the whole batch back.
- **DB**: `transactions` (`statement_hash`, `is_imported`, `is_debt_return`), `merchant_mappings`, `statement_imports`, `statement_import_entries`. Indexes: `transactions_statement_hash_uniq`, `idx_transactions_account_date`, `statement_import_entries_import_row_uniq`.

## Common edit scenarios

- **"Change how rows are matched"** → `src/lib/statement-reconcile.ts` (+ its test). Do not scatter matching rules into the route.
- **"Change what gets written"** → `commit/route.ts`; money invariants are pinned by `commit/route.test.ts` — update the worked example if you change them.
- **"Change grouping / per-row behavior"** → `sessionModel.ts` for the rules, `ReviewGroupCard.tsx` for the UI.
- **"Parser behavior / new bank format"** → `bank-statement-parser.ts`. Client must pass `timeoutMs` (parse is slow).
- **"Undo an import / rollback rules"** → `src/lib/statement-revert.ts` (+ its test). The route only does IO; the rules — including "never clobber a newer human edit" — live in the planner.

## Gotchas

- Parse/reconcile/commit are slow calls — always pass `timeoutMs` to `safeFetch` (Hard Rule #6); the hooks already do (120 s / 30 s / 60 s).
- **Stamping a matched row must stay balance-neutral.** The money was counted when the user logged it.
- Changing the hash formula orphans old hashes; the reconciler's probable-duplicate tier is what makes that safe.
- **The account is part of the dedupe key** — hash v2 is `v2|account|date|desc|out|in`, and creates always land in the session account. A merchant mapping must never redirect a row to another account, or the fingerprint would guard a different account than the transaction it describes.
- **A commit refuses to move money it cannot undo** — if the `statement_imports` record or the `statement_import_entries` ledger cannot be written, the route returns 503 and no balance moves. Run `migrations/2026-08-19_statement-import-rollback.sql` before using the feature.
- **Reverting a create frees its hash** (soft delete + `statement_hash = null`), so the statement can be re-imported. Keeping the hash would make every row read as "already imported" forever.
- The page hides `MobileNav` (it has its own commit bar) and is registered in `STANDALONE_APPS` for its header — both are route lists that must be updated together if the route is renamed.
- Category lists are cached 1 h with `refetchOnMount: false` **and persisted to localStorage** — after creating a category, `refetchQueries` (or `refreshCategoryCaches`) is required; `invalidateQueries` alone will not refresh an unmounted consumer.

## Connected modules

- **Transactions** — creates/stamps them; also reads the merchant map for manual-entry auto-suggest.
- **Categories** — mappings and rows target a category; inline creation writes via `/api/user-categories`.
- **Drafts** — a matched draft is confirmed rather than duplicated.
- **Accounts & Balance** — one `adjustAccountBalance("statement_import")` per account per commit.
