● The plan covers 9 areas across the expense page:

1. Hard Rule violations — fetch() → safeFetch() across 8 files, missing Undo buttons on toasts
2. Transaction entry — amount input, split bill UX, LBP labeling, calculator, voice entry 3. Wallet/balance display — tap targets, pending indicator clutter, offline badge visibility
3. Offline mode — queue limits, sync indicators, reconnection flow, balance restoration
4. Categories — edit mode reliability, drag conflicts, duplicate hook cleanup
5. Recurring payments — native confirm() → custom drawer, overdue styling (Hard Rule #3)
6. Budget allocation — missing optimistic updates and toasts
7. Analytics — console.log cleanup
8. General mobile UX — safe area insets, haptic feedback iOS compatibility, animation performance

───────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────── Ready to code?

Here is Claude's plan: ╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌ Budget Page / Expense Form — UI/UX Audit & Enhancement Plan

Context

Full audit of the mobile expense page (/expense), covering transaction entry, wallet/balance display, offline mode, categories, recurring payments, and related features. Goal: identify bugs, Hard Rule violations, and UX
improvements.

---

1.  Hard Rule Violations (Bugs — Must Fix)

1A. fetch() → safeFetch() (Hard Rule #8)

All feature hooks use raw fetch() instead of safeFetch(). Without this, mutations have no pre-flight online check, no 3s timeout, and no markOffline() on failure.

Files to fix:

- src/features/categories/hooks.ts (lines 42, 108, 150, 189, 237)
- src/features/categories/useCategoriesQuery.ts (lines ~15, 33)
- src/features/categories/useCategoryManagement.ts (line ~56)
- src/features/recurring/useRecurringPayments.ts (lines 51, 78, 112, 131, 187)
- src/features/budget/hooks.ts (lines ~25, 36, 49)
- src/features/transfers/hooks.ts (lines ~118, 130, 147, 163)
- src/features/drafts/useDrafts.ts (lines ~36, 73, 149, 194)
- src/features/analytics/useAnalytics.ts (line ~133)

Approach: Import safeFetch from @/lib/safeFetch, replace all fetch() calls. safeFetch is a drop-in replacement (same signature + return type).

1B. Missing Undo on Toasts (Hard Rule #1)

Most mutation success/error toasts lack the required Undo button with { duration: 4000, action: { label: "Undo", onClick: () => undoMutation.mutate(...) } }.

Files to fix:

- src/features/recurring/useRecurringPayments.ts — confirm, create, update, delete toasts
- src/features/transfers/hooks.ts — create transfer toast
- src/features/categories/hooks.ts — create, rename, delete toasts (if any shown at UI layer, verify)
- src/features/drafts/useDrafts.ts — confirm draft toast (delete draft already correct)

Note: Some mutations may not show toasts at all — those need toasts added WITH undo. Reference useDeleteDraft as the gold standard pattern.

---

2.  Transaction Entry (MobileExpenseForm)

2A. UX Enhancements

- Amount input auto-focus regression — verify autoFocus works reliably on mobile Safari/Chrome (common PWA issue)
- Step order persistence — useSectionOrder() saves to preferences; verify it survives app restarts
- Split bill + private toggle conflict — private is disabled during split bill (correct), but no tooltip/explanation shown to user why it's disabled
- Debt "Log Debt Only" button — verify it doesn't also create a transaction (dual path logic at line ~830)
- LBP change input UX — the ",000" suffix and "actual $X.XX" computed value could be confusing; consider a clearer label like "LBP amount (in thousands)"

2B. Calculator Dialog

- Verify keyboard shortcuts work on mobile (they won't — keyboard shortcuts are desktop-only, but the dialog may assume keyboard)
- Double-equals to submit — not discoverable; consider adding a tooltip or making "=" button visually distinct after first press

2C. Voice Entry

- VoiceEntryButton creates drafts — verify the drafts page link is discoverable from the expense form
- Speech API availability check — verify graceful fallback when Web Speech API unavailable (Firefox, some Android)

---

3.  Wallet / Account Balance Display

3A. AccountBalance Widget

- Clickable balance → BalanceHistoryDrawer — verify the tap target is large enough on mobile (currently just the number text)
- Edit balance inline — the pencil button opens an inline number input; verify it doesn't overlap other elements on small screens
- Transfer button — verify TransferDialog works for household partner accounts
- Pending indicators clutter — when drafts + offline + future + debts all have counts, the widget becomes very dense; consider collapsing into a single "N pending" summary with expandable detail

3B. Balance History Drawer

- Verify pagination works (infinite scroll)
- Verify getChangeTypeInfo() covers all 13 balance change types with correct icons/labels

3C. Offline Balance Display

- "Cached" badge is very subtle (text-white/25) — may be invisible on some screens; consider slightly more visible styling
- Verify cached balance accuracy after multiple offline transactions (optimistic subtraction accumulation)

---

4.  Offline Mode

4A. Offline Transaction Submission

- Verify offline queue respects 200-operation limit with graceful UX (toast? block submission?)
- Verify 64KB payload limit handling
- Verify cancelCreateDeletePair() works when user adds then undoes a transaction offline
- Verify 24h stale operation cleanup doesn't delete valid queued transactions

4B. OfflinePendingDrawer

- Edit mode only works for transaction creates — verify other operation types show read-only
- Delete operation → balance restoration — verify the cached balance adjustment is correct (adds back the subtracted amount)
- "Clear All" → restores all cached balances — verify correctness with mixed operation types

4C. SyncPill & Indicators

- Verify SyncPill appears above bottom nav correctly with safe area insets
- "Sync failed - Tap to retry" — verify retry actually works and doesn't loop
- Verify Math.max(zustandCount, contextCount) doesn't show stale counts

4D. Reconnection Flow

- Verify auto-reconciliation (POST /api/accounts/reconcile) after coming back online works correctly
- Verify temp ID replacement in cache after sync succeeds
- Verify no duplicate transactions created on flaky connections (queue deduplication)

---

5.  Categories & Subcategories

5A. Edit Mode (Long Press)

- Verify 500ms long-press threshold works reliably on all mobile browsers
- Wiggle animation performance — verify no jank with 20+ categories
- Drag-to-reorder — verify Reorder.Group (Framer Motion) doesn't conflict with scroll
- Hide/unhide 2-step confirmation — verify drawer dismisses properly after action

5B. Category Creation

- NewCategoryDrawer — verify 20-color palette is visible/scrollable on small screens
- Inline subcategory batch creation — verify all created subcategories appear immediately
- Duplicate category name handling — verify 409 conflict response is shown as user-friendly message

5C. Duplicate Hook Pattern

- Two parallel CRUD hook sets exist (hooks.ts vs useCategoryManagement.ts) — verify which is actually used on the expense page and if the other is dead code

---

6.  Recurring Payments

- handleDelete uses native confirm() dialog — should use a custom confirmation drawer consistent with app design
- Confirm payment flow — verify it creates a transaction AND advances next_due_date atomically
- Overdue detection — verify visual treatment (should NOT use red per Hard Rule #3, should use text-white/40)
- Monthly total computation — verify the math for daily30, weekly4.33, yearly/12 is acceptable or if it should use actual month days

---

7.  Budget Allocation

- No optimistic updates on save/delete — causes UI lag; add optimistic mutations
- No success/error toasts — add toasts with Undo buttons
- Underdocumented module — update ERA Notes after changes

---

8.  Analytics (Console.log Cleanup)

- Remove console.log statements at lines 129-130, 140-143 in useAnalytics.ts

---

9.  General Mobile UX

- ExpenseTagsBar positioning — verify it doesn't overlap content or bottom nav on devices with/without gesture bars
- Haptic feedback — navigator.vibrate() is not supported on iOS Safari; verify no errors thrown
- Step transition animations — verify AnimatePresence slide animations are smooth on low-end Android
- Safe area insets — verify env(safe-area-inset-bottom) works in standalone PWA mode on both iOS and Android

---

Verification Plan

1.  Run pnpm typecheck after every batch of changes
2.  Test on mobile viewport (375px width) in Chrome DevTools
3.  Test offline mode by toggling network in DevTools → Application
4.  Verify each toast includes Undo button by triggering the action
5.  Verify safeFetch migration by checking network tab shows 3s timeout behavior
6.  Test category/account edit mode via long press simulation
