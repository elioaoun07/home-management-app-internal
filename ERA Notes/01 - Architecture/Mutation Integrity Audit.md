---
created: 2026-11-04
type: audit
module: cross-cutting
module-type: n/a
status: active
evidence-cutoff: e053ac9 (2026-11-04)
tags:
  - type/audit
  - scope/cross-cutting
  - topic/optimistic-ui
  - topic/atomicity
  - topic/error-handling
---

# Mutation Integrity Audit: Optimistic UI, All-or-Nothing Writes, API Failure Handling

> **Scope:** every client mutation (`useMutation`, inline `fetch`/`safeFetch`, direct browser Supabase writes) and every mutating API route (215 of 256 `route.ts` files) as of commit `e053ac9`.
> **Method:** source reading, plus small scanners (see [Appendix B](#appendix-b--how-to-re-run-the-counts)). Nothing was reproduced against production (Hard Rule #26). Rows marked **verified** were read line by line this session. Counts marked **≈** come from heuristics and can be off by a few.
> **Out of scope:** RLS (no "X can't see Y" symptom was investigated), styling, performance beyond round-trip counts.
> **Already tracked elsewhere (do not duplicate):** BUD-63 (atomic balance + history primitive), BUD-64 (draft confirm exactly once), BUD-65 / BUD-71 (statement import atomicity), BUD-24 (restore inverse effects), BUD-68 (debt reads mutate), BUD-74 (money route contracts), BUD-85 (mark-covered exactly once), HUB-116 (multi-write flows → optimistic bulk path), R48 (raw client mutations → `safeFetch`), NOTIF-20 (shortcut Done semantics). This audit adds evidence to those items and lists what none of them cover.

Severity: 🔴 a money or schedule fact ends up wrong or duplicated · 🟠 data ends up inconsistent but is visible or recoverable · 🟡 friction or low frequency.

---

## 0 · Top findings (read this if nothing else)

| # | Sev | Finding | Evidence | New? |
|---|---|---|---|---|
| 1 | 🔴 | **Every failed mutation is replayed once automatically.** The global React Query default is `mutations: { retry: 1 }`. Only 9 hooks opt out, all of them AI or ERA. A timeout or 5xx that arrives *after* the server committed re-sends a non-idempotent POST (transaction create, recurring confirm, debt settle, split complete). | `src/app/providers.tsx:131-134` | **New** |
| 2 | 🔴 | **`adjustAccountBalance()` never throws.** On an update error, or after losing the compare-and-swap 5 times, it logs and returns the *previous* balance. Every caller then answers 200: the row is written and the balance is not. | `src/lib/balance.ts:94-121` | BUD-63 (failure propagation listed as open) |
| 3 | 🔴 | **Recurring payment confirm ignores a failed due-date advance.** The transaction is inserted and the balance moved. If the `next_due_date` update then fails, the code comments "not critical - return success anyway". The payment stays due and the next confirm posts it twice. There is no compare-and-swap on the current `next_due_date`, so two partners confirming at once both succeed. | `src/app/api/recurring-payments/[id]/route.ts:216-279` | **New** (BUD-85 covers only mark-covered) |
| 4 | 🔴 | **Split-bill completion and future-payment confirm are check-then-act.** Both read the guard (`split_completed_at IS NULL` / `is_draft = true`), then update without it, then move money. A double tap, a retry (#1) or two phones can debit twice. | `src/app/api/transactions/split-bill/route.ts:195-237`; `src/app/api/future-payments/[id]/confirm/route.ts:31-36` vs `86-131` | **New** |
| 5 | 🔴 | **Debt settlement writes money before the debt record.** It inserts the return transaction, then the balance, then the debt update. If the debt update fails → 500 with the money already in. The retry adds a second return. Two concurrent settles both read the same `returned_amount`. | `src/app/api/debts/[id]/route.ts:149-218` | **New** |
| 6 | 🔴 | **Notification "Complete" never completes the item.** `complete_task` dismisses the notification, then updates `items.completed_at`, which does not exist on `items` (per `migrations/schema.sql`). The error is unchecked and the route returns `success: true`. Wired from HubPage, NotificationModal and CriticalAlertGate. It is also a third completion engine that would end a whole recurring series. | `src/app/api/notifications/actions/route.ts:106-136` | **New** (NOTIF-20 holds the semantics, not this bug) |
| 7 | 🔴 | **Postpone Undo does not undo.** For one-off items the server moves `due_at` / `start_at` and the alert triggers. Undo deletes only the `item_occurrence_actions` row, then shows "Postponement undone" while the due date stays moved. | `src/app/api/items/[id]/actions/route.ts:220-257`; `src/features/items/useItemActions.ts:945-952`, `766-795` | **New** |
| 8 | 🟠 | **Shopping `toggle_check` is a read-then-flip, but the client retries it up to 3 times.** A 5xx returned after the flip committed (the broadcast after the write can throw) makes the retry un-check the item. | `src/app/api/hub/messages/route.ts:1038-1078`; `src/components/hub/ShoppingListView.tsx:1729-1758`, `1813-1825` | **New** |
| 9 | 🟠 | **Statement import writes rows before its undo ledger, yet a ledger failure answers "Nothing was written".** Creates, stamps, draft confirmations, transfers and skips are all committed before the ledger upsert. The header comment's "dying halfway is still fully revertible" is not true for those rows. | `src/app/api/statement-import/commit/route.ts:228-235`, `404-407`, `978-998` | BUD-65 / BUD-71 (adds evidence) |
| 10 | 🟠 | **98 client mutations still use raw `fetch()`** (no timeout, no offline routing), including money: manual balance set, future-payment confirm, transaction Undo, templates, receipts. | [Appendix A](#appendix-a--raw-fetch-mutation-sites-hard-rule-6) | R48 (recount) |

---

## 1 · Cross-cutting multipliers

These five behaviors are why a partial write in one route becomes a duplicate or a silent drift instead of a visible error.

1. **Global mutation retry** (`src/app/providers.tsx:131-134`). `retry: 1` applies to every `useMutation` that doesn't set `retry`. A `RequestTimeoutError` is "may have committed", not "failed". Retrying it is only safe when the request carries a client id the server dedupes on. Today only transfers (`src/app/api/transfers/route.ts:34-36`, `363-372`) and item create (`create_item_complete` / `create_items_bulk`) do.
2. **The balance choke point swallows failure** (`src/lib/balance.ts:94-121`). Every money route treats `await adjustAccountBalance(...)` as infallible. Until BUD-63 lands, no route can tell "row written, balance not".
3. **Offline replay of non-idempotent ops** (`src/lib/offlineSyncEngine.ts:340-384`). The item-create path has a fence and a receipt (`:241-282`); nothing else does. A transaction create, recurring confirm or hub message replayed after a timeout (counted as "other error", retried) or a 5xx (retried up to 5 times) can commit twice. After 5 failures a queued expense is **dropped** with a toast (`:222-238`).
4. **PostgREST has no multi-statement transaction.** Every route below that chains two or more `.insert/.update/.delete` calls is a sequence of independent commits. The repo already has the cure: one SECURITY DEFINER RPC per unit of work (`create_item_complete`, `create_items_bulk`, `activate_trip`, `complete_trip`, `health_save_medication`, `health_set_dose`, `fitness_*`, `claim_household_code`, `add/remove_item_prerequisite_complete`, `save_era_run`). **No money path uses one.**
5. **Writes from the browser.** `src/features/items/useItems.ts` (36 writes), `useItemActions.ts`, `useFlexibleRoutines.ts` and `useChoreActions.ts` write to Supabase directly. A phone that loses signal mid-sequence leaves whatever already committed, with no server-side cleanup, no `safeFetch` timeout and no offline routing.

---

## 2 · Where optimistic UI is not implemented

**Criterion:** "optimistic" = the React Query cache is updated in `onMutate` (or before the request), with rollback on error and refetch on settle (Common Patterns §1). Updating the cache in `onSuccess` is *not* optimistic.

**Coverage:** 250 exported mutation hooks, of which **64 are optimistic and 186 are not**. **74** of those 186 have neither `onMutate` nor `onError`, so the caller must catch or the failure is silent (≈, `hooks.mjs`).

| Module | Optimistic / total hooks |
|---|---|
| Transfers, Drafts, Preferences, Notifications (in-app) | 3/3 · 2/2 · 3/3 · 7/8 |
| Accounts, Recurring, Transactions | 5/8 · 4/7 · 3/5 |
| Catalogue, Categories, Trips, Debts, Future purchases | 6/15 · 4/10 · 6/24 · 2/5 · 2/4 |
| Items / Schedule | **7/41** |
| Hub, ERA, Fitness, Outfits, Budget | 2/12 · 2/7 · 3/11 · 1/9 · 1/4 |
| Recipes, Meal planning, NFC, Inventory, Healthcare (+ measurements) | **0/15 · 0/3 · 0/8 · 0/4 · 1/20** |
| Day plan, Recycle bin, Memories, Statement import, AI usage | 0/2 · 0/3 · 0/2 · 0/6 · 0/8 |

### 2.1 Priority list

**P1** = a tap the user repeats many times a day, where they currently watch a spinner or nothing happens. **P2** = list CRUD. **P3** = a form save where waiting for the server is acceptable.

| P | Module | Action | Where | Today |
|---|---|---|---|---|
| P1 | Schedule | Complete / Uncomplete / Skip / Postpone / Cancel / Delete (one item) | `src/features/items/useItemActions.ts:370-795` (`useItemActionsWithToast` `:796-1185`) | Awaits the server, then toasts. No cache write. SCH-26 made only the *grouped chore* complete optimistic. |
| P1 | Schedule | Card checkbox | `src/components/items/SwipeableItemCard.tsx:368-387`, `src/components/planner/WebDayPlanner.tsx:1109-1139` | **Anti-pattern:** a local `useState` overlay is cleared on success *before* the invalidated refetch lands, so it flickers back. Other views of the same item never update (Common Patterns §1). Move to `onMutate` on `itemsKeys` + `allActions()`. |
| P1 | Schedule | Day-plan checklist tick | `src/features/day-plan/useDayPlan.ts:82-116` | Not optimistic, *and* it PATCHes the whole `checklist` array (last write wins between two devices). Needs a per-entry toggle endpoint plus `onMutate`. |
| P1 | Kitchen | Recipe favorite (double-click toggle, Hard Rule #2) | `src/features/recipes/hooks.ts:308` | `setQueryData` only in `onSuccess`. |
| P1 | NFC | Checklist toggle, "All done" | `src/features/nfc/hooks.ts:281`; `src/app/nfc/[tag]/nfc-tap-client.tsx:322-341` | Toggle uses a local overlay. "All done" loops sequential completes, then navigates away (see §4.2). |
| P1 | Hub | Alert dismiss / snooze, thread mark-read | `src/features/hub/hooks.ts:355`, `1388-1436` | Raw `fetch`, no `onMutate`, no `onError`. |
| P1 | Budget | Set default / default-income account, unhide account / category | `src/features/accounts/hooks.ts:226`, `252`, `350`; `src/features/categories/hooks.ts:234` | Server-confirmed toggles. |
| P2 | Budget | Category create / update / delete / reorder (**second engine**) | `src/features/categories/useCategoryManagement.ts:75-150`, `src/components/settings/CategoryManagement.tsx:229-400`, `src/components/expense/CategoryManagerDialog.tsx:315-525` | `src/features/categories/hooks.ts` already has optimistic versions of the same operations. Two engines for one concept; converge on the optimistic one. |
| P2 | Budget | Transaction templates CRUD | `src/components/expense/TemplateQuickEntryButton.tsx:166-319`, `TemplateDrawer.tsx:137` | Inline raw `fetch`. |
| P2 | Kitchen | Meal plan create / update / delete (**defined twice**) | `src/features/meal-planning/hooks.ts:120-160` **and** `src/features/recipes/hooks.ts:349-420` | Two copies, neither optimistic. |
| P2 | Kitchen | Inventory restock / update stock / add to shopping | `src/features/inventory/hooks.ts:196-280` | Raw `fetch`, not optimistic. |
| P2 | Trips | Create / delete place, packing category CRUD, bulk add packing items, delete / restore packing item, documents | `src/features/trips/hooks.ts:417-1060` | Update and reorder are optimistic; create and delete are not. |
| P2 | Catalogue | Create module / category / room / item, rename / delete room, sub-items | `src/features/catalogue/hooks.ts:338-900` | Update and delete item are optimistic; creates and rooms are not. |
| P2 | Hub | Item links add / delete, create thread, message-action create | `src/features/hub/itemLinksHooks.ts:115-210`, `hooks.ts:218`, `messageActions.ts:48` | Raw `fetch`, no rollback. |
| P2 | Schedule | Subtask rename / priority, kanban settings, pauses, reminder templates | `src/features/items/useItems.ts:1424-1690`, `2159-2210`; `src/features/items/useReminderTemplates.ts` | Server-confirmed; priority is an N+1 browser loop (§3.4). |
| P2 | ERA | Template enable / delete, artifact reversal | `src/features/era/templates/useTaughtPhrases.ts:15-45`, `widgets/useEraArtifacts.ts:172` | Server-confirmed. |
| P3 | Healthcare, Outfits, AI usage, Memories, Notification prefs | CRUD forms | `src/features/healthcare/hooks.ts`, `src/features/outfits/hooks.ts`, `src/features/ai-usage/hooks.ts`, `src/features/memories/hooks.ts`, `src/hooks/useNotifications.ts:546` | Acceptable as server-confirmed; make deletes optimistic first. |

### 2.2 Do **not** make these optimistic until the server is atomic

Showing a result before the server can promise all-or-nothing means the screen is contradicted by a half-applied write. Fix §3 first, then add `onMutate`.

- Recurring confirm (`useConfirmPayment`, `src/features/recurring/useRecurringPayments.ts:291`). See §3.1 #3.
- Split complete (`useCompleteSplitBill`, `src/features/transactions/useSplitBill.ts:39`). §3.1 #5.
- Future-payment confirm (`src/components/expense/FuturePaymentsDrawer.tsx:91`, `useConfirmFuturePayment`). §3.1 #4.
- **Already optimistic over a non-atomic server:** `useSettleDebt` (`src/features/debts/useDebts.ts`) sits on §3.1 #6; `useAddTransaction` / `useDeleteTransaction` sit on §3.1 #1-2. Keep them, but they depend on BUD-63.
- Server-confirmed by design (correct as is): statement import commit / revert, trip activate / complete (cascade RPC), AI generation, household claim, uploads.

---

## 3 · Where a partial write must not count as success

**Rule:** a unit of work is one user intent ("confirm this payment"). It either fully commits and returns 2xx, or commits nothing and returns an error. A retry of the same intent returns the first result without writing again. The reference implementation is `src/app/api/items/route.ts:21-35`: one RPC (`create_item_complete`), a `completion` receipt (`complete | rolled_back | unknown`), and an honest "Save unverified" when the outcome is unknown.

Transfers are the closest money path (client id + 23505 replay, compare-and-swap delete). But the transfer row and both legs are still three commits (`src/app/api/transfers/route.ts:342-401`). The idempotent replay assumes "the first request already moved them", so a crash between insert and legs is **locked in** by the replay.

### 3.1 Money (🔴 — all depend on BUD-63's atomic primitive)

| # | Unit of work | Where | Current sequence → failure window | Required |
|---|---|---|---|---|
| 1 | Create transaction | `src/services/transaction.service.ts:496-556` | insert tx → notification (unchecked) → balance (swallowed) → name lookups. No client id: a timeout plus `retry: 1` or offline replay duplicates it. The comment at `src/features/transactions/useDashboardTransactions.ts:648-652` documents this hazard. | `create_transaction(p jsonb)` RPC: row + balance + history in one transaction, client-supplied `id` as idempotency key, 23505 → replay the stored row. |
| 2 | Edit / delete transaction | `src/app/api/transactions/[id]/route.ts:287-432`, `504-576` | PATCH: unchecked `oldTx` read → update → up to 2 balance legs (an account move with one failed leg makes money vanish). Two concurrent PATCHes compute their deltas from the same `oldTx`. DELETE: children soft-deleted (unchecked) **before** the parent; their balance contribution is never reversed. The comment says "restored together", but restore (`src/app/api/recycle-bin/restore/route.ts:96-123`) only revives the parent. | One RPC per verb that locks the row, computes the delta from locked old vs new, and cascades children with their deltas. Covers BUD-24 for children. |
| 3 | Confirm recurring payment | `src/app/api/recurring-payments/[id]/route.ts:216-279` | insert tx → balance → advance `next_due_date`; **failure ignored** (`:277`). No `.eq("next_due_date", <read value>)` guard. No zod. | RPC that locks the payment, refuses if `next_due_date` ≠ expected (409), and inserts tx + balance + advance together. The client sends the expected due date. |
| 4 | Confirm future payment | `src/app/api/future-payments/[id]/confirm/route.ts:31-131` | read with `is_draft = true` → update **without** that guard → balance. Concurrent confirms both apply. | Same pattern as BUD-64 (draft confirm): guarded update returning 0 rows → idempotent 200 / 409, inside the RPC. |
| 5 | Complete split bill | `src/app/api/transactions/split-bill/route.ts:195-257` | read `split_completed_at` → update **without** `.is("split_completed_at", null)` → collaborator balance → notification + dismiss (unchecked). | Guarded update + balance in one RPC. Notifications can stay best effort, but after commit. |
| 6 | Settle debt | `src/app/api/debts/[id]/route.ts:149-218` | insert return tx → balance → update debt → 500 on failure *after* money moved. `returned_amount` read-modify-write races. | RPC: lock debt, insert return, apply balance, advance `returned_amount` / `status` atomically. Client id for replay. |
| 7 | Create debt | `src/app/api/debts/route.ts:138-190` | server **HTTP-calls its own** `/api/transactions` (tx + balance), then inserts the debt; debt failure → 500 with the expense kept. | Call the service / RPC in-process; one unit. |
| 8 | Confirm draft | `src/app/api/drafts/[id]/route.ts:50-90` | guarded update ✔ → balance (swallowed). A retry of an already-confirmed draft → `.single()` PGRST116 → **500**. | BUD-64. Map "0 rows" to an idempotent 200 or 409. |
| 9 | Transfer create / edit / delete | `src/app/api/transfers/route.ts:342-401`, `[id]/route.ts:150-220`, `376-415` | row → `Promise.all` of 2 legs (each swallowed). Replay skips legs. | `create_transfer` RPC: row + both legs + history; replay safe by construction. |
| 10 | Restore from Recycle Bin | `src/app/api/recycle-bin/restore/route.ts:76-160` | compare-and-swap restore ✔ → balance legs (swallowed) → children not restored. | BUD-24. |
| 11 | Statement import commit | `src/app/api/statement-import/commit/route.ts:228-1127` | header → rows (creates / stamps / confirms / transfers / skips) → **ledger** → balances → mappings → close (unchecked). A ledger failure leaves committed rows with no ledger, yet the error text says "Nothing was written" (`:993`). | BUD-65 / BUD-71: per row, tx + ledger entry + delta in one transaction; fix the message now. |
| 12 | Create account / trip account | `src/app/api/accounts/route.ts:300-353`; `src/app/api/trips/[id]/activate/route.ts:53-136` | account → 48 sequential category inserts from `src/constants/defaultCategories.ts` (unchecked) → balance row (unchecked). Likely beyond the 8 s `safeFetch` budget, so the client sees a timeout while the server keeps writing. Trip: a failed trip update leaves an orphan account, and re-activating creates a second one. | `create_account_with_defaults` RPC, reused by `activate_trip`. |
| 13 | Dead-but-live money endpoints | `src/app/api/transactions/route.ts:73-98` (PATCH changes `amount` without a balance delta); `src/app/api/transactions/bulk-update/route.ts:26-37` (spreads arbitrary body fields into `.update()`: amount, account, `is_draft`, `user_id`) | No callers in `src/` (grep). | Delete, or zod-whitelist and route through the edit RPC. |

**Worked example (#3, per money-rules).** Expense account balance 500, rent 100 due 2026-11-01. Confirm: tx inserted, balance 500 → 400, `next_due_date` update fails → 200 OK. The payment still shows due, the user confirms again: tx #2, balance 400 → 300, due date now advances. Expected end state is 400 with one transaction; actual is 300 with two.

### 3.2 Schedule / recurrence (🔴/🟠)

| # | Unit of work | Where | Failure window | Required |
|---|---|---|---|---|
| 14 | Complete item (one-off) | `src/app/api/items/[id]/actions/route.ts:145-176`; duplicate engine `src/lib/items/completeItems.ts:173-200` | `Promise.all(items, occurrence_action)` checks only the item → `reminder_details` (unchecked) → alerts off (unchecked). Partial = completed item whose alert still fires. Two copies of this logic plus a third in §0 #6. | `complete_item_occurrence` RPC used by single, bulk and notification paths. |
| 15 | Postpone item | `src/app/api/items/[id]/actions/route.ts:196-260` | occurrence action → `due_at` → `start_at` → N alert updates, all unchecked. Partial = due moved, alert at the old time. Undo is not an inverse (§0 #7). | RPC that returns the previous anchor so Undo can restore it. |
| 16 | Edit item | `src/app/api/items/[id]/route.ts:107-175` | items update → reminder / event details (unchecked) → N alert updates (unchecked). No zod (Hard Rule #12). | `update_item_complete` RPC mirroring create. |
| 17 | Delete / archive item | `src/app/api/items/[id]/route.ts:238-258`; browser variants `src/features/items/useItems.ts:681-720`, `useItemActions.ts:704-765` | flag → alerts off (unchecked). The browser "delete with undo" *archives* (does not soft-delete) and never deactivates alerts, so it is a second delete engine. | One server path. |
| 18 | Uncomplete (Undo of complete) | `src/features/items/useItemActions.ts:501-587` | Browser multi-write; does **not** re-arm alerts (the server uncomplete in `completeItems.ts:240-262` does). Undo leaves the reminder silently mute. | Call the server uncomplete. |
| 19 | Complete reminder (legacy hook) | `src/features/items/useItems.ts:722-752` | items → `reminder_details` from the browser; a third completion variant with no alert handling. | Retire in favor of #14. |
| 20 | Recurrence exception with alert | `src/features/items/useItems.ts:1800-1925` | old alert off → new alert insert → exception upsert. If the upsert fails the new alert is orphaned **and fires**. | RPC. |
| 21 | Recurrence rule upsert | `src/features/items/useItems.ts:2071-2122` | select-then-insert from the browser; two writers → two rules. | Unique `item_id` + upsert, server side. |
| 22 | Launch reminder template | `src/app/api/reminder-templates/launch/route.ts:88-160` | items → details → compensating delete (unchecked). The only item insert that bypasses `create_item_complete`. | Call `create_item_complete`. |
| 23 | Subtask priority shift | `src/features/items/useItems.ts:1469-1545` | N sequential browser updates, then the target. Partial = duplicate priorities. | One RPC or a single ordered upsert. |

### 3.3 Other modules (🟠/🟡)

| # | Unit of work | Where | Failure window |
|---|---|---|---|
| 24 | Clone trip | `src/app/api/trips/[id]/clone/route.ts:35-125` | trip → places (unchecked) → categories (500 leaves a half-clone) → items (unchecked) → **201**. |
| 25 | Activate recipe version | `src/app/api/recipes/[id]/versions/route.ts:84-135` | deactivate all → insert (a failure leaves **zero** active versions) → recipe sync (unchecked). |
| 26 | Category reorder | `src/app/api/categories/manage/route.ts:258-272` | `Promise.all` of N updates. Errors are reported, but the committed half stays. |
| 27 | Household claim fallback | `src/app/api/household/claim/route.ts:52-125` | The service-role fallback also runs when the RPC *refused* the claim, and its update lacks `.is("partner_user_id", null)`. Onboarding upsert unchecked. |
| 28 | Hub GET mutates | `src/app/api/hub/messages/route.ts:305-355`, `428-452` | A read path writes (fire-and-forget archive, receipts), against Doctrine §4. It selects `items.due_at, start_at`, which don't exist on `items`, so that branch is always empty. |
| 29 | Inventory / outfits create with cleanup | `src/app/api/inventory/items/route.ts:225-240`; `src/app/api/outfits/route.ts:107` | Compensating delete is unchecked. |

### 3.4 Client fan-out loops (input for HUB-116 sheet D)

Each loop below is N requests for one intent. Partial success leaves N−k rows with one toast.

| Site | Loop | Disposition |
|---|---|---|
| `src/components/trips/TripPackingList.tsx:1327-1334` | `Promise.all(createCategory.mutateAsync)` then bulk create | migrate to a trip packing bulk RPC |
| `src/components/trips/TripPackingList.tsx:1343-1352`; Undo `src/features/trips/hooks.ts:788-791`, `943-950` | N PATCH / DELETE per item for reset and Undo | migrate (checkpoint RPC exists: extend it) |
| `src/features/era/intents/resolvers/shopping.ts:80-110` | POST `/api/hub/messages` per item | migrate to a hub bulk add |
| `src/app/nfc/[tag]/nfc-tap-client.tsx:322-341` | sequential `/complete` per item, errors swallowed | use `/api/items/bulk/complete` (SCH-26) |
| `src/components/hub/BulkConvertReviewSheet.tsx`, `src/components/planner/WebDayPlanner.tsx:1015`, Chores `placeFlexible` / `placeUndated` | already listed in HUB-116 sheets B / C | — |
| `src/components/expense/CategoryManagerDialog.tsx:512-525`, `src/components/settings/CategoryManagement.tsx:229-240` | one request, N server updates (#26) | fine client side; fix server |

---

## 4 · Where API failure handling should be better

### 4.1 Server routes (≈, `routes.mjs` over 215 mutating routes)

| Gap | Count | Notable examples | Fix |
|---|---|---|---|
| No zod validation (Hard Rule #12) | **102 / 215** | money: `transactions` POST/PATCH, `transactions/bulk-update`, `split-bill`, `future-payments/[id]/confirm`, `drafts/[id]`, `recurring-payments` + `[id]`, `debts` + `[id]` + `standalone`, `accounts/reconcile`, `future-purchases/[id]/allocate`; schedule: `items/[id]`, `items/[id]/actions`, `items/[id]/complete`, `subtasks` | Schema first; derive types. |
| No `try/catch` at all | **88** | `debts`, `debts/[id]`, `accounts/[id]/balance` call `await req.json()` bare, so a malformed body is an unhandled 500, not a 400. Also all `trips/*`, `era/*`, `transfers/[id]`. | A shared wrapper (below). |
| Raw DB `error.message` returned to the client | **131** | `hub/messages` (7), `notifications/actions` (7), `items/[id]/actions` (6), `catalogue/items/[id]` (6), `statement-import/commit` (`details:`) | Generic text to the client; detail to `error_logs`. |
| Inserts with no 23505 → 409 branch (Hard Rule #9) | **70** (only matters where a unique constraint exists) | `recurring-payments` POST, `reminder-templates`, `transaction-templates`, `hub/topics`, `catalogue/categories` | Mapping table below. |
| Secondary writes unchecked (`await …update()` with the result discarded) | **≈130** (scanner; spot-checked) | every row in §3 | Check, or move into the RPC. |
| `.single()` "no rows" mapped to 500 | common | `drafts/[id]:67` (a retry of a confirmed draft → 500) | PGRST116 → 404, or 409 on a guarded update. |
| Writes against columns that don't exist | 2 verified | `notifications/actions:127-133` (`items.completed_at`), `hub/messages:305-308` (`items.due_at, start_at`) | Typed Supabase client or a contract test per route (BUD-74 style). |

**Proposed shared server handler** (`src/lib/api/errors.ts`, new; one choke point per Doctrine §4):

| Input | Status | Client body |
|---|---|---|
| `ZodError` | 400 | `{ error: "Invalid input", fields }` |
| `SyntaxError` from `req.json()` | 400 | `{ error: "Invalid JSON" }` |
| PGRST116 (no row from `.single()`) | 404, or 409 for a guarded update | `{ error: "Not found" }` / `{ error: "Already done", code: "already_applied" }` |
| 23505 unique | 409 | `{ error: "Already exists" }` (or a replay of the stored row when a client id is present) |
| 23503 FK / 23514 check | 409 / 422 | short reason |
| 42501 / RLS | 403 | `{ error: "Not allowed" }` |
| 22P02 bad uuid | 400 | `{ error: "Invalid id" }` |
| PGRST204 unknown column, anything else | 500 | `{ error: "Something went wrong", completion: { status: "unknown" } }` + `error_logs` row |

Every multi-step route should also return the `completion` receipt that `src/app/api/items/route.ts` already returns, so the client can say "Save unverified" instead of guessing.

### 4.2 Client

| Gap | Where | Fix |
|---|---|---|
| Global `retry: 1` replays non-idempotent writes | `src/app/providers.tsx:131-134` | Default `retry: false`. Let a mutation opt in only when its request carries a client id. Never retry `RequestTimeoutError` without one. |
| `fetch(...).catch()` treats HTTP 4xx/5xx as success; no rollback | `src/components/hub/ShoppingListView.tsx:1258-1295` (group and item reorder) | Check `res.ok`; restore `localGroupOrder` / `localItemOrders` on failure. |
| Retrying a toggle | `ShoppingListView.tsx:1813-1825` → server flip `hub/messages/route.ts:1059-1071` | Send the target state (`set_checked: true/false`); then a retry is idempotent. |
| Errors swallowed, navigation regardless | `src/app/nfc/[tag]/nfc-tap-client.tsx:322-341` | One bulk call; show "2 of 3 done" with Retry. |
| Undo that is not an inverse | Postpone `useItemActions.ts:945-952`; Uncomplete `:501-587`; transaction delete Undo re-POSTs a **new** row via raw `fetch`, losing `trip_id`, `lbp_change_received` and split fields (`src/features/transactions/useDashboardTransactions.ts:528-566`) | The server returns an inverse token; for soft-deletes Undo calls `/api/recycle-bin/restore`. |
| Offline queue drops money after 5 failures; replays non-idempotent ops | `src/lib/offlineSyncEngine.ts:222-238`, `340-384` | Extend the item fence + receipt to transactions and recurring confirm; park failures for review (`reviewRequired`) instead of dropping them. |
| Mutations with no `onError` and no caller catch | 74 hooks (≈), e.g. `useCompleteSplitBill`, `useUpsertDayPlan`, `useDeleteDayPlan`, all of `useCategoryManagement`, NFC hooks, reminder templates, `useCreateMessageAction` | Global `MutationCache.onError` fallback toast (with the error class below), overridable per hook. |
| Every hook re-implements `if (!res.ok) { await res.json().catch… }` | ~all feature hooks | One `mutateJson(url, { method, body, clientId })` over `safeFetch` that returns typed `ApiError { status, code, retryable, maybeCommitted }`. |
| `console.*` in client mutation paths (Hard Rule #22) | e.g. `useDashboardTransactions.ts:571-660`, `useItemActions.ts:957`, `useItems.ts:1838` | Error Logs module. |

**One response per error class** (to be implemented in `mutateJson` + the global `MutationCache`):

| Class | Detect | UI | Retry? |
|---|---|---|---|
| Offline | `isOfflineError` | keep the optimistic row, mark it pending, queue | queue replays |
| Timeout | `RequestTimeoutError` | keep the row, show "Saving…", reconcile by refetch or a receipt lookup | only with a client id |
| Validation | 400 / 422 | roll back, show the field error | no |
| Conflict / already applied | 409 | roll back to server state, show "Already done" | no |
| Not allowed | 401 / 403 | roll back, prompt to sign in | no |
| Server | 5xx with `completion.status = rolled_back` | roll back, toast with Retry | user-initiated |
| Unknown commit | 5xx / `completion.status = unknown` | keep the row marked unverified, refetch, "Check before retrying" | no automatic retry |

---

## 5 · Suggested order of work

1. **Stop the multiplier** (small): global `mutations.retry: false`, with opt-in for client-id requests. Fix `complete_task` to call the shared completion path (§0 #6). Fix the Postpone Undo inverse (§0 #7) and the shopping toggle (§0 #8). Fix the statement-import error text (§0 #9).
2. **Guards that need no migration:** add `.is("split_completed_at", null)`, `.eq("is_draft", true)` and `.eq("next_due_date", expected)` to the three money updates (§3.1 #3-5); return 409 on 0 rows; make a failed advance in #3 fail the request. This shrinks the double-post window until step 3 lands.
3. **BUD-63 primitive**, then one RPC per money verb (§3.1 #1-12) with client ids. Then turn on optimistic UI for §2.2.
4. **Schedule RPCs:** a single completion / postpone / update engine (§3.2 #14-23); retire the browser multi-writes.
5. **`src/lib/api/errors.ts` + `mutateJson`**, then sweep the zod / try / leak gaps by module (BUD-74 for money; R48 for raw `fetch`).
6. **P1 optimistic gaps** (§2.1), then HUB-116 sheet D migrations (§3.4).

---

## Appendix A — Raw `fetch` mutation sites (Hard Rule #6)

98 call sites (≈, `rawmut.mjs`) by file: ShoppingListView 13 · useNotifications 8 · CategoryManagerDialog 8 · hub/hooks 7 · CategoryManagement 7 · TemplateQuickEntryButton 6 · NotesListView 5 · inventory/hooks 4 · future-purchases/hooks 4 · itemLinksHooks 3 · AccountBalance 3 (manual balance set) · useDashboardTransactions 2 (Undo paths) · useSectionOrder 2 · MerchantMappingsManager 2 · ReceiptSheet 2 · FuturePaymentsDrawer 2 (confirm, delete) · one each: WatchView, SimpleWatchView, WatchErrorBoundary, VoiceEntryButton (drafts), NewCategoryDrawer, NewSubcategoryDrawer, AddCategoryDialog, SubcategoryGrid, MobileExpenseForm (receipt), TemplateDrawer, PromoteToCatalogueDialog, SettingsDialog, NotificationSettings, useLbpSettings, useDatePreferences, archiveHooks, guest-portal-client, drinks-admin, greetingCache (TTS), azureSTT, meal-planning/hooks.

## Appendix B — How to re-run the counts

Scanner sources lived in the session scratchpad. Each is a few lines of Node over `grep -rl` output, and is easy to rewrite:

- **Hooks:** for each `export function use*` containing `useMutation`, record `onMutate`, `setQueryData`, `onError`, transport (`safeFetch` / raw `fetch` / direct Supabase) and call sites.
- **Raw mutations:** `fetch(` not preceded by `safe`/`pre`/`re`, with `method: POST|PATCH|PUT|DELETE` inside the same call expression.
- **Routes:** per mutating `route.ts`: zod (`safeParse|.parse(|from "zod"`), `try {`, `error: x.message` returns, `.insert|.upsert` without `23505`.
- **Unchecked writes:** `.insert|.update|.upsert|.delete(` on a `.from()` chain whose statement starts without an assignment. Spot-check before citing; it misreads statements that start with `[`.
