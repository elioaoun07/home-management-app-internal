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
  - `src/components/statement-import/CategoryPickerSheet.tsx` — `CategoryPicker` alone in a bare Drawer, for a single row outside a merchant group
  - `src/components/statement-import/CategoryChip.tsx` — the compact category chip, tap opens `CategoryPickerSheet`
  - `src/components/statement-import/TransferRowCard.tsx` — recognized movement rows (person transfer, cash withdrawal, exchange): `Transfer | Transaction`, account direction, description/category, and staged detail
  - `src/components/statement-import/ScrollableTabs.tsx` — the scrolling pill tab bar (top nav + both sub-navs), with mask-faded edges
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
- `transfers` (`statement_hash` — the same identity backstop, so a re-import can't create the movement twice)
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
- Top filters are **Review / Existing / Skipped / Ready**. Review has **Transactions / Transfers** sub-navigation, so every unresolved money row is reviewed in one place without mixing the two ledger shapes. Existing has **Imported / Matched**: Imported is exact `statement_hash` identity (including cross-account and soft-deleted transaction hits); Matched is fuzzy/legacy/manual-log evidence. This replaces the ambiguous Imported vs Logged split (BUD-58).
- **Every movement row asks `Transfer` or `Transaction`**. The canonical choice is `RowDecision.action_kind`; the legacy `treat_as_transfer` field remains readable for resumable sessions. A row stays in its current review section while edited, then appears in Ready when complete — switching type never makes it vanish.
- **Deciding a row STAGES it — the row does not disappear.** It keeps its place and grows a green `✓ Send · Debit Card - NEO → Whish · Racha Touma` line saying exactly what Save will do. The owner asked for this after selections felt like commitments.
- **`Ready` is the final stage and a cross-cutting view.** Money / Matches / Memory are collapsible. Each action shows its read-only account and category/subcategory or transfer endpoints; tapping it returns to the source row, opens the relevant editor when needed, scrolls it into view and briefly highlights it. Exact Imported rows never produce a maintenance-only Ready action; only a genuinely stale fuzzy fingerprint can stage an internal re-key (BUD-58).
- **The tab bar scrolls instead of truncating** — six tabs whose counts are the information ("Skipped 85") do not fit equal `flex-1` slots on a phone. `ScrollableTabs` gives each its natural width and fades scrollable edges with a CSS mask (not an overlay — `tc.pillBg` is translucent per theme). Scroll listener is native + `passive`.
- **The Transfers tab has a People / Cash / Exchange sub-nav** (BUD-51, third section BUD-54), shown only when more than one has rows and auto-falling back to one that does. **Exchange** holds own-account currency exchanges (`Own Account Exchange: USD to EUR at 0.852`): no `Transfer | Spent` toggle (an exchange is a move by definition), one data line stating the bank's arithmetic (`200.00 USD → 170.40 EUR @ 0.852`), and a destination picker over the owner's own accounts labelled with their currency. Picking one stages a self transfer whose `to_amount` is the converted figure — the destination's balance moves by 170.40, not 200.00. Only the OUT leg appears here; the IN leg is on Skipped as "Other side of an exchange", because the same bank line is printed on both statements and acting on both would write the movement twice. Both sections render through the same `TransferRowCard` (BUD-52). **People** holds every person-to-person transfer; **Cash** holds ATM/voucher withdrawals. The description input defaults to the memo the owner typed in the bank app ("Transfer to X via Mobile - 'note'" → "note", "… for Voucher No 123 - Car Insurance" → "Car Insurance"), never the raw bank line, which stays read-only beneath.
- **The Skipped tab has This import / Previously skipped / Own moves sub-navigation**. All three tabs remain selectable at count 0 and render `Nothing here.`; the page never auto-switches away from the owner's selection (BUD-58).
- **Every skipped row states WHY it is there** — `skipReason()` reads the REAL classification underneath the skip (`skipped_before` is a flag, not a status) and renders it as one short clause: `Also in Debit Card - NEO`, `Transfer · SALIM`, `Cash withdrawal`, `Already imported`, `Matches a logged transaction`, `Several possible matches`, `Own-account move`, `Set aside`. Before this the tab said only "skipped" and the owner had to re-derive the reason for every row.
- **Restore is DURABLE (`RowDecision.restored`, BUD-53)** — it used to be encoded as `resolution: "undecided"`, which the owner's very next action overwrites (picking a category or a transfer destination sets `"create"`). `getBucket()` then saw `skipped_before && resolution !== "undecided"` and threw the row straight back onto Skipped, so **answering a restored row made it vanish from the tab it was answered on, at the moment it was answered**. `restored` is now its own flag that survives further decisions; `isRestored()` still honours the legacy `undecided` encoding so a session already in IndexedDB resumes correctly, and `updateDecision` clears the flag on an explicit skip so no stale `unskip` action is emitted.
- **Restore routes a row to wherever it actually belongs**, with a toast naming the destination ("Restored to Review" / "Restored to Transfers" / …) and an Undo. Before BUD-51, `skipped_before` was itself a status that replaced the row's real classification, so a restored row had nowhere to go and stayed stuck on Skipped while the Save count silently grew.
- **The account picker has no default and the target is always on screen.** Upload stays disabled until an account is chosen (it previously pre-selected the default account, so the target was chosen by not noticing), and the review header reads "Importing into <account>" with a **Change** control that discards and restarts — the fingerprints are built from that account and the file is not retained, so it cannot be switched in place.
- **Per-row account override** lives in `GroupSheet`'s row controls: a select defaulting to "<account> (statement)". Used for rows that belong elsewhere — bank fees on a salary statement. Changing it clears the row's category (categories are account-scoped) and does **not** change the row's fingerprint.
- **The Transfers tab holds EVERY person-to-person transfer**, household or not — gating visibility on the household name match meant a missed match hid the row in the merchant list. The match now only pre-selects the household path. Each card toggles **Partner / Not partner**; a partner transfer is outlined and titled in the PARTNER's identity colour (Hard Rule #14 — colour follows the person, so it is blue when the owner's theme is pink and pink otherwise).
- **Transfers is Review's second-level tab**, beside Transactions. Both need a decision before Save, while Existing/Skipped are evidence and Ready is the receipt preview (BUD-58).
- **Review has a sub-navigation** (Categorize / Other account / Maybe logged) — segments render only when non-empty and it auto-falls back to Categorize when the active one empties. Review was stacking three unrelated jobs into one scroll.
- **`OtherAccountSheet`** — tapping an "other account" card opens both sides (bank row vs. the twin transaction) with dates, amounts and untruncated descriptions. The card itself carries title, amount, date and "Also in <Account>".
- **"Already in another account"** section at the top of Review: rows whose exact date + amount + direction match a transaction in a different account. Two actions — *Same one — skip it* / *Different — import it*. Never auto-resolved.
- **The merchant list card shows a date caption** (single date, or an “earliest – latest” range for a group spanning several days) — previously the date was visible only after opening GroupSheet. `ReviewGroupCard` takes a pre-computed `dateLabel`; the page derives it from the group's own rows (`groupDateLabel()`).
- **The merchant card shows category › subcategory as a parent/child chip pair**, resolved only when every row in the group agrees (same rule as the parent chip). Re-tapping the category a row already has now PRESERVES its subcategory — `pickCategory` used to clear it unconditionally, so opening Food to check a learned Spinneys mapping silently dropped Groceries.
- **GroupSheet row controls show the amount per row** beside the bank line, matching the per-row date. Previously only the group total was visible.
- **Renaming a row does not weaken dedupe.** `RowDecision.description` overrides only what is *stored*; `statement_hash` is computed once at parse time from the raw bank text and is never recomputed, so a row saved as "ALFA Prepaid Phone" still matches the bank's "PrePaid" on the next import.
- **Mobile shape:** the review list is merchants, not rows. One tap opens `GroupSheet`; one tap on a category tile assigns the merchant and closes the sheet (a subcategory step appears only when the category has subcategories). Per-row work hides behind the sheet's "N rows" disclosure. Rows the matcher only *probably* matched are hoisted into a "Might already be logged" section above the list — categorizing one would double-write money that is already logged; answering "not a match" drops it into the merchant groups.
- **Sticky surfaces use `tc.bgPage`, never `var(--theme-bg)`** — that variable is not set on this page (ThemeContext writes it on the document element only after a theme apply), so the filter header and commit bar rendered transparent and page content scrolled through them.
