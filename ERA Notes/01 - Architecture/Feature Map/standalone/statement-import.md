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
  - `CategoryPicker.tsx` — the 3-across category + subcategory tile grid **with inline creation** (uses `refetchQueries`, the only thing that beats the persisted 1 h category cache).
  - `CategoryPickerSheet.tsx` — `CategoryPicker` alone in a bare Drawer, for a single row that isn't part of a merchant group. Used by `TransferRowCard`.
  - `CategoryChip.tsx` — the compact category/subcategory chip display (factored out of `ReviewGroupCard`'s markup), used by `TransferRowCard`; tapping it opens `CategoryPickerSheet`.
  - `MatchedRowCard.tsx` — statement row vs. its matched transaction, drift badges, accept/detach, ambiguous picker.
  - `ReviewGroupCard.tsx` — merchant group; group category is a default, per-row overrides win; date edit + bulk shift; detach/skip.
  - `OtherAccountSheet.tsx` — detail for one `other_account` row: the bank's side and the twin transaction's side, each with its own date, amount and full (untruncated) wording, plus Skip / Import.
  - `ReviewStepper.tsx` — opt-in one-row-at-a-time drawer over the undecided queue (`undecidedRows()`); rename + category grid + skip, Back/Next. The queue is snapshot on open so answering a row does not renumber the steps.
  - `TransferRowCard.tsx` — **every** Transfers-tab row: person transfer, cash withdrawal AND own-account currency exchange (they ask the same question, so there is one component). One `Transfer | Spent` toggle: Transfer shows `<statement account> → <destination Select>` (partner accounts for a person row, the owner's own for cash); Spent shows a description input defaulting to the memo plus a `CategoryChip`. A decided row grows a green `✓ verb · detail` staged line and stays put.
  - `ScrollableTabs.tsx` — the pill tab bar for the top nav and both sub-navs. Scrolls instead of truncating; edges fade via a CSS **mask** (background-agnostic, unlike an overlay) only on a side that can be scrolled toward. `scrollEdges()` / `edgeMask()` are exported pure functions with unit tests.
  - `MerchantMappingsManager.tsx` — manage learned mappings (still a dialog in Settings).
  - `ImportHistory.tsx` — past imports on the upload screen; expands to the per-row ledger and holds the batch **Revert**.
- **Pure logic**:
  - `src/lib/statement-reconcile.ts` — the matcher (window, tiers, scoring, one-to-one). Tested.
  - `src/lib/statement-revert.ts` — the reverse planner: ledger + live rows → what to write back and how the balance moves. Tested.
  - `src/features/statement-import/sessionModel.ts` — buckets, category resolution, decision → commit actions, plus `skipReason()`/`skippedGroupCounts()` (the Skipped tab's three populations) and `actionLane()`/`stagedNetAmount()` (the Ready tab's lanes and headline). Tested.
  - `src/lib/statementImportSession.ts` — IndexedDB persistence of an in-progress review.
  - `src/lib/bank-statement-parser.ts` — parsing + hash v2 + `convertToUITransactions`.
- **Hooks**: `src/features/statement-import/hooks.ts` — `useParseStatement`, `useReconcileStatement`, `useCommitStatement`, `useStatementImports` / `useStatementImportDetail` / `useRevertStatementImport`, mapping writes. Read hook for mappings lives at `src/hooks/useMerchantMappings.ts` (outside the feature dir so Transactions can reuse it without a cross-standalone import).
- **API routes** (`src/app/api/statement-import/`):
  - `parse/` — requires `account_id`; returns rows + `statement_id` + currency info.
  - `reconcile/` — classifies rows against existing transactions.
  - `commit/` — create / stamp / confirm_draft, per-row results, one balance write per account. Opens the import record and writes the revert ledger BEFORE touching money.
  - `imports/` — `GET` history · `GET [id]` one import + its ledger + live drift · `POST [id]/revert` walk the whole batch back.
- **DB**: `transactions` (`statement_hash`, `is_imported`, `is_debt_return`), `transfers` (`statement_hash`), `merchant_mappings`, `statement_imports`, `statement_import_entries`. Indexes: `transactions_statement_hash_uniq`, `transfers_statement_hash_uniq`, `idx_transfers_statement_hash`, `idx_transactions_account_date`, `statement_import_entries_import_row_uniq`.

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
- **A plain transaction delete does NOT free the hash.** `DELETE /api/transactions/[id]` only sets `deleted_at`, and the unique index is partial on `statement_hash IS NOT NULL`, so the deleted row still occupies the fingerprint. Re-importing then reports `skipped_duplicate` and the transactions never come back — reconcile also filters `deleted_at IS NULL`, so it does not even warn. **Batch Revert is the only correct way to undo an import.**
- **Transfers are fingerprinted too, and the check runs in pass 1** (BUD-56). `transfers.statement_hash` + `transfers_statement_hash_uniq` on `(user_id, statement_hash)` over **live** rows only. The reconcile route passes live transfers in as `ImportedTransferRef[]`; a hit returns `{status:"already_imported", reason:"transfer_hash", transfer_id}` — a separate `RowStatus` arm with **no fuzzy tier and no re-key path**, because a transfer has no `bank_description` to backfill and no older formula to upgrade. If you add another write target outside `transactions`, it needs the same treatment: without it a re-import re-offers the row as new and the owner moves both balances twice.
- **`buildCommitActions` must bail on `reason:"transfer_hash"` BEFORE the withdrawal / exchange branches.** Those branches key off the `withdrawal` / `exchange` FLAGS, and pass 5 stamps flags onto every row regardless of status — so an already-imported transfer still carries them, and a stale `transfer_to_account_id` in the session would re-stage the movement. The unique index is the backstop (23505 → `skipped_duplicate`), not the guard.
- **A transfer's hash is freed by soft-delete, not by nulling the column** — the opposite of `transactions`. Deliberate: a transfer can be removed by an import revert **or** from the Transfers module, and only an index-level `deleted_at IS NULL` covers both. Do not "fix" this by adding a hash-nulling step to revert; that would re-open the Transfers-module path.
- **`isTransferDescription()` is own-account ONLY.** Person-to-person transfers go through `isPersonTransfer()` and ARE imported. If you widen either, widen the parser's `isOwnAccountDescription()` to match (a test pins them to the same strings).
- **`suggestAccountForRow()` is a correctness gate, not a convenience.** A money-out row cannot be represented on an income/saving account at all, so it is re-homed to an expense account by default. `buildCommitActions(session, accounts)` and `resolveRowAccount(row, session, accounts)` both take the account list for this; passing an empty list silently disables the suggestion.
- **Own-account / FX rows must never be written as money** — `isTransferDescription()` in `statement-reconcile.ts` owns the rule; `getTransactionType()` in the parser mirrors it. If you widen one, widen both (a test pins them to the same strings).
- **Fingerprint changes must be self-healing, not just versioned.** A row recognised by the FUZZY duplicate tier while carrying a different stored hash emits a `rekey` commit action: `statement_hash` is overwritten with the current formula's value, balance-neutral, guarded on the previous hash, ledgered and revertible. This is what stops a formula change orphaning rows the way v1->v2 did. `rekey` requires `migrations/2026-08-24_statement-import-rekey-action.sql` (widens the `statement_import_entries.action` CHECK) — **without it the ledger insert fails and the whole commit returns 503**.
- **The probable-duplicate tier is one-to-one** — it claims each transaction at most once (`claimedAsDuplicate`), closest posting date first. Before that, `find()` handed the same transaction to every matching row, so a second identical charge was dropped as a duplicate when it was genuinely new.
- **`bank_description` (migration `2026-08-24_transactions-bank-description.sql`) must be run BEFORE the code deploys** — the commit route writes the column, so shipping first breaks every import on an unknown column. Written by create, stamp and rekey; always `row.description` (raw), never the rename.
- **An already-imported row is re-written for TWO reasons, not one** — a stale fingerprint *or* a missing `bank_description`. Checking only the hash meant a statement whose fingerprints were all current produced zero actions, so Save sat disabled at "0 rows" and the bank wording could never be backfilled. The commit route's no-op check must test both fields for the same reason.
- **Standing skips** live in `statement_skipped_rows` (migration `2026-08-24_statement-skipped-rows.sql`), keyed by `statement_hash`, RLS via denormalized `user_id` (Hard Rule #20 — never an EXISTS subquery; reconcile hits this on every import). Actions `skip` / `unskip` in the commit route; no ledger entry, because nothing was written to `transactions`.
- **Renaming a row never touches its hash** — `RowDecision.description` only changes what is stored. Do not recompute `statement_hash` from the edited text.
- **The hash is keyed to the STATEMENT's account, never the row's destination.** `RowDecision.account_id` re-targets where a row is *created* (bank fees on a salary statement → the expenses account) while `resolveRowAccount()` leaves the fingerprint alone. Because of that, **reconcile must look hashes up across every account**, not just the statement's — otherwise a re-targeted row reads as brand new on every future import. Two queries: a date-window sweep over all accounts, plus an unbounded `statement_hash IN (…)` lookup.
- **Changing the target account mid-review is not possible by design** — the fingerprints are already built from it and the uploaded file is not retained, so the header's "Change" discards the session and returns to upload. Do not add an in-place account switcher without re-parsing.
- **The account picker has no default on purpose.** It used to pre-select `is_default`, so the target could be chosen by not noticing it. Do not reintroduce a default.
- **Overriding a row's account clears its category** — `user_categories.account_id` is NOT NULL and the commit route rejects a category from another account.
- The page hides `MobileNav` (it has its own commit bar) and is registered in `STANDALONE_APPS` for its header — both are route lists that must be updated together if the route is renamed.
- Category lists are cached 1 h with `refetchOnMount: false` **and persisted to localStorage** — after creating a category, `refetchQueries` (or `refreshCategoryCaches`) is required; `invalidateQueries` alone will not refresh an unmounted consumer.
- **`skipped_before`, `memo`, `withdrawal` are FLAGS on `RowClassification`, not statuses** (BUD-51) — stamped in a final pass over every row's REAL classification. Never gate matching logic on `classification.status === "skipped_before"` for a NEW reconcile result; that status only exists for a legacy session already in IndexedDB. Check `classification.skipped_before` instead.
- **`Bucket` is five values now** (`matched | imported | review | transfers | skipped`), not four. Every `person_transfer` and unmatched withdrawal routes to `transfers`, never `review` — do not hoist `person_transfer` rows onto a UI tab AND count them in `counts.review` at the same time; that overlap is exactly the BUD-51 bug.
- **`countOpen()` (Save button / resume banner "N left") ≠ `countUndecided()` (stepper).** The stepper is deliberately narrower — Categorize-list rows only. Use `countOpen` for "is there anything left to decide", `countUndecided`/`undecidedRows` for "what does the one-at-a-time stepper walk".
- **A withdrawal's `normalized_key` is a reference number, not a merchant** — `buildCommitActions` suppresses `learn_mapping` when `classification.withdrawal` is set. Do not remove that guard; it would write one throwaway merchant mapping per withdrawal.
- **Partner destinations come from `useHouseholdAccounts()`, NEVER `useAccounts()`.** The latter returns only the partner's `is_public` accounts, so a private-account partner yields an empty dropdown with no error — it looks exactly like an RLS problem and is not. Identify the partner explicitly (`useHouseholdPartner()`), never by subtracting `useMyAccounts()` from the household list. `TransferDialog` is the working precedent.
- **Label partner accounts with the partner's name.** Both household members use identical account names ("Debit Card - NEO", "Salary", "Wallet"), so a bare name reads as the owner's own.
- **Display names: `/api/household`, not `profiles`.** `useHouseholdMembers()` reads the `profiles` mirror client-side and that table can be empty (BUD-47), degrading every name to an email prefix. `useHouseholdPartner()` goes through `/api/household`, which resolves from `auth.users` via `supabaseAdmin()`.
- **`Ready` is not a bucket.** It renders `buildCommitActions()` through `describeCommitAction()`, split by `actionLane()` into money / match / memory and headed by `stagedNetAmount()`. Never let it compute what Save will do independently, or the two will drift.
- **Deciding stages, it does not commit.** A decided row must keep its place and say what will happen. Do not filter answered rows out of their tab. The subtle way this breaks (BUD-53): **never encode a durable state as a `resolution` value.** `resolution` is overwritten by every subsequent decision, so `Restore = resolution:"undecided"` meant the next category/destination pick set `"create"`, `getBucket()` re-applied `skipped_before`, and the row vanished from the tab it was answered on. Restore is `RowDecision.restored`; read it via `isRestored()`.
- **Category names must resolve across EVERY account this screen can target, not just the statement's.** Categories are account-scoped and `suggestAccountForRow()` redirects rows off the statement account (money-OUT on income/saving → default expense; person money-IN on expense → income). A per-account category map cannot name a category picked in a redirected row's grid, so the chip silently fell back to "Choose category" and the owner's pick looked discarded. `page.tsx` merges statement + income + expense category lists into one `categoryOf()`.
- **Every money regex in `bank-statement-parser.ts` needs `(?!\d)`** (BUD-55). A statement amount has exactly two decimals; a three-decimal FX rate in the description ("at 0.852") otherwise matches as `0.85` and becomes the row's amount. Use the named constants `MONEY_ANYWHERE` / `TRAILING_AMOUNTS` / `MONEY_OR_DASH` rather than writing a fourth pattern. The first two carry **no `g` flag** on purpose — `.test()`/`.search()` with a global regex advance `lastIndex` and skip every other line.
- **A wrapped description is rejoined only while the continuation line has no money on it.** That is what makes the FX row work: the line holding just the rate is description, the line holding `200.00 - 1,909.46` is the numbers. Loosening the money token breaks the rejoin, not just the amount.
- **An FX rate is only meaningful against the currency it was quoted for.** `classifyOwnExchange()` returns the pair the bank printed (`USD → EUR at 0.852`); `buildCommitActions` sets `to_amount` **only** when the chosen destination account's currency equals `to_currency`, and rounds once via `convertAtRate()`. Never multiply a destination balance by a rate without checking the pair — and never round more than once (money-rules Invariant 8).
- **Only the OUT leg of an own-account exchange is actionable.** The same bank line prints on both statements and the two rows hash differently (account is part of the fingerprint), so acting on both writes the movement twice. `direction` comes from the MONEY OUT / MONEY IN column, never the wording. Same rule as "only the SENDER records a household transfer".
- **A row's category picker must be opened on the account the row will actually be CREATED in** (`resolveRowAccount()`), never on `session.account_id` by default — otherwise the commit route rejects the pair as a category↔account mismatch.
- **Turbopack dev can serve a chunk your browser has cached as `immutable`** (BUD-51, BUD-49 hit a different cause of the same symptom) — server-side code is current (verify with `curl` or `fetch(url,{cache:"no-store"})`), but a normal reload/navigate keeps rendering old client JS. Fix: hard reload (Ctrl+Shift+R), not `pnpm dev:clean` (that fixes a stale SERVER cache, a different failure mode).

## Connected modules

- **Transactions** — creates/stamps them; also reads the merchant map for manual-entry auto-suggest.
- **Categories** — mappings and rows target a category; inline creation writes via `/api/user-categories`.
- **Drafts** — a matched draft is confirmed rather than duplicated.
- **Accounts & Balance** — one `adjustAccountBalance("statement_import")` per account per commit.
