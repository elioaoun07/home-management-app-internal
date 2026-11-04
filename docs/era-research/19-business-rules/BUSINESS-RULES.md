---
created: 2026-11-04
updated: 2026-11-04
type: research
status: draft
owner: Elio
evidence_cutoff: "commit cacf59d (2026-11-04); application code and migrations unchanged since 53443c0. Rules read from source, migrations and vault docs. Tests were located and read by name and scope, not run (no node_modules in this container). No production data, deployment or device was inspected."
---

# ERA Business Rules

[README](README.md) · **Business Rules** · [Scenario Catalogue](SCENARIO-CATALOGUE.md) · [Open Decisions](OPEN-DECISIONS.md)

The 32 rules that most change what a person sees, pays, is reminded of, or shares. Rules were chosen by user outcome: money totals and balances first, then reminders that fire or not, then what the partner sees, then data that can be lost.

Each rule records **Current** (what the code does at the cutoff), **Intent** (what repo documents say, when that differs or adds something), and **Question** (a business decision the code cannot settle; IDs point to [OPEN-DECISIONS.md](OPEN-DECISIONS.md)). Current behaviour is described, not endorsed. "Tests" lists test files that exercise the rule; "no test found" means none was found by name or by the symbol's call sites. Defect IDs (`M2`, `T1`, `H1`…) are from `ERA Notes/10 - Project Management/Research/Major Bug Sweep.md`; "Audit #n" is `ERA Notes/01 - Architecture/Mutation Integrity Audit.md`.

## Contents

| Area | Rules |
|---|---|
| Money | BR-01 – BR-13 |
| Dates and time zones | BR-14 |
| Schedule | BR-15 – BR-23 |
| Kitchen, health, fitness | BR-24 – BR-26 |
| Household and sharing | BR-27 – BR-28 |
| Lifecycle and offline | BR-29 – BR-30 |
| ERA and AI | BR-31 – BR-32 |

---

## Money

### BR-01 Balance direction depends on the account type

- **Trigger:** a transaction is created or deleted.
- **Inputs:** amount, account `type` (`expense` / `income` / `saving`), `is_debt_return`.
- **Result:** expense account −amount; income or saving +amount; a debt return always +amount; delete applies the negative.
- **Exceptions:** callers that cannot read the account default the type to `expense` (M3), which gives an income account the wrong sign.
- **Implementation:** `getBalanceDelta()`, `src/lib/balance-utils.ts:18-42`.
- **Tests:** `src/lib/balance-utils.test.ts`.

### BR-02 A spend moves the stored balance at once, separately from the spend itself

- **Trigger:** any money write (12 files call `adjustAccountBalance()`).
- **Conditions:** compare-and-swap on the exact stored value, up to 5 attempts.
- **Result:** `account_balances.balance` changes and one `account_balance_history` row is written.
- **Exceptions:** if the swap keeps losing or errors, the transaction row stays, the balance does not change, an `error_logs` row is written and the request still succeeds (`src/lib/balance.ts:66-122`; Audit #2). The manual "set balance" writes the balance directly, not through this function (`src/app/api/accounts/[id]/balance/route.ts:182-190`).
- **Tests:** `src/lib/balance.test.ts`.
- **Intent:** "All balance writes through `adjustAccountBalance()`" (Design Doctrine §4). **Question:** Q-01.

### BR-03 Transfers take money from one account and give it to another, in each account's currency

- **Inputs:** amount, `returnedAmount`, type `self` / `household`, optional `toAmount`.
- **Result:** source −net, destination +(`toAmount` if given, else net); for household transfers net = amount − returned (`getTransferDeltas()`, `src/lib/balance-utils.ts:54-66`).
- **Conditions:** a client id makes a retried transfer a replay, not a second transfer (`src/app/api/transfers/route.ts`, `replayTransfer`).
- **Exceptions:** the two legs are separate writes (BUD-63). Server default date is the UTC day (T1).
- **Tests:** `src/app/api/transfers/route.test.ts`, `src/features/transfers/hooks.test.ts`, `src/lib/balance-utils.test.ts`.

### BR-04 The partner sees every one of the other person's transactions; private ones are masked but counted

- **Trigger:** listing transactions (`GET /api/transactions` → `SupabaseTransactionService`).
- **Conditions:** an active household link exists.
- **Result:** rows from both people on any of their accounts are returned. A row with `is_private = true` that the viewer does not own or collaborate on has description and category withheld; its **amount is kept and counts toward shared totals** (`src/services/transaction.service.ts:195-230`, `:270`). `accounts.is_public` only controls whether the partner's account appears in the expense-form picker (comment at `:199-200`); `?household=true` lists all partner accounts (`src/app/api/accounts/route.ts:44-58`).
- **Exceptions:** trip spend counts a partner's private row in the total but shows it opaquely (`src/lib/tripSpend.ts`).
- **Tests:** no test found for the masking rule.
- **Intent:** Feature Map `household-sharing.md`: "the partner's data should be visible by default". Design Doctrine §3 lists "partner sees a hidden account" as a visibility leak. **Question:** Q-02.

### BR-05 Split bills: the partner's share and who sees which amount

- **Inputs:** owner amount, optional total bill, ownership filter (`all` / `mine` / `partner` / `both`).
- **Result:** suggested partner share = total − owner amount, only when the total is larger (`getSuggestedSplitAmount()`, `src/lib/utils/splitBill.ts:13-26`). After completion, "both" shows owner + collaborator, "mine" shows the viewer's own part, "partner" the other part (`getTransactionDisplayAmount()`). Completion moves the collaborator's chosen account. Only an uncompleted split the viewer owns can be removed (`canRemoveSplit()`).
- **Exceptions:** completion is not exactly-once (M2); delete reverses both legs but restore re-applies only the payer's (M4/BUD-92).
- **Tests:** `src/lib/utils/splitBill.test.ts`, `src/app/api/transactions/[id]/split.test.ts`, `src/features/transactions/splitMutation.test.ts`, `src/lib/notifications/sendSplitBillNotification.test.ts`.

### BR-06 LBP change is recorded beside the dollar amount, not instead of it

- **Inputs:** USD amount paid, LBP change received, LBP rate; both LBP numbers in **thousands** (90 = 90,000 LBP per USD).
- **Result:** the transaction `amount` is the full USD paid and the balance moves by it; `lbp_change_received` is stored separately (`src/components/expense/MobileExpenseForm.tsx:887-902`). The form shows "actual value" = paid − change ÷ rate.
- **Exceptions:** spending totals, envelopes and analytics use `amount`; no code found that subtracts the change (`grep lbp_change_received` finds only form, list item, service and recurring code).
- **Tests:** no test found.
- **Intent:** `ERA Notes/02 - Standalone Modules/Transactions/LBP Change Feature.md` gives the formula `actual_value_usd = amount_paid - lbp_change_received / lbp_exchange_rate`. **Question:** Q-03.

### BR-07 The billing month starts on the person's chosen day

- **Inputs:** today, month start day 1–31 (second half of `user_preferences.date_start`, e.g. `mon-25`).
- **Result:** most code clamps the start day to the month's length (`src/lib/utils/date.ts:55-95`, `src/features/recurring/commitments.ts:90-125`).
- **Exceptions:** the dashboard's default range uses an unclamped copy (`src/app/dashboard/DashboardClientPage.tsx:107-125`) and gives a different, longer period for start days 29–31 ([08-shared-data SOURCE-OF-TRUTH-MATRIX §3.1](../08-shared-data/SOURCE-OF-TRUTH-MATRIX.md#31-billing-period)). The legacy AI chat uses the calendar month (`src/lib/ai/context.ts:31-36`).
- **Tests:** `src/lib/utils/date.test.ts`, `src/features/recurring/commitments.test.ts`; none for the dashboard copy.
- **Intent:** billing month "uses day 1–31 set by user" (`CLAUDE.md`). **Question:** Q-04.

### BR-08 A recurring bill's status this period

- **Inputs:** `next_due_date`, `last_processed_date`, recurrence type, best matching transaction date, today, month start day.
- **Result, in order:** `monitor` if flagged; `covered` if processed inside the billing period; `matched` if a matching transaction is inside it; monthly bills: `missed` if due before the period started, `due_this_period` if due by today, else `upcoming`; other bills: `missed` if due before today, `due_this_period` if due today, else `upcoming` (`getRecurringCommitmentStatus()`, `src/features/recurring/commitments.ts:162-255`).
- **Exceptions:** monthly bills get the whole billing period as grace; weekly and daily bills get none.
- **Tests:** `src/features/recurring/commitments.test.ts`.

### BR-09 A logged spend is suggested as a recurring bill's payment when it scores at least 55

- **Inputs:** bill name, amount, account, category; transactions in the billing period.
- **Result:** score = name contained (45) or ≥50 % word overlap (32) or partial overlap (×20), + amount within 5 % (30) or 20 % (18), + same account (12), + category (10), + subcategory (5); keep ≥ 55, best first (`findRecurringTransactionMatches()`, `commitments.ts:280-330`).
- **Exceptions:** a suggestion changes nothing until "mark covered" (`POST /api/recurring-payments/[id]/mark-covered`).
- **Tests:** `commitments.test.ts`, `src/app/api/recurring-payments/[id]/mark-covered/route.test.ts`.

### BR-10 Confirming a recurring bill posts a spend and moves the due date past the payment day

- **Result:** a transaction is inserted, the balance moves, `next_due_date` advances by the recurrence until it is after the paid date (at most 60 steps, `advanceRecurringPastDate()`, `commitments.ts:134-160`). Monthly bills keep their preferred day, clamped to short months (`calculateNextDueDate()`, `src/lib/recurring.ts:67-89`).
- **Exceptions:** no claim on the old due date, so two confirms post twice; a failed advance is ignored and the next confirm posts again (M2; Audit #3). Recurring bills never post themselves: no cron auto-posts (01-atlas CAPABILITY-MAP §1.1).
- **Tests:** `src/app/api/recurring-payments/[id]/route.test.ts`, `src/lib/recurring.test.ts`.
- **Intent:** Feature Map `recurring-payments.md` says a cron auto-posts due payments. **Question:** Q-05.

### BR-11 Settling a debt

- **Inputs:** `amount_returned`; the debt and its original transaction.
- **Result:** a "Debt return from …" transaction is posted on the **original transaction's account** with `is_debt_return = true` (always +amount, BR-01); `returned_amount` becomes min(old + returned, original); the debt closes when the remainder ≤ 0.01; an archived debt with money returned reopens to `open` (`src/app/api/debts/[id]/route.ts:141-215`).
- **Exceptions:** no server cap, so returning more than is owed posts the full amount while `returned_amount` stops at the original (M5); a debt with no linked transaction posts no money; the date is the UTC day (T1); two settles at once both post (M2).
- **Tests:** no route test found.
- **Question:** Q-06.

### BR-12 Statement import never counts money twice and never moves money it cannot undo

- **Inputs:** statement rows, the chosen account, existing transactions and transfers.
- **Result:** a row matches a logged transaction within 7 days before to 1 day after its posting date and within an amount tolerance of max(1, 10 % of the amount) in the account's currency (`src/lib/statement-reconcile.ts:18-25`, `:482`); a matched row is stamped without moving money; a duplicate is recognised by a fingerprint that includes the account; only the outgoing leg of an own-account exchange is acted on; each account's balance moves once per commit (Feature Map `statement-import.md` gotchas).
- **Exceptions:** rows are written before the revert ledger; a ledger failure returns 503 with rows present and balances unmoved (Audit #9). Deleting an imported transaction normally keeps its fingerprint, so re-importing skips it; only batch Revert frees it.
- **Tests:** `src/lib/statement-reconcile.test.ts`, `src/lib/statement-revert.test.ts`, `src/lib/bank-statement-parser*.test.ts`, `src/features/statement-import/sessionModel.test.ts`, `src/app/api/statement-import/{commit,reconcile}/route.test.ts`.

### BR-13 A trip's spending

- **Result:** the trip account's transactions plus transactions tagged with the trip, deduplicated by id, **expense accounts only**, summed per currency without conversion; tagging never moves money (`src/lib/tripSpend.ts`, Feature Map `trips.md`).
- **Exceptions:** a partner's private row counts in the total but its details are hidden (BR-04). Debts and future payments cannot be tagged.
- **Tests:** `src/lib/tripSpend.test.ts`, `src/services/transaction.service.trip-tag.test.ts`.

## Dates and time zones

### BR-14 Which day a record belongs to

- **Current:** the expense form sends the device's local date (`MobileExpenseForm.tsx:897`). Server routes that receive no date use the UTC day: debts, transfers, future-payment confirm, drafts, hub stats and transaction create (T1/BUD-93, 53 `toISOString().split("T")[0]` sites). Balance history always uses the UTC day unless the caller passes one; transaction create does not (`src/lib/balance.ts:126`, `transaction.service.ts:551-555`). Daily nudges evaluate "07:00" in `notification_preferences.timezone`, default `UTC`, which no client code writes (`src/app/api/cron/daily-reminder/route.ts:182`). Medications evaluate dose times in their own stored zone (`src/lib/health/medicationSchedule.ts` header).
- **Intent:** Hard Rule 18 "UTC at rest"; `Timezone Handling.md` line 75: "No server-side timezone conversion is needed."
- **Tests:** `src/lib/utils/date.test.ts`, `src/lib/smartTextParser.time.test.ts`; none for server fallbacks.
- **Question:** Q-07, Q-08.

## Schedule

### BR-15 A reminder, task or event exists only if everything it needs was saved

- **Trigger:** `POST /api/items` from a form, ERA or offline replay.
- **Result:** item, details, rule, alerts and prerequisites are written in one SQL call (`create_item_complete`); the reply carries a receipt `complete` / `partial` / `not_started` / `rolled_back` / `unknown` (`src/lib/items/createContract.ts`). With a due time and no alerts, one push alert at the due time is added unless `suppress_default_alert` (`createContract.ts:99`).
- **Exceptions:** if the migration `2026-10-11_atomic-item-create.sql` is not installed, every create fails (01-atlas F-U7). An unknown outcome is never retried automatically; the offline queue holds it for review.
- **Tests:** `src/lib/items/create.database.test.ts`, `src/app/api/items/route.test.ts`, `src/lib/OfflineSyncEngine.item.test.ts`.

### BR-16 Who may change a schedule item

- **Result (API):** the creator, the responsible person, or the partner when `is_public` (`canMutateItem()`, `src/app/api/items/[id]/route.ts:26-46`).
- **Exceptions:** most edits go straight to the database from the browser and are decided by RLS, not this function (01-atlas F-D3). RLS for these tables after 2026-08-04 is UNKNOWN.
- **Tests:** no direct test found.

### BR-17 Who is reminded

- **Result:** the responsible person (or the creator if unset); with `notify_all_household`, every user on any active link of the creator (`src/app/api/cron/item-reminders/route.ts:288-316`).
- **Exceptions:** a stale active link row adds whoever is on it.
- **Tests:** no test found.

### BR-18 When an alert fires late, or not at all

- **Current:** the cron looks back 12 hours. A one-time alert up to 12 h late still fires; older ones never fire. A recurring alert more than 1 h late is moved to its next occurrence **without** sending (`item-reminders/route.ts:92-104`). The push is sent before the alert is marked fired, so overlapping runs can send twice (N1/NOTIF-23). After firing, a recurring alert's next time is computed in UTC from the rule (`:425-445`), while screens show occurrences at the original local wall-clock time (`adjustOccurrenceToWallClock()`, used in `dayOccurrences.ts:64` and calendar views). After a daylight-saving change the push and the screen disagree by an hour (Scenario S09).
- **Exceptions:** nothing fires if no scheduler calls the cron (UNKNOWN).
- **Tests:** no test found for the cron.
- **Question:** Q-09.

### BR-19 Completing an occurrence

- **Result:** an `item_occurrence_actions` row (`completed`) is upserted on item + occurrence time + action, alerts are deactivated, an item with its own prerequisites returns to dormant, the Google event is refreshed (`src/lib/items/completeItems.ts:115-205`). Healthcare and Fitness mirror the completion through database triggers.
- **Exceptions:** chores store the **actual** completion time as the occurrence time and the planned slot in metadata (`src/features/items/bulkComplete.ts:105-107`), unlike other items. The in-app notification "Complete" writes a column that does not exist and reports success (Audit #6). Completing an item never wakes items waiting on it (BR-23).
- **Tests:** `src/features/items/bulkComplete.test.ts`, `src/lib/items/bulk.database.test.ts`.

### BR-20 Deleting a schedule item

- **Current:** online from Catalogue, Event dialog or Assign → permanent delete; from the day planner → archive with Undo; offline or via ERA → soft delete to the Recycle Bin (01-atlas F-D2).
- **Tests:** none covering the difference.
- **Question:** Q-10.

### BR-21 Which chores can be placed where

- **Result:** placing a chore creates one occurrence in the chosen week, never a permanent rule. Past days and days that already hold that chore are disabled. Meeting the period target does not disable days: further placements are "extra" (amber), except flexible routine items, which stop at their target. A chore with no recurrence ("any time") has no target. A Monday–Sunday week can span two monthly periods; each day uses its own period (Feature Map `chores.md`; `src/features/chores/choreWeek.ts:420-475`).
- **Tests:** `src/features/chores/choreWeek.test.ts`, `choreGroups.test.ts`, `optimisticPlacement.test.ts`.

### BR-22 A trip pauses the household's routine (currently switched off)

- **Current:** `TRIP_CASCADE_ENABLED = false` (`src/features/trips/cascade.ts:9`); activation only creates the trip account. The disabled database functions, as captured in the 2026-08-04 snapshot, skip each chore once at the trip's start date, pause recurring events for the trip, cancel one-time events inside it, skip meal plans, and for solo trips hand the traveller's items to the partner (01-atlas F-U6).
- **Tests:** none for the cascade.
- **Question:** Q-11.

### BR-23 Dormant items wake on NFC taps only

- **Current:** an item with prerequisites starts dormant and hidden. Only an NFC state change wakes it (`src/app/api/nfc/[slug]/tap/route.ts:138`). The picker also offers "item completed", "time window" and "schedule"; the last two are stubs that never pass, and nothing emits "item completed" (01-atlas F-U12).
- **Tests:** `src/app/api/items/[id]/prerequisites/route.test.ts` (setup, not waking).
- **Intent:** the Prerequisites Overview marks "item completed" as implemented. **Question:** Q-12.

## Kitchen, health, fitness

### BR-24 Who a meal feeds

- **Result:** a meal shows from `planned_date` through `eats_through_date`; it feeds someone on a day only if its status is `planned`, `shopping_added` or `cooked`, and `for_user_id` is empty or that person (`src/lib/mealPlanCoverage.ts:9-42`). A skipped meal still shows but feeds nobody.
- **Tests:** `tests/meal-plan-coverage.test.ts`.

### BR-25 Medication doses

- **Result:** dose times are wall-clock times in the medication's stored zone (defaulted from the device when created, `src/app/healthcare/MedicationsSection.tsx:66`); a dose exists if `starts_at ≤ slot < ends_at`; a log matches its slot by exact instant (`src/lib/health/medicationSchedule.ts` header). Saving a course rebuilds its reminders (new item ids) as urgent daily items. Completing the reminder logs the nearest slot within ±1 day; only the managing person may log doses (`migrations/2026-09-26_healthcare-medications.sql:397-562`).
- **Exceptions:** reminder pushes follow BR-18 (UTC after firing), so after a daylight-saving change the push can be an hour off the checklist slot.
- **Tests:** `src/lib/health/medicationSchedule.test.ts`.

### BR-26 Fitness rewards

- **Result:** 100 XP for a completed training session, 25 for recovery, at most one award of each per local day; weekly quests 150/50/50; level = 1 + ⌊XP ÷ 500⌋; ranks at levels 1, 5, 10, 20; badges at 1 and 10 workouts, first record, four weeks (`public.fitness_rules()`, `migrations/2026-10-12_fitness-module.sql:319-339`). Rewards are computed on the server and can be revoked.
- **Tests:** `src/lib/fitness/fitness.database.test.ts` (asserts the rules equal `FIXTURE_RULES`), `progress.test.ts`, `offline.test.ts`.

Allergen warnings (keyword matching with an over-warning bias, allergies always visible to the household; `src/lib/health/allergenMatch.ts`, tested in `allergenMatch.test.ts`) are documented as "a warning aid, never a safety guarantee" and are not expanded here.

## Household and sharing

### BR-27 The household and the partner

- **Result:** two people are a household while one `household_links` row is active with both ids. Partner lookups are written separately in about 54 places, some with `.maybeSingle()` (fails on two rows) and some with newest-first (01-atlas F-D7; H1/HUB-121).
- **Exceptions:** an unclaimed invite is an active row with no partner; it can mask the real link.
- **Tests:** `src/lib/accountAccess.test.ts` (one helper).

### BR-28 Shopping list notifications

- **Result:** the other member is notified about new shopping rows unless the thread is private (`shouldNotifyPartner()`, `src/features/hub/chatNotificationPolicy.ts`), on both the immediate and the batched path.
- **Tests:** `src/features/hub/chatNotificationPolicy.test.ts`.

## Lifecycle and offline

### BR-29 Deleted things are recoverable for 30 days

- **Result:** registered modules (9) soft-delete; the purge cron deletes them permanently after 30 days (`src/app/api/cron/purge-recycle-bin/route.ts:18`). Restoring a transaction re-applies its balance (payer leg only, M4).
- **Exceptions:** the purge cron accepts `Bearer undefined` when the secret is unset (S2).
- **Tests:** `src/app/api/recycle-bin/restore/route.test.ts`.

### BR-30 What happens to changes made offline

- **Result:** up to 200 queued changes of up to 64 KB; replayed in order; 4xx responses drop the change (fitness kept for review); anything older than 24 h is dropped (fitness kept) (`src/lib/offlineQueue.ts:6-14`, `:422-435`; `src/lib/offlineSyncEngine.ts`). Item creates are fenced so a lost reply cannot create twice.
- **Exceptions:** shopping check-offs, edits and most notification actions are not queued at all (01-atlas F-U9). ERA never queues.
- **Tests:** `src/lib/offlineQueue.bulk.test.ts`, `src/lib/OfflineSyncEngine.{bulk,item,fitness}.test.ts`.
- **Question:** Q-13.

## ERA and AI

### BR-31 ERA may only change things the person confirmed or the native rules allow

- **Result:** model proposals become confirm cards and run only after Confirm; a card runs once; conditional money requests ("confirm the draft if my salary lands") cannot become immediate writes; recurring reminder requests are sent to Schedule instead of creating a one-time item; every ERA write leaves an artifact (AI Assistant Overview, HUB-108/109; `src/features/era/intents/resolvers/schedule.ts:156-185`).
- **Tests:** `src/features/era/useEraAskAI.test.ts`, `capabilities/*.test.ts`, `intents/speechAct.test.ts`, `intents/resolvers/schedule.hardening.test.ts`, `artifacts.contract.test.ts`.

### BR-32 How much AI ERA may use

- **Result:** a sentence the native router fails on may be sent to the model automatically at most 15 times a day per person (`src/app/api/era/ask/route.ts:48`); 5 model requests a minute per person, 10 a minute across all users (in practice the household), repeat requests within 5 s deduplicated, 1,000,000 tokens a month (`src/lib/ai/rateLimit.ts:9-15`); a failed quota read refuses the call.
- **Tests:** `src/app/api/era/ask/route.test.ts`.
- **Question:** Q-14.

---

## Contradictions found

| # | Contradiction | Rules |
|---|---|---|
| C-01 | "All balance writes through `adjustAccountBalance()`" vs a manual balance set that bypasses it, and a function that hides failures | BR-02 |
| C-02 | "Partner sees a hidden account" is a visibility leak (Doctrine §3) vs the partner receiving every private-account transaction amount | BR-04 |
| C-03 | LBP doc defines an "actual value"; totals use the full USD paid | BR-06 |
| C-04 | One billing month (`CLAUDE.md`) vs four period calculations | BR-07 |
| C-05 | "A cron auto-posts due payments" vs manual confirm only | BR-10 |
| C-06 | "No server-side timezone conversion is needed" vs nudges in UTC and pushes off by an hour after DST | BR-14, BR-18 |
| C-07 | Medication doc says checklist and server reminders "agree even when the phone travels" vs pushes advanced in UTC | BR-25 |
| C-08 | Prerequisites "item completed ✅ Implemented" vs never emitted | BR-23 |
| C-09 | One meaning of "occurrence time" in Schedule vs actual time in Chores | BR-19 |
| C-10 | Delete is recoverable via ERA and offline, permanent online in three screens | BR-20 |

## Acceptance gaps

Rules with user-visible effect and **no test found**: BR-04 (masking), BR-06 (LBP), BR-07 dashboard copy, BR-11 (debts), BR-14 server fallbacks, BR-16, BR-17, BR-18 (cron), BR-20, BR-22. Rules whose acceptance is owner UAT still pending per Master Books: BR-15 on devices, BR-25, BR-31 with the current model. No rule above has a recorded owner acceptance of the *rule itself*; acceptance records cover features.
