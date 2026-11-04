---
created: 2026-11-04
updated: 2026-11-04
type: status-review
status: active
owner: Elio
evidence_cutoff: "commit e053ac9 (2026-11-04). Source reading only: no production DB access (Hard Rule #26), no live RLS state read, nothing reproduced against live data. `pnpm typecheck` clean; `pnpm test` 296 files / 4647 tests passed, 28 skipped."
---

# Major Bug Sweep

A source audit of the whole app (ERA assistant, money modules, offline sync, household sharing, notifications, Guest Portal), looking for **major** defects: data loss, double-counted money, privacy leaks, silent failures. Every finding cites the code it rests on. Bugs already tracked in a Master Book are linked to their existing ID, not repeated.

**Retirement:** delete this file when every row in [Disposition](#disposition) is shipped or explicitly declined in its owning book.

> **Why the tests didn't catch these:** typecheck and all 4647 tests pass. Every bug below is a **logic or contract** bug: concurrency, replay, authorization, time zone, or inverse symmetry. Unit tests with mocked Supabase don't exercise those.

## Summary

| #         | Sev | Category             | Bug                                                                                                                       | Owner ID       |
| --------- | --- | -------------------- | ------------------------------------------------------------------------------------------------------------------------- | -------------- |
| [S1](#s1) | 🔴  | Security / privacy   | Guest Portal "admin view" returns every guest's allergies and drinks, unauthenticated                                     | HUB-118        |
| [M1](#m1) | 🔴  | Money: inverse       | Undo after deleting a transaction makes a **copy**, original stays in the Recycle Bin, so a later restore counts it twice | BUD-89         |
| [M2](#m2) | 🔴  | Money: exactly-once  | Recurring confirm, future-payment confirm, split-bill completion and debt settlement can post twice                       | BUD-90         |
| [O1](#o1) | 🔴  | Offline data loss    | Offline queue deletes any write older than 24 h with no notice; replay deletes writes on 401                              | HUB-119        |
| [O2](#o2) | 🟠  | Offline duplicates   | A replay that times out is retried, so non-idempotent creates (expenses) can post twice                                   | HUB-120        |
| [M3](#m3) | 🟠  | Money: authorization | Four money routes accept any `account_id` and move its balance with the service-role client                               | BUD-91         |
| [M4](#m4) | 🟠  | Money: inverse       | Restoring a deleted split-bill transaction doesn't re-apply the partner's leg                                             | BUD-92         |
| [S2](#s2) | 🟠  | Security             | Two cron routes fail open when `CRON_SECRET` is missing (one hard-deletes data)                                           | NOTIF-22       |
| [H1](#h1) | 🟠  | Household visibility | Single-row `household_links` reads break when a user has two active rows; pending invite rows can mask the real link      | HUB-121        |
| [T1](#t1) | 🟠  | Time zone            | Server defaults money dates to **UTC** "today"; Beirut entries between midnight and 02:00–03:00 land on yesterday         | BUD-93         |
| [N1](#n1) | 🟠  | Notifications        | Item-reminder cron sends the push before claiming the alert, so overlapping runs can send duplicates                      | NOTIF-23       |
| [M5](#m5) | 🟡  | Money: validation    | Unvalidated JSON amounts reach `adjustAccountBalance`; a string amount on an income/saving account would concatenate      | BUD-94         |
| [S3](#s3) | 🟡  | Platform             | Root `proxy.ts` (session refresh) never runs: Next 16 only loads it from `src/`                                           | R83            |
| [G1](#g1) | 🟡  | Guest Portal         | Bot answers are hard-coded for one party night; deactivated portals keep working; guests can post as "host"               | HUB-122        |
| [K1](#k1) | 🟡  | Search               | Recipe search breaks on a comma or parenthesis (raw text in a PostgREST `.or()` filter)                                   | KIT-28         |
| [X1](#x1) | 🟡  | Hard Rule #6         | 100 client mutations still use raw `fetch()` (no timeout), including balance set and transaction Undo                     | R44 (existing) |

Fix order, highest value first: **S1 → M1 → O1 → M2 → M3/M4 → O2 → S2 → H1 → T1 → N1**, then the 🟡 rows.

---

## 1. Security & privacy

### S1

**🔴 Guest Portal leaks every guest's allergies and drink choices to anyone holding the tag id.**

- **Evidence:** `GET /api/guest-portal/allergies?tag_id=…&all=true` (`src/app/api/guest-portal/allergies/route.ts:19-35`) and the same branch in `drinks/route.ts:19` use `supabaseAdmin()` with **no auth check** and return every row for the tag (`guest_name`, allergies, drinks). The tag id is not secret: `POST /api/guest-portal/session` returns `tag.id` to every guest who opens the portal (`session/route.ts:104`, `:142`). The admin page `/g/drinks-admin` gets the id the same way, unauthenticated (`src/app/g/drinks-admin/page.tsx:52`, `:69-70`).
- **Impact:** any guest (or anyone who scanned the QR/NFC once) can list every other guest's health-related allergy data. Hard Rule #26-level sensitivity: real people's medical info.
- **Fix:** move the `all=true` branches to an authenticated route (e.g. `/api/guest-portal/admin/{allergies,drinks}`) that uses `supabaseServer()`, requires `getUser()`, and checks `guest_portal_tags.user_id === user.id` (or the household partner). Remove `all` from the public routes. Make `/g/drinks-admin` require login and resolve the tag from the host's own tags, not from a guest session.
- **Test to add:** route test: anonymous `GET ?all=true` → 401; host of another tag → 403; owning host → 200.
- **UAT:**
  1. In a private window (logged out), open the portal for the "home" tag and note `tag.id` from the session response (DevTools → Network).
  2. Open `/api/guest-portal/allergies?tag_id=<id>&all=true`. **Expect 401**, not a list.
  3. Log in as the host and open `/g/drinks-admin`. **Expect** the full list.
  4. Log in as the partner (if the portal is household-shared). **Expect** the list; log in as an unrelated account → **expect 403**.

### S2

**🟠 `purge-recycle-bin` and `gcal-reconcile` accept `Bearer undefined` when `CRON_SECRET` is unset.**

- **Evidence:** `src/app/api/cron/purge-recycle-bin/route.ts:22` and `src/app/api/cron/gcal-reconcile/route.ts:22` compare the header with a template literal of `process.env.CRON_SECRET`. If the variable is missing, the expected header is the string `Bearer undefined`. The other four cron routes guard `!CRON_SECRET` first (e.g. `item-reminders/route.ts:84-86`).
- **Impact:** on any deployment without the secret (commonly Preview deployments, which usually share the production Supabase project), anyone can trigger a **hard delete** of Recycle Bin rows older than 30 days, or a full Google Calendar resync for every user.
- **Fix:** `if (!process.env.CRON_SECRET || header !== \`Bearer ${process.env.CRON_SECRET}\`) return 401;`in both. Better: one shared`isCronAuthorized(req)`in`src/lib/` used by all six.
- **Test to add:** with `CRON_SECRET` unset, `Authorization: Bearer undefined` → 401 for every cron route.
- **UAT:** on a Preview deployment without `CRON_SECRET`, `curl -H "Authorization: Bearer undefined" <preview>/api/cron/purge-recycle-bin` → **expect 401**. On production with the secret, the scheduler's call still returns `ok: true`.

### S3

**🟡 The app-wide session-refresh proxy is dead code.**

- **Evidence:** Next 16.0.7 looks for `proxy`/`middleware` only in the parent of the app directory, non-recursively (`node_modules/next/dist/build/index.js:568-590`, `rootDir = join(appDir, '..')` = `src/`). The repo has `proxy.ts` at the **root** and `src/middleware.ts` (the `/pm` gate) in `src/`. Only the `/pm` gate runs. The root file's 3 s auth-timeout fix for cold iOS launches has never been active.
- **Impact:** low today (the browser SDK refreshes tokens itself). Server-rendered pages and route handlers can see an expired session after idle until the client refreshes.
- **Fix:** decide whether app-wide refresh is wanted. If yes, merge both into **one** `src/proxy.ts` (Next throws E900 if `middleware` and `proxy` both exist), keeping the `/pm` redirect branch. If no, delete root `proxy.ts` so nobody relies on it.
- **UAT:** after the change, `pnpm build` succeeds with no E900, and `/pm` logged out still redirects to `/login?redirect=/pm`.

---

## 2. Money correctness

Read `.claude/skills/money-rules/SKILL.md` before fixing any of these. Each fix needs a worked balance example and a test.

### M1

**🔴 Transaction delete → Undo creates a duplicate-in-waiting.**

- **Evidence:** `DELETE /api/transactions/[id]` soft-deletes (`src/app/api/transactions/[id]/route.ts:510`, `:517`) and reverses the balance. The dashboard Undo toast does **not** restore that row: it `POST`s a brand-new transaction built from the cached copy (`src/features/transactions/useDashboardTransactions.ts:537-548`). The original stays in the Recycle Bin, and `POST /api/recycle-bin/restore` re-applies its balance (`src/app/api/recycle-bin/restore/route.ts:99-124`). ERA already does it correctly (`src/features/era/nativeActions.ts:210` calls the restore route).
- **Impact:** delete → Undo → (days later) restore from Recycle Bin = the expense exists twice and the balance moves twice. The copy also loses fields the POST doesn't send (`lbp_change_received`, receipt, split and debt links, tags) and gets a new id, so Activity Log links break. The Undo also uses raw `fetch()` (X1).
- **Fix:** Undo calls `safeFetch("/api/recycle-bin/restore", { module: "transactions", id })`, the same inverse ERA uses. No new row.
- **Test to add:** hook test: Undo after delete hits `/api/recycle-bin/restore` with the original id and never `POST /api/transactions`.
- **UAT** (test account; Wallet = expense account):
  1. Note Wallet balance B. Add a $12.50 expense → balance B − 12.50.
  2. Delete it → B. Tap **Undo** → B − 12.50, and the row has the **same** id and fields (LBP change, receipt) as before.
  3. Open Recycle Bin. **Expect** the transaction is **not** listed.
  4. Repeat with a split-bill or LBP-change transaction; all fields survive.

### M2

**🔴 Four confirm/settle flows are not exactly-once.**

Every one of them reads state, checks it, then writes without a compare-and-set, so a double tap, a lost response that gets retried, or an offline replay posts the money twice.

| Flow                      | Missing guard                                                                                                                                                                                                 | Evidence                                                                                                                                                         |
| ------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Recurring payment confirm | No guard at all: always inserts a transaction, then advances `next_due_date` without `.eq("next_due_date", old)`. Failure to advance is swallowed ("return success anyway"), so the next confirm posts again. | `src/app/api/recurring-payments/[id]/route.ts:216-279`; offline path queues it with no idempotency key: `src/features/recurring/useRecurringPayments.ts:318-336` |
| Future-payment confirm    | `update` filters on `id` only, not `is_draft = true`                                                                                                                                                          | `src/app/api/future-payments/[id]/confirm/route.ts:88-100`                                                                                                       |
| Split-bill completion     | `update` filters on `id` only, not `split_completed_at IS NULL`                                                                                                                                               | `src/app/api/transactions/split-bill/route.ts:205-211`                                                                                                           |
| Debt settlement           | Lost update: two settles read the same `returned_amount`, both post an income transaction, both write the same total                                                                                          | `src/app/api/debts/[id]/route.ts:141-210`                                                                                                                        |

Draft confirm already has the CAS (`.eq("is_draft", true)`); its atomicity is tracked as BUD-64. Mark-covered is BUD-85.

- **Fix:** claim first, then post money. For each flow: a conditional update that returns the row only if this call won (`next_due_date = old`, `is_draft = true`, `split_completed_at is null`, `returned_amount = old`); if it returns nothing, respond **409** and post nothing. Recurring confirm also takes a client-generated transaction id and treats `23505` as a replay, exactly like `src/app/api/transfers/route.ts:34`, `:345`, `:367`. Longer term these belong in the BUD-63 atomic RPC.
- **Test to add:** route tests: two concurrent confirms → one 200, one 409, one `adjustAccountBalance` call.
- **UAT:**
  1. Recurring: open a due $20 payment, tap **Confirm** twice quickly (or confirm, kill the network mid-request, reconnect). **Expect** one transaction, balance moves once, `next_due_date` advances one period.
  2. Recurring offline: go offline, confirm, go online. **Expect** exactly one transaction after sync.
  3. Future payment: same double tap → one transaction.
  4. Split bill: as the partner, submit the contribution twice quickly → partner's account moves once.
  5. Debt of $100: on two phones open Settle, enter $50 on each, submit both → **expect** the second to be refused; returned total $50 and one return transaction.

### M3

**🟠 Money routes trust the client's `account_id`.**

- **Evidence:** these routes take `account_id` from the body and pass it to `adjustAccountBalance`, which writes with the **service-role** client (`src/lib/balance.ts:52`), so RLS never checks it:
  - recurring confirm `src/app/api/recurring-payments/[id]/route.ts:201`, `:251`
  - future-payment confirm `src/app/api/future-payments/[id]/confirm/route.ts:72`, `:126`
  - draft confirm `src/app/api/drafts/[id]/route.ts:81`
  - split-bill `src/app/api/transactions/split-bill/route.ts:232`

  None calls `getAccessibleAccount(...).canWrite`, which transfers already do (`src/app/api/transfers/route.ts:303-304`). All four also default the account type to `"expense"` when the lookup fails (`recurring:246`, `future:116`, `drafts:76`, `split-bill:230`), so an account the caller can't read gets the **wrong sign**.

- **Impact:** a stale or buggy client (or a crafted request) can move the balance of an account the user may not write: the partner's private account, or one that stopped being shared after unlinking. Income/saving accounts silently go the wrong direction.
- **Fix:** in each route: `const acct = await getAccessibleAccount(supabase, user.id, finalAccountId); if (!acct?.canWrite) return 404;` and use `acct.type`, never a default.
- **Test to add:** per route: partner's non-public account → 404 and no balance call; own saving account → positive delta.
- **UAT:** as the partner, confirm one of the owner's shared recurring payments into the partner's **own** account → works. Make an owner account private, then replay the old confirm request (DevTools → Copy as fetch, edit `account_id`) → **expect 404** and no balance change.

### M4

**🟠 Restoring a deleted split-bill transaction leaves the partner's balance short.**

- **Evidence:** deleting a completed split reverses **both** legs: payer and collaborator (`src/app/api/transactions/[id]/route.ts:550-578`, `split_deleted`). Restore re-applies only the payer leg (`src/app/api/recycle-bin/restore/route.ts:99-124`), and the registry doesn't even select the split columns (`src/lib/recycleBin/registry.ts:43-44`).
- **Impact:** after delete → restore, the partner's account is permanently off by `collaborator_amount`, with no history row explaining it.
- **Fix:** add `split_completed_at, collaborator_account_id, collaborator_amount` to the transactions `selectColumns`, and in restore re-apply the collaborator delta (`getBalanceDelta(collaborator_amount, collabType, false, "create")`, `change_type` from the existing CHECK list). Same claim-first rule as M2.
- **Test to add:** restore of a completed split calls `adjustAccountBalance` twice with the exact inverse of the delete.
- **UAT:** payer adds a $40 bill, partner completes a $15 split. Note both balances. Delete the transaction → both move back. Restore it from the Recycle Bin → **both** balances return to the post-split values.

### M5

**🟡 Unvalidated amounts can corrupt a balance.**

- **Evidence:** `adjustAccountBalance` computes `newBalance = previousBalance + delta` (`src/lib/balance.ts:85`) with no `Number()` coercion. Recurring confirm (`body.amount`), debt settle (`amount_returned`, `src/app/api/debts/[id]/route.ts:141`) and split-bill read raw JSON with no Zod schema (Hard Rule #12). For income/saving accounts and debt returns the delta is the amount itself (`src/lib/balance-utils.ts:26-35`), so a string `"50"` would make the balance `"10050"`. Today's UI sends numbers, so this is latent. It is reachable from any future client: ERA, the offline queue, or a widget.
- **Fix:** a Zod body schema with `z.number().positive().finite()` on each route, plus `if (!Number.isFinite(delta)) throw` at the top of `adjustAccountBalance`. Also cap a debt settlement at the remaining amount on the server (the cap exists only in `DebtSettlementModal.tsx:58`).
- **UAT:** send `{"amount_returned":"5"}` to `PATCH /api/debts/<id>` → **expect 400**. Settle more than the remaining amount → **expect 400**.

---

## 3. Offline sync

### O1

**🔴 Queued offline writes are silently discarded.**

- **Evidence:**
  - Every sync pass first calls `removeStaleOperations()` (`src/lib/offlineSyncEngine.ts:157`). That deletes **every** queued operation older than 24 h except fitness, with no failure callback and no review state (`src/lib/offlineQueue.ts:422-435`).
  - On replay, any 4xx except fitness is deleted as "won't succeed on retry" (`offlineSyncEngine.ts:327-338`). That includes **401**, which after a long offline period just means the token expired. Only fitness treats 401 as retryable (`:313`).
- **Impact:** expenses, recurring confirms, and shopping and schedule edits made during a trip, a flight or a weekend without data vanish. The user saw them optimistically, then they're gone.
- **Fix:** never auto-drop. Stale ops become `reviewRequired: true` and appear in `OfflinePendingDrawer` with "Send / Discard". Treat 401, 408 and 429 as retryable (refresh the session, then retry); only 400/403/404/409/422 are terminal, and terminal ones also go to review, not straight to deletion.
- **Test to add:** `offlineQueue.test.ts`: 25-hour-old transaction op → still queued and flagged for review. Sync engine: 401 → retry count++, op kept.
- **UAT:**
  1. Go offline (airplane mode). Log a $5 expense; it appears as pending.
  2. Set the device clock forward 25 h (or wait), keep the app closed, then reopen online. **Expect** the expense is either synced or shown in Pending for review, **never** gone.
  3. Offline, log an expense, sign out on another device or expire the session, go online. **Expect** a sign-in prompt and the expense still pending, then synced after sign-in.

### O2

**🟠 A replay that times out can post twice.**

- **Evidence:** replay uses `safeFetch` with a 10 s timeout (`offlineSyncEngine.ts:255`). `RequestTimeoutError`'s message is "Request timed out after …ms" (`src/lib/safeFetch.ts:25-29`), which doesn't match the network-error checks (`offlineSyncEngine.ts:370-378`). So it falls to "Other error → increment retry" (`:383`) and the op stays queued. If the server committed, the next pass creates it again. Transactions have no client id or idempotency key (`src/services/transaction.service.ts` has none). Transfers (`clientId`) and item creates (the fence at `offlineSyncEngine.ts:244`) are already protected.
- **Fix:** give `POST /api/transactions` (and recurring confirm, M2) a client-generated UUID used as the row id, return the existing row on `23505`, the same as `replayTransfer` in `src/app/api/transfers/route.ts:367`. Queue ops carry that id from the moment they're created.
- **UAT:** throttle the network to "Slow 3G" in DevTools, go offline, log an expense, go online. While the replay is in flight, toggle offline/online again. **Expect** one transaction after the queue drains.

---

## 4. Household visibility

### H1

**🟠 Household link lookups are fragile when a user has more than one active row.** _(Route-level hazard. RLS state was **not** read; Hard Rule #27 still applies before acting on a specific "partner can't see X" report.)_

- **Evidence:**
  - `household_links` has no constraint limiting a user to one active link (`migrations/schema.sql:155-167`). An unclaimed invite row is `active = true` with `partner_user_id = null`.
  - The code itself states duplicates happen in practice: "re-linking leaves stale-but-active rows, and `.maybeSingle()` ERRORS on multiple rows" (`src/app/api/cron/item-reminders/route.ts:290-296`).
  - About 23 call sites still read the link with `.maybeSingle()` and no `.limit(1)`: recurring confirm, future-payment confirm, mark-covered, items, item actions, statement import commit/reconcile, budget allocations, analytics, hub threads/messages/feed, onboarding and others. With two rows they get an error, which they treat as "no household". That means a silent 403 or a solo-only view.
  - The helpers that do use `.order(created_at desc).limit(1)` (`src/lib/accountAccess.ts:44-61`, `src/app/api/era/actions/route.ts:19-31`) don't filter `partner_user_id is not null`. If the newest active row is a pending invite, the partner resolves to `null`.
- **Fix:** one shared `getActiveHouseholdLink(supabase, userId)` in `src/lib/` that filters `active = true AND partner_user_id IS NOT NULL`, orders by `created_at desc`, `limit(1)`. Replace every inline lookup with it. Hand the owner a migration (Hard Rule #24/#26): deactivate stale duplicates, then add a partial unique index so a user can't have two active claimed links.
- **UAT:** on test accounts A and B linked: from A, generate a new invite code (Settings → Household) without unlinking. **Expect** B still sees A's shared accounts, shared recurring payments, hub threads, and ERA artifacts; B can still confirm A's shared recurring payment.

---

## 5. Time zones

### T1

**🟠 Server-side "today" is UTC for user-local money dates.**

- **Evidence:** `new Date().toISOString().split("T")[0]` is the default or only date in:
  - debt settlement, always (`src/app/api/debts/[id]/route.ts:147`)
  - debt create (`debts/route.ts:136`, `debts/standalone/route.ts:38`)
  - future-payment confirm (`future-payments/[id]/confirm/route.ts:71`)
  - transfers (`transfers/route.ts:340`)
  - drafts (`drafts/route.ts:97`)
  - the main transaction create (`src/services/transaction.service.ts:475-477`)
  - hub stats (`hub/stats/route.ts:43`)
  - balance history `effective_date` (`src/lib/balance.ts:126`)
- **Impact:** in Beirut (UTC+2 winter, UTC+3 summer), anything recorded between 00:00 and 01:59/02:59 local is dated **yesterday**. On the billing-cycle start day it lands in the previous month's totals and envelopes.
- **Fix:** the client sends its local date (ERA Ask already does: `localDate` in `src/app/api/era/ask/route.ts:114-117`). Make `date` required on these routes (or `localDate` as the fallback), and never derive a calendar date from server UTC. Debt settle accepts an optional `date` like the others.
- **Test to add:** with the clock mocked to `2026-11-04T23:30:00Z` and `localDate = 2026-11-05`, the stored date is `2026-11-05`.
- **UAT:** at 00:30 Beirut time, settle a debt and confirm a future payment without editing the date. **Expect** today's local date on both transactions, and both count in the current billing month.

---

## 6. Notifications

### N1

**🟠 Item reminders can buzz twice.**

- **Evidence:** the cron selects due alerts with `last_fired_at IS NULL` (`src/app/api/cron/item-reminders/route.ts:137`), sends the push (`:380`), and only **then** marks `last_fired_at` (`:392`). Two overlapping invocations (a scheduler retry, or a run slower than the schedule interval with `maxDuration = 60`) both send. A run that dies mid-loop re-sends everything it already pushed but hadn't marked.
- **Fix:** claim before sending: `update item_alerts set last_fired_at = now() where id = $1 and last_fired_at is null returning id`. Skip if nothing is returned. On send failure, either keep the claim (and log) or explicitly clear it for retry.
- **UAT:** create a reminder for 2 minutes from now. Call the cron endpoint twice in parallel (`curl … & curl …`) at the due minute. **Expect** one push and one notification row.

---

## 7. Functional defects

### G1

**🟡 Guest Portal bot and chat.**

- The bot's `bedtime`, `menu`, `allergy_check` and `recipes_list` answers are hard-coded for one celebration night ("tonight is special", a fixed Toters link). They ignore `bio_data.sleep_time`/`wake_time` and the recipe book. `allergy_check` never checks allergens (`src/app/api/guest-portal/bot/route.ts:53-117`).
- `bot` and `chat` don't check that the tag is still `is_active` (`bot/route.ts:39-43`, `chat/route.ts:80-86`). A deactivated portal keeps answering and keeps pushing to the host's phone.
- `chat` POST accepts `sender` from the guest, so a guest can post as `"host"` or `"bot"` (`chat/route.ts:66-104`). It also has no length limit or Zod schema.
- **Fix:** derive answers from `bio_data` and recipes (keep the special-night text as an optional `bio_data` override), require `is_active` on every guest route, force `sender: "guest"` on the public POST, and add a Zod schema with a message length cap.
- **UAT:** deactivate the portal, then send a chat message from an old guest session → **expect 403** and no push. Ask the bot "when do you sleep?" → **expect** the configured `sleep_time`.

### K1

**🟡 Recipe search fails on punctuation.**

- **Evidence:** `src/app/api/recipes/route.ts:59-61` puts raw `search` inside `.or(...)`. A comma or parenthesis breaks the PostgREST filter. The Catalogue route already fixed this with `toIlikeTerm` (`src/app/api/catalogue/items/route.ts:82-87`).
- **Fix:** reuse `toIlikeTerm`.
- **UAT:** search recipes for `salt, pepper` and `(vegan)` → **expect** results (or an empty list), never an error.

### X1

**🟡 Raw `fetch()` mutations (Hard Rule #6).**

- **Evidence:** 100 client-side `fetch()` calls with `POST`/`PATCH`/`DELETE` across 30+ files. The biggest are `ShoppingListView.tsx` (13), `useNotifications.ts` (8), `CategoryManagerDialog.tsx` (8) and `features/hub/hooks.ts` (7). Money paths include the balance set in `AccountBalance.tsx:216`, `:251` and `:298` (with a comment explaining why), the transaction Undo (`useDashboardTransactions.ts:537`, `:1344`), `FuturePaymentsDrawer.tsx:91` and `TemplateQuickEntryButton.tsx`.
- **Impact:** on a bad mobile network these hang with no timeout. The Undo button can spin forever while the toast disappears.
- **Disposition:** existing **R44** (guard _new_ mutations). This sweep adds the backlog of existing ones. Migrate money paths first.

### ERA understanding gaps (from the Gym report printed by `pnpm test`)

Not new bugs: the Gym already measures them, and the owner's model decision is pending ("Decision: undecided", model responses unrecorded). They're recorded here because they are the most visible ERA failures. On the deterministic path (B): "spent twelve dollars on coffee", "I paid forty five for gas" and "transfer fifty from wall it to savings" → `no_action`. Spelled-out numbers from voice dictation aren't parsed. "show my expenses" → `no_action`. "how much did Rita spend…" → answered for **self** instead of the partner. Path C reports **1 wrong-money** outcome. Owner: Hub & ERA Gym; no new ID.

---

## UAT run sheet

Use test accounts or a local stack. Never production data (Hard Rule #26). Tick in order:

| ✓   | Bug | One-line check                                                             |
| --- | --- | -------------------------------------------------------------------------- |
| ☐   | S1  | Logged out, `?all=true` on allergies/drinks → 401                          |
| ☐   | M1  | Delete → Undo keeps the same id; Recycle Bin empty                         |
| ☐   | M2  | Double-tap confirm (recurring / future / split / debt) → one transaction   |
| ☐   | O1  | Offline expense older than 24 h → still pending, not gone; 401 → kept      |
| ☐   | O2  | Replay with flaky network → one transaction                                |
| ☐   | M3  | Replayed confirm with a non-writable `account_id` → 404, balance unchanged |
| ☐   | M4  | Split delete → restore → both balances back                                |
| ☐   | S2  | `Bearer undefined` on a deployment without `CRON_SECRET` → 401             |
| ☐   | H1  | New invite code while linked → partner still sees shared data              |
| ☐   | T1  | 00:30 Beirut settle/confirm → today's local date                           |
| ☐   | N1  | Two parallel cron calls → one push                                         |
| ☐   | M5  | String or over-remaining settle amount → 400                               |
| ☐   | S3  | `pnpm build` passes; `/pm` still gated                                     |
| ☐   | G1  | Deactivated portal → 403; bot uses configured times                        |
| ☐   | K1  | Recipe search with a comma → no error                                      |

## Disposition

| Source label   | Canonical owner/ID                                      | Acceptance/boundary                                            |
| -------------- | ------------------------------------------------------- | -------------------------------------------------------------- |
| S1             | Hub & ERA **HUB-118** (new)                             | Guest bulk reads require host auth; S1 UAT passes              |
| M1             | Budget **BUD-89** (new)                                 | Undo restores the original row; never recreates                |
| M2             | Budget **BUD-90** (new); related BUD-64, BUD-85, BUD-63 | Each confirm/settle posts money at most once per period/row    |
| O1             | Hub & ERA **HUB-119** (new); related HUB-116            | No queued write is dropped without the user choosing to        |
| O2             | Hub & ERA **HUB-120** (new)                             | Transaction creates are idempotent under replay                |
| M3             | Budget **BUD-91** (new)                                 | Balance writes only to `canWrite` accounts, with the real type |
| M4             | Budget **BUD-92** (new); related BUD-24                 | Split restore re-applies both legs exactly once                |
| S2             | Notifications & Alerts **NOTIF-22** (new)               | All cron routes refuse when the secret is unset                |
| H1             | Hub & ERA **HUB-121** (new)                             | One link resolver; DB enforces one active claimed link         |
| T1             | Budget **BUD-93** (new)                                 | No money date is derived from server UTC                       |
| N1             | Notifications & Alerts **NOTIF-23** (new)               | Alert claimed before send                                      |
| M5             | Budget **BUD-94** (new)                                 | Zod on money routes; finite delta asserted                     |
| S3             | PM Tooling **R83** (new)                                | One `src/proxy.ts` or none; `/pm` gate intact                  |
| G1             | Hub & ERA **HUB-122** (new)                             | Guest routes require active tag; sender forced                 |
| K1             | Kitchen **KIT-28** (new)                                | Recipe search sanitized                                        |
| X1             | PM Tooling **R44** (existing)                           | Incorporated: existing-call backlog listed above               |
| ERA Gym misses | Hub & ERA Gym (existing)                                | Incorporated: no new ID                                        |
