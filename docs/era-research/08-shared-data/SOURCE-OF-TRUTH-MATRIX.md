---
created: 2026-11-04
updated: 2026-11-04
type: research
status: draft
owner: Elio
evidence_cutoff: "commit 77141d1 (2026-11-04). Code and migrations read; trigger and function names for pre-August objects come from the 2026-08-04 RLS snapshot (migrations/db-state.json). The billing-period comparison in §3 re-ran the repo's logic in a scratch script with TZ=Asia/Beirut; nothing ran against app data."
---

# ERA Source-of-Truth Matrix

[README](README.md) · [Glossary](DOMAIN-GLOSSARY.md) · [Entity Map](ENTITY-MAP.md) · **Source of Truth** · [Contracts](CROSS-MODULE-CONTRACTS.md)

For each fact a person relies on: where the authoritative value lives, who writes it, which copies exist, and what wins when they disagree. Columns are CURRENT IMPLEMENTATION; the last column is PROPOSED DESIGN.

## 1. Facts and their authority

| Fact | Authoritative store | Writers | Copies and caches | When copies disagree today | Proposed rule |
|---|---|---|---|---|---|
| Account balance | `account_balances.balance` | `adjustAccountBalance()` (deltas, 12 files); manual set upserts directly (`src/app/api/accounts/[id]/balance/route.ts:182-190`) | `account_balance_history` (audit), persisted query cache (`account-balance` in `STABLE_KEYS`), `localStorage balance_cache_*`, service-worker `api-cache-v1`; an unused formula `computeAccountBalance()` (`src/lib/balance.ts:172`, no callers) | Stored value shows; caches can show the previous value (01-atlas F-U1) | Stored balance wins. History must explain every change: a delta without a history row is a defect, not a second truth |
| A spend's amount, date, account, category | `transactions` row | `transaction.service.ts`, drafts, recurring confirm, debt settle, statement import (five writers) | Hub feed rows (`create_feed_on_transaction` trigger, snapshot), Activity Log, ERA artifact title, notification text | Copies are snapshots; edits to the row are not re-applied to feed or notification text | Row wins; copies display "as of" and link by id |
| A spend's day | `transactions.date` (local date, sent by the client: `MobileExpenseForm.tsx:897`) | as above; server falls back to UTC day when missing (T1/BUD-93) | `account_balance_history.effective_date` defaults to the **UTC** day (`src/lib/balance.ts:126`) | A 00:40 Beirut spend is dated the 12th, its history row the 11th | The transaction's local date is the day; history copies it |
| Whether a recurring bill is paid this period | `recurring_payments.next_due_date` + `last_processed_date` | confirm, mark-covered | Suggested matches computed in `src/features/recurring/commitments.ts` | Due date advances without a compare-and-set (M2) | Due-date row wins; confirm claims it first |
| When a reminder is due | `reminder_details.due_at` (instant) | `create_item_complete`; browser-direct updates | `item_alerts.trigger_at`, Google event, notification rows | Alerts are rewritten separately in `EditItemDialog.tsx:395-452`, `WebEventFormDialog.tsx:513-572` and `PATCH /api/items/[id]` (`:152-172`); `useUpdateReminderDetails()` changes `due_at` without touching alerts (`src/features/items/useItems.ts:505-578`) | `due_at` wins; alerts and Google events are derived and rebuilt from it |
| Whether an occurrence is done | `item_occurrence_actions` (recurring) / `items.status` (one-off) | `completeItems.ts`, `/api/items/[id]/actions`, browser-direct undo, `health_set_dose`, fitness functions, trip cascade | `health_medication_logs`, `fitness_sessions`, Activity Log, notification `action_taken` | Mirrors are kept by triggers in both directions; the in-app notification "Complete" writes a missing column and reports success (Mutation Integrity Audit #6) | Occurrence action wins; mirrors follow it |
| Whether a dose was taken | `health_medication_logs.taken_at` for a `scheduled_at` slot | `health_set_dose`; trigger from Schedule | Schedule occurrence action | Two-way trigger with a session flag (`app.health_mirror_off`) | Unchanged: dose log is the health record, occurrence action is the schedule record, one write updates both |
| Whether a workout happened | `fitness_sessions` | Fitness RPCs; trigger from Schedule | Schedule occurrence action, rewards | Same mirror pattern | Unchanged |
| Bought on the shopping list | `hub_messages.checked_at` | Hub PATCH (raw `fetch`) | Activity Log | Toggle is read-then-flip (Audit #8) | Row wins; writes state the target value (`checked: true`), never "flip" |
| Pantry quantity | `inventory_stock` | Inventory routes; `restock_inventory_item` | `estimated_runout_date` (trigger) | Shopping does not restock (01-atlas CAPABILITY-MAP §1.3) | Stock row wins |
| A recipe was cooked | `cooking_logs` | cooking-log route | `recipes.times_cooked`, `last_cooked_at`; `meal_plans.status = cooked` | Counters and meal status are written separately | Logs win; counters are derived |
| Trip dates and state | `trips.start_date`, `end_date`, `status` | trip routes; activation RPC (cascade off) | `trip_side_effects` ledger (only when the cascade runs) | — | Trip row wins |
| Who is in the household | Active `household_links` row with both ids set | `claim_household_code` | `household_members` (unused), per-request partner lookups | Two active rows break `.maybeSingle()` lookups (H1) | Newest active link with `partner_user_id` set wins (Major Bug Sweep H1 fix) |
| A person's display name | `auth.users` metadata via `/api/household` | Auth | `profiles.full_name` (may be empty) | Names fall back to an email prefix | `/api/household` wins |
| Person colour | Derived from each viewer's theme | — | — | Undefined when both use the same theme | Unchanged until it causes a reported problem |
| Billing month start, week start | `user_preferences.date_start` (`mon-1`) | Settings | `localStorage` copy (`useDatePreferences.ts:14-26`) | — | Preference row wins |
| A person's time zone | **None stored.** Device zone at call time; `notification_preferences.timezone` (default `UTC`, no code in `src/` writes it); `health_medications.timezone`; `fitness_plans.timezone` | — | — | Daily nudges set for "07:00" are evaluated in `UTC` unless that row holds another zone (`src/app/api/cron/daily-reminder/route.ts:182`), while the settings screen says "Times are in your local timezone" (`NotificationSettings.tsx:766`). Live values UNKNOWN | See [CROSS-MODULE-CONTRACTS §2.1](CROSS-MODULE-CONTRACTS.md#21-dates-and-time-zones) |
| Item ↔ Google event | `items.google_event_id` | `src/lib/gcal/sync.ts` | Google Calendar | `gcal-reconcile` heals drift daily (if scheduled) | Item wins; Google is a backup copy |
| Template ↔ live item | `catalogue_items` (definition) and `items` (instance) linked both ways: `items.source_catalogue_item_id`, `catalogue_items.linked_item_id` | Catalogue routes; snapshot triggers `sync_catalogue_to_items`, `sync_is_chore_from_catalogue`, `sync_catalogue_on_item_delete` | `catalogue_item_calendar_history` | Two pointers can disagree | Definition fields win on the template; occurrence facts (done, postponed) win on the item |
| Medication ↔ reminder items | `health_medications` | `health_rebuild_medication_reminders` | `items` with `source_medication_id` (rebuilt on save) | Item ids change on each save (01-atlas F-U8) | Medication wins; item ids are not stable references |
| What happened, for the household | `household_activity` (append-only, trigger) ⛁ | trigger on 80 tables | — | — | Activity is history, never a source for current state |
| What ERA did | `era_actions` ⛁ | `recordEraArtifacts()` | assistant message metadata | — | Artifact points at the source; the source wins |
| Who should see a row | Module flags (`is_public`, `is_private`, `shared_with_household`, `scope`) + RLS | Owners | `household_activity.audience` (snapshot at write time) | Activity audience can differ from the row's current visibility after a change | Current source visibility wins (the Activity Log route already applies it, Feature Map `activity-log.md`) |

## 2. Mirrors kept by the database

| Mirror | Direction | Mechanism | Evidence |
|---|---|---|---|
| Schedule completion → medication log | both | `health_mirror_occurrence_action` on `item_occurrence_actions`; `health_set_dose` writes both sides with the trigger switched off | `migrations/2026-09-26_healthcare-medications.sql:397-562` |
| Schedule completion → fitness session | both | `fitness_mirror_occurrence_action`; `fitness_write_completion` / `fitness_unwrite_completion` | `migrations/2026-10-12_fitness-module.sql:468-487`, `:1114-1176` |
| Any registered table → Activity Log | one way | `capture_household_activity` | `migrations/2026-09-26_household-activity-log.sql:305-328` |
| Catalogue ↔ items | both | `sync_catalogue_to_items`, `sync_is_chore_from_catalogue`, `sync_catalogue_on_item_delete` | Function names in the 2026-08-04 snapshot; bodies not in repo migrations |
| Transactions → Hub feed | one way | `create_feed_on_transaction` | Snapshot function list |
| Owner columns | one way | `health_*_sync_owner` triggers set `managing_user_id` | `migrations/2026-09-26_healthcare-medications.sql:101-123`, `2026-10-12_fitness-module.sql:91` |

## 3. Derived values computed in more than one place

### 3.1 Billing period

| Implementation | File | Used by | Handles start days 29–31 |
|---|---|---|---|
| `startOfCustomMonth()` + `getDefaultDateRange()` | `src/lib/utils/date.ts:55-95` | ERA budget resolver (`budget.ts:73`), dashboard default range (`DashboardClientPage.tsx:151`) | Clamps to the month's length |
| `getCustomBillingPeriod()` | `src/features/recurring/commitments.ts:90-125` | Recurring commitment console | Clamps (UTC date arithmetic) |
| `getThisMonthRange()` | `src/app/dashboard/DashboardClientPage.tsx:107-125` | Dashboard "This month" in every non-journal mode (`:160-167`) | **No**: `setDate()` overflows |
| `startOfCustomMonth()` (second copy) | `src/features/preferences/useDatePreferences.ts:136-148` | No importers | **No** |
| Calendar month | `src/lib/ai/context.ts:31-36` | Legacy AI chat budget context | Ignores the preference |

**Worked example** (logic re-run with `TZ=Asia/Beirut`; fictional preference):

| Today | Start day | `getDefaultDateRange` | `getCustomBillingPeriod` | `getThisMonthRange` (dashboard) |
|---|---|---|---|---|
| 2026-11-04 | 25 | 2026-10-25 → 2026-11-24 | same | same |
| 2026-11-04 | 31 | 2026-10-31 → 2026-11-29 | same | **2026-10-31 → 2026-12-30** |
| 2026-11-30 | 31 | 2026-11-30 → 2026-12-30 | same | **2026-10-31 → 2026-12-30** |
| 2027-03-05 | 31 | 2027-02-28 → 2027-03-30 | same | **2027-03-03 → 2027-04-30** |

With a start day of 29, 30 or 31, the dashboard's default month and ERA's "how much did I spend this month" use different periods. Whether the owner's preference is in that range is UNKNOWN.

### 3.2 Other repeated derivations

| Value | Implementations | Evidence |
|---|---|---|
| Local `YYYY-MM-DD` from a `Date` | `formatDate()` / `yyyyMmDd` (`src/lib/utils/date.ts:9-19`), `toISODate()` (`useDatePreferences.ts:120`), `formatDateOnly()` (UTC, `commitments.ts`); 53 server and client sites use `toISOString().split("T")[0]` (UTC day) | grep at the stated commit |
| Occurrences in a range | `getOccurrencesInRange`, `expandOccurrencesInRange`, inline RRule in `SwipeableItemCard.tsx:462` and `cron/item-reminders/route.ts:434`, unused `src/lib/schedule/expandOccurrences.ts` | 01-atlas ARCHITECTURE F-D4 |
| The partner's user id | ~54 inline lookups | 01-atlas F-D7 |
| Category across accounts and partners | `resolveCategoryRef()` (`src/lib/merchantMatch.ts:58`, used by the expense form and ERA capture); statement import's own `categoryOf()` (Feature Map `statement-import.md`) | — |
| Where a record opens | `eraArtifact()` routes (`src/lib/era/artifacts.ts`), `notifications.action_url`, service-worker URLs (`/expense?tab=reminder&item=…`, `public/sw.js:1301`), Activity Log context | — |

## 4. Tie-break rules (PROPOSED)

1. **Source row beats every copy.** Feed rows, Activity entries, artifacts, notifications, caches and Google events are views. None of them may be read back to decide current state.
2. **The module that owns the user's action owns the fact.** A taken dose is Healthcare's fact; the completed occurrence is Schedule's fact; each module keeps its own, and one write updates both (the pattern `health_set_dose` already uses).
3. **Explicit beats inferred.** A client-supplied local date beats a server-derived one; a stored zone beats the device zone only for scheduled background work.
4. **Newest correction beats older value only through the module's correction path** (see [CROSS-MODULE-CONTRACTS §2.5](CROSS-MODULE-CONTRACTS.md#25-corrections)); a background job never overwrites a human edit.
5. **Unknown stays unknown.** When a write's outcome is uncertain (lost response), the source is re-read; no copy is used to guess.
