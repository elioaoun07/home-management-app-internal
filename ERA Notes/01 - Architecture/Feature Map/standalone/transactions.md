# Transactions (Expense form)

**Type:** Standalone
**Routes:** `/expense`, `/quick-expense`, `/qr/expense`
**Vault doc:** `ERA Notes/02 - Standalone Modules/Transactions/`

## What it does

The expense form is the precision tool for logging a spend. Pick an account → pick a category/subcategory → enter amount + description + optional tags → save. Supports voice entry, templates, split-bill, and a receipt sheet. Drafts are saved when input is incomplete and surfaced in the Drafts drawer.

## Files at a glance

- **Page entry**: `src/app/expense/page.tsx`, `src/app/expense/ExpenseClientWrapper.tsx`, `src/app/expense/layout.tsx`
- **Quick variant**: `src/app/quick-expense/page.tsx`
- **QR-flow variant**: `src/app/qr/expense/`
- **Mobile form (main UI)**: `src/components/expense/MobileExpenseForm.tsx`
- **Desktop form**: `src/components/expense/ExpenseForm.tsx`
- **Form context (state)**: `src/components/expense/ExpenseFormContext.tsx`
- **Pieces of the form**:
  - `src/components/expense/AmountInput.tsx`
  - `src/components/expense/DescriptionField.tsx`
  - `src/components/expense/AccountSelect.tsx`
  - `src/components/expense/AccountBalance.tsx`
  - `src/components/expense/CategoryGrid.tsx`
  - `src/components/expense/SubcategoryGrid.tsx`
  - `src/components/expense/ExpenseTagsBar.tsx` / `ExpenseTagsBarWrapper.tsx`
  - `src/components/expense/CalculatorDialog.tsx`
  - `src/components/expense/AddExpenseButton.tsx`
  - `src/components/expense/VoiceEntryButton.tsx`
- **Dialogs / drawers launched from the form**:
  - `src/components/expense/NewAccountDrawer.tsx`
  - `src/components/expense/NewCategoryDrawer.tsx`, `NewSubcategoryDrawer.tsx`, `AddCategoryDialog.tsx`
  - `src/components/expense/TemplateDialog.tsx`, `TemplateDrawer.tsx`, `LaunchTemplateDialog.tsx`, `TemplateQuickEntryButton.tsx`
  - `src/components/expense/SplitBillModal.tsx`, `SplitBillHandler.tsx`
  - `src/components/expense/TransferDialog.tsx`
  - `src/components/expense/ReceiptSheet.tsx`
  - `src/components/expense/DraftsDrawer.tsx`, `DraftTransactionsDialog.tsx`, `DraftTransactionsBadge.tsx`
  - `src/components/expense/BalanceHistoryDrawer.tsx`, `OfflinePendingDrawer.tsx`, `DebtsDrawer.tsx`, `FuturePaymentsDrawer.tsx`, `DebtSettlementModal.tsx`
  - `src/components/expense/CategoryManagerDialog.tsx`
- **Hooks (data + mutations)**:
  - `src/features/transactions/useDashboardTransactions.ts`
  - `src/features/transactions/useSplitBill.ts`
- **API routes**:
  - `src/app/api/transactions/route.ts` (list + create)
  - `src/app/api/transactions/[id]/route.ts` (update + delete)
- **DB tables**: `transactions`, `transfers`
- **Type**: `src/types/transaction.ts` (or similar — confirm in repo)

## Common edit scenarios

- **"Change the expense form layout on mobile"** → `src/components/expense/MobileExpenseForm.tsx` is the layout root. Per-field edits → the matching component above.
- **"Add a new field to the expense form"** →
  1. Add the input in `MobileExpenseForm.tsx` (or `ExpenseForm.tsx` for desktop).
  2. Add the state in `ExpenseFormContext.tsx`.
  3. Update the API contract in `src/app/api/transactions/route.ts` (zod schema at top of file).
  4. Add the column in `migrations/schema.sql` and write the SQL to apply in Supabase.
  5. Update the TS type for transactions.
- **"Change category grid behavior / icons"** → `src/components/expense/CategoryGrid.tsx`, `SubcategoryGrid.tsx`. Category data hooks: `src/features/categories/useCategoriesQuery.ts`.
- **"Edit voice entry behavior"** → `src/components/expense/VoiceEntryButton.tsx` + the AI assistant module ([../junction/ai-assistant.md](../junction/ai-assistant.md)) for the actual STT/intent flow.
- **"Edit split-bill math"** → `src/features/transactions/useSplitBill.ts`, UI in `SplitBillModal.tsx`.
- **"Drafts drawer"** → `src/components/expense/DraftsDrawer.tsx` + `src/features/drafts/useDrafts.ts`.
- **"Merchant-map category auto-suggest"** → both the Category and Subcategory steps in `MobileExpenseForm.tsx` render the same `MerchantNoteInput` ("What's this for?") directly under the step header, bound to the transaction `description`. Typed text matches against `useMerchantMappings({ household: true })` (`src/hooks/useMerchantMappings.ts` — includes the partner's mappings) via `matchMerchantMapping()` (`src/lib/merchantMatch.ts`); the suggested **category card glows** (`.suggest-glow` in `globals.css`, color-matched via `--suggest-glow-color` CSS vars) and, after the category is picked, the mapped **subcategory card glows** too. Matching is **cross-user and cross-account**: the mapping's category/subcategory is resolved against the currently selected account's list via `resolveCategoryRef()` (id → slug → name); if nothing resolves there, there's simply no glow — no message. Purely visual guidance — nothing auto-selects; the user still taps the card. `selectCategory()` is the shared tap handler (vibrate → skip empty subcategory step → submit).

## Gotchas

- Use `type="text"` + `inputMode="decimal"` for amount input — not `type="number"` (Hard Rule).
- `safeFetch()` with default 3 s timeout is fine for create/update — but voice-entry endpoints that call AI must pass `timeoutMs: 60_000`.
- LBP amounts are stored in **thousands** per user preference — see `src/features/preferences/useLbpSettings.ts`.
- Custom month start day (1–31) affects which month a transaction belongs to — see `startOfCustomMonth(date, monthStartDay)` in `src/lib/utils/date.ts`.

## Connected modules

- **Categories** ([./categories.md](./categories.md)) — picks from `user_categories`.
- **Accounts & Balance** ([./accounts-and-balance.md](./accounts-and-balance.md)) — debits the chosen account.
- **Drafts** ([./drafts.md](./drafts.md)) — partial entries land in drafts.
- **Hub Chat → Message Actions** ([../junction/message-actions.md](../junction/message-actions.md)) — chat messages can spawn a transaction.
- **Statement Import** ([./statement-import.md](./statement-import.md)) — bulk-creates transactions.
