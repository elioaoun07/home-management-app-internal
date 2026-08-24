---
slug: statement-import
title: Statement Import
category: standalone-page
route: /statement-import
type: page
parent: null
children: []
status: active
tags:
  - budget
  - reconciliation
---

# Statement Import

> Full-page workbench that checks a bank statement against transactions you already logged — matched rows need no work, only the leftovers get categorized.

## Files

- **Page**: `src/app/statement-import/page.tsx`
- **Sub-components**:
  - `src/components/statement-import/ReviewGroupCard.tsx` — one merchant as a single tap target: merchant, total, category chip or "Choose category" pill
  - `src/components/statement-import/GroupSheet.tsx` — the drawer where a merchant is decided: category grid, plus per-row category/date/**rename**/skip and the date shift behind a collapsed disclosure
  - `src/components/statement-import/ReviewStepper.tsx` — opt-in one-row-at-a-time drawer over the undecided queue (rename + category grid + skip, with Back/Next); offered from the Review tab once more than 2 rows still owe a category
  - `src/components/statement-import/MatchedRowCard.tsx` — statement row vs. matched transaction, drift badges, ambiguous picker
  - `src/components/statement-import/CategoryPicker.tsx` — 3-across category/subcategory tile grid with inline creation (same shape as the expense form)
  - `src/components/statement-import/MerchantMappingsManager.tsx` — learned mappings (dialog, still in Settings)
  - `src/components/statement-import/ImportHistory.tsx` — past imports, expandable to the per-row ledger, with the batch revert

## Hooks

- `src/features/statement-import/hooks.ts` — `useParseStatement`, `useReconcileStatement`, `useCommitStatement`, `useStatementImports`, `useStatementImportDetail`, `useRevertStatementImport`, `useSaveMerchantMapping`, `useDeleteMerchantMapping`
- `src/features/statement-import/sessionModel.ts` — pure bucket/decision logic (not a hook, but the page's brain)
- `src/hooks/useMerchantMappings.ts` — shared read hook

## API routes

- `POST /api/statement-import/parse` → `src/app/api/statement-import/parse/route.ts`
- `POST /api/statement-import/reconcile` → `src/app/api/statement-import/reconcile/route.ts`
- `POST /api/statement-import/commit` → `src/app/api/statement-import/commit/route.ts`
- `GET /api/statement-import/imports` → `src/app/api/statement-import/imports/route.ts`
- `GET /api/statement-import/imports/[id]` → `src/app/api/statement-import/imports/[id]/route.ts`
- `POST /api/statement-import/imports/[id]/revert` → `src/app/api/statement-import/imports/[id]/revert/route.ts`
- `GET|POST|DELETE /api/merchant-mappings` → `src/app/api/merchant-mappings/route.ts`

## DB tables

- `transactions` (`statement_hash`, `is_imported`, `is_debt_return`)
- `merchant_mappings`
- `statement_imports` (one revertible record per commit)
- `statement_import_entries` (per-row ledger: previous + applied state)

## How to get here

- Settings ⚙ → **Statement Import** → *Import Statement*
- Direct URL: `/statement-import`

## What it links to

- Back / Home → `/expense`
- Merchant Mappings dialog (from the Settings panel, not from this page)
- Reverted transactions → Recycle Bin (`/recycle-bin`)

## Related vault doc

- `ERA Notes/02 - Standalone Modules/Statement Import/`

## Screenshots

- _(none captured)_

## Notes

- **Layout:** registered in `STANDALONE_APPS` (`ConditionalHeader`) for its own title, and in `MobileNav`'s `standaloneRoutes` so the bottom nav hides — the page has its own sticky commit bar. Page uses `pt-16` for the fixed `h-16` header and `pb-32` to clear the commit bar; the bar respects `env(safe-area-inset-bottom)`.
- **Session persistence:** review state lives in IndexedDB (`statement-import-sessions`), saved after every change and resumable from a banner on the upload screen. Discard offers Undo.
- **Categories:** the pickers create categories inline and `refetchQueries` afterwards — `invalidateQueries` does not refresh this list (1 h staleTime + `refetchOnMount: false` + localStorage-persisted).
- **Currency:** amounts render in the target account's currency; a mismatch banner appears only when the statement explicitly labels a different currency.
- Filters (**Review / Imported / Logged / Skipped**) are a full-width segmented control over a progress bar, and mirror the reconciliation buckets. **Imported and Logged are deliberately separate tabs**: "Imported" is a fingerprint hit (machine-certain, unactionable, rendered as a compact date-grouped receipt) while "Logged" is the matcher's judgement that a bank row is one of your manual entries (needs an eye, rendered as `MatchedRowCard` with a labelled *Bank* vs *You* wording comparison). They shared one "Matched" tab until 2026-08-24, which buried the handful of guesses inside a pile of certainties.
- **The account picker has no default and the target is always on screen.** Upload stays disabled until an account is chosen (it previously pre-selected the default account, so the target was chosen by not noticing), and the review header reads "Importing into <account>" with a **Change** control that discards and restarts — the fingerprints are built from that account and the file is not retained, so it cannot be switched in place.
- **Per-row account override** lives in `GroupSheet`'s row controls: a select defaulting to "<account> (statement)". Used for rows that belong elsewhere — bank fees on a salary statement. Changing it clears the row's category (categories are account-scoped) and does **not** change the row's fingerprint.
- **Review has a sub-navigation** (Categorize / Other account / Maybe logged) — segments render only when non-empty and it auto-falls back to Categorize when the active one empties. Review was stacking three unrelated jobs into one scroll.
- **`OtherAccountSheet`** — tapping an "other account" card opens both sides (bank row vs. the twin transaction) with dates, amounts and untruncated descriptions. The card itself carries title, amount, date and "Also in <Account>".
- **"Already in another account"** section at the top of Review: rows whose exact date + amount + direction match a transaction in a different account. Two actions — *Same one — skip it* / *Different — import it*. Never auto-resolved.
- **The merchant list card shows a date caption** (single date, or an “earliest – latest” range for a group spanning several days) — previously the date was visible only after opening GroupSheet. `ReviewGroupCard` takes a pre-computed `dateLabel`; the page derives it from the group's own rows (`groupDateLabel()`).
- **The merchant card shows category › subcategory as a parent/child chip pair**, resolved only when every row in the group agrees (same rule as the parent chip). Re-tapping the category a row already has now PRESERVES its subcategory — `pickCategory` used to clear it unconditionally, so opening Food to check a learned Spinneys mapping silently dropped Groceries.
- **GroupSheet row controls show the amount per row** beside the bank line, matching the per-row date. Previously only the group total was visible.
- **Renaming a row does not weaken dedupe.** `RowDecision.description` overrides only what is *stored*; `statement_hash` is computed once at parse time from the raw bank text and is never recomputed, so a row saved as "ALFA Prepaid Phone" still matches the bank's "PrePaid" on the next import.
- **Mobile shape:** the review list is merchants, not rows. One tap opens `GroupSheet`; one tap on a category tile assigns the merchant and closes the sheet (a subcategory step appears only when the category has subcategories). Per-row work hides behind the sheet's "N rows" disclosure. Rows the matcher only *probably* matched are hoisted into a "Might already be logged" section above the list — categorizing one would double-write money that is already logged; answering "not a match" drops it into the merchant groups.
- **Sticky surfaces use `tc.bgPage`, never `var(--theme-bg)`** — that variable is not set on this page (ThemeContext writes it on the document element only after a theme apply), so the filter header and commit bar rendered transparent and page content scrolled through them.
