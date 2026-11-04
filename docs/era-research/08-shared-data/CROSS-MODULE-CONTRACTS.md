---
created: 2026-11-04
updated: 2026-11-04
type: research
status: draft
owner: Elio
evidence_cutoff: "commit 77141d1 (2026-11-04). Everything under 'Contract' and 'Transition' is PROPOSED DESIGN; nothing here changes a schema, a migration or data."
---

# ERA Cross-Module Contracts

[README](README.md) · [Glossary](DOMAIN-GLOSSARY.md) · [Entity Map](ENTITY-MAP.md) · [Source of Truth](SOURCE-OF-TRUTH-MATRIX.md) · **Contracts**

Six small contracts for facts that already cross module boundaries, each justified by consumers that exist in code today, plus a staged way to adopt them. "Contract" here means a written rule plus, where useful, one shared function or type in `src/lib/`. None of them needs a new table. Sections marked CURRENT restate evidence from the other files; everything else is PROPOSED DESIGN.

## 1. The use cases that need shared rules

| # | Real cross-module use case | Modules involved | What goes wrong without a shared rule (CURRENT) |
|---|---|---|---|
| U1 | ERA writes something, the Activity Log shows it, the person opens it, then undoes or restores it | ERA, Activity Log, Recycle Bin, owning module | Three reference vocabularies (`era_actions.entity_type`, `household_activity.source_table`, `notifications` typed columns + `action_url`) and several route builders ([ENTITY-MAP §2](ENTITY-MAP.md#2-identifier-kinds)) |
| U2 | A scheduled occurrence is completed and another module mirrors it | Schedule, Healthcare, Fitness, Chores, Trips, Notifications, ERA | `occurrence_date` means "planned" for Schedule and "actual" for Chores; three triggers depend on its exact semantics ([ENTITY-MAP §3](ENTITY-MAP.md#3-equivalent-concepts-represented-differently)) |
| U3 | "How much did we spend this month?" asked in different places | Dashboard, ERA, Budget, Recurring, legacy AI chat | Four billing-period implementations disagree for start days 29–31 ([SOURCE-OF-TRUTH-MATRIX §3.1](SOURCE-OF-TRUTH-MATRIX.md#31-billing-period)) |
| U4 | Something must happen at a wall-clock time while the app is closed | Item alerts, daily nudges, medication doses, fitness slots, recurring payments | No stored per-person zone; server "today" is UTC in 53 places |
| U5 | Delete, undo, restore | Every module with a Recycle Bin entry, ERA native actions, toasts, Google Calendar, trip reversal | "Delete an item" has three outcomes; transaction Undo re-creates instead of restoring (M1) |
| U6 | Give something to the partner and tell them | Chores, Hub shopping, packing lists, meal plans, trips, budget envelopes, health | Subject, doer, editor and recipient are separate fields only in Schedule; budget uses role-relative text |
| U7 | Attach a file now, open it a year later | Receipts, trip documents, Hub photos and voice, Catalogue documents, wardrobe | Hub stores one-year signed URLs; others store paths in columns named `*_url` or `*_path` |
| U8 | Use "the same category" across accounts and partners | Statement import, merchant mappings, expense form, ERA capture, budget envelopes | Two resolvers (`resolveCategoryRef()`, statement import's `categoryOf()`) |

Each contract below names the use cases it serves. A contract with no current consumer is listed in §2.7 as not recommended.

## 2. Contracts

### 2.1 Dates and time zones

Serves U3, U4, U2. Consumers today: `src/lib/utils/date.ts` (58 importers), `src/features/recurring/commitments.ts`, `src/app/dashboard/DashboardClientPage.tsx`, ERA resolvers, cron routes, `/api/era/ask` (already accepts `localDate`, `src/app/api/era/ask/route.ts:114`; `EraRequestContext.timeZone`, `src/features/era/types.ts:320`).

**Kinds of time.** Every date-like field is exactly one of:

| Kind | Type in code | Use for | Never |
|---|---|---|---|
| `Instant` | ISO string with `Z`, `timestamptz` | Something that happens at one moment everywhere: a due time, an alert, a dose slot, a log entry | Parse a bare `YYYY-MM-DD` into one |
| `LocalDate` | `YYYY-MM-DD` string, SQL `date` | A day as the person lives it: a spend's day, a meal, a trip day, a billing period, a vaccine due day | Derive it from a server clock (`toISOString().split("T")[0]`) |
| `WallTime` + `Zone` | `HH:MM` + IANA name | A time that recurs or is planned in a place: dose times, nudge times, trip itinerary times | Store a wall time without saying which zone it is in, when a server job will act on it |

**Rules.**

1. **A user's day comes from the user.** Writes that carry a day send it (`localDate`) from the client, as the expense form and ERA Ask already do. A server that must choose a day without one uses the stored zone of the record (medication, fitness plan, notification preference) and otherwise refuses with 400 rather than guessing UTC.
2. **One billing-period function.** `getDefaultDateRange()` / `startOfCustomMonth()` in `src/lib/utils/date.ts` is the definition, because it already clamps day 29–31 and matches `getCustomBillingPeriod()`. Dashboard and preferences copies call it. The function takes a `LocalDate`, not a `Date`, so server and client agree.
3. **One all-day rule.** An all-day reminder and an all-day event both mean "this `LocalDate`, no alert time". Until a schema change is approved, the existing encodings stay (`event_details.all_day`; reminder `due_at` at local noon + `metadata_json.all_day`), and one helper `isAllDay(item)` reads both.
4. **Server jobs need a zone per job, not per server.** Item alerts are already `Instant`s and need none. Daily nudges, medication doses and fitness weeks use their row's zone. The notification-preference zone must be written by the client when preferences are saved (today nothing writes it, [SOURCE-OF-TRUTH-MATRIX §1](SOURCE-OF-TRUTH-MATRIX.md#1-facts-and-their-authority)).
5. **Display converts, storage does not.** Instants are shown in the viewer's zone. A trip itinerary time is shown as written (destination wall time) and is not converted.

**Failure behaviour.** Missing `localDate` on a money write → 400 "date required", nothing written. Unknown zone string → reject the preference save. DST gap (a wall time that does not exist on the change day) → moved forward by the gap, which is what JavaScript `setHours()` does inside `adjustOccurrenceToWallClock()` (`src/lib/utils/date.ts:138-150`) today; the contract writes that behaviour down instead of leaving it implicit.

### 2.2 Recurrence and occurrence identity

Serves U2, U4, U5. Consumers: Schedule hooks and routes, `src/lib/items/completeItems.ts`, `src/features/items/bulkComplete.ts`, `src/features/chores/choreWeek.ts`, medication and fitness mirror triggers, `cron/item-reminders`, trip cascade RPCs, ERA schedule resolver.

**Rules.**

1. **Two engines, no third** (Design Doctrine §4). Item recurrence uses RRULE (`item_recurrence_rules`). Payments keep `recurring_payments`. Templates (Catalogue patterns), medication courses and fitness plans are **generators**: they create items with an RRULE or flexible slots and keep no engine of their own.
2. **An occurrence is identified by `(item_id, scheduled Instant)`.** `occurrence_date` always holds the scheduled instant from the expansion (or the flexible slot's planned time). The time it was actually done goes in a separate field: today `metadata_json.done_at` (code-only change); later a column if approved. Chores currently invert this (actual time in `occurrence_date`, plan in `metadata_json.planned_for`); the transition moves them, see §4 Stage 2.
3. **One expansion function** (`expandOccurrencesInRange()` in `src/lib/utils/dayOccurrences.ts`) for every surface and the alert cron. `src/lib/schedule/expandOccurrences.ts` is either wired in as its implementation or deleted; two "canonical" functions is the defect.
4. **A range of skipped days is a pause, not a set of single skips.** Trip activation already uses `recurrence_pauses` for recurring events; chores should too. A single `item_occurrence_actions` row skips exactly one occurrence.
5. **Mirrors follow the occurrence action.** A module that mirrors completion (Healthcare, Fitness) reacts to `action_type = 'completed'` inserted or updated and to its deletion, keyed by the scheduled instant. Any change to these semantics updates both mirror functions in the same migration.
6. **Edits follow the "this / this and future / all" choice** already in `EditScopeDialog.tsx`: this = exception with override; future = end the rule and start a new one; all = edit the rule. Past occurrence actions are never rewritten by a rule edit.

**Failure behaviour.** A completion whose instant matches no expansion is stored and flagged in the item's history rather than dropped. A double completion is absorbed by the existing upsert on `(item_id, occurrence_date, action_type)`.

### 2.3 Participation: who it concerns, owns, may change, and is told

Serves U6, U1. Consumers: `canMutateItem()` (`src/app/api/items/[id]/route.ts:26-46`), item-reminder recipient logic (`cron/item-reminders/route.ts:288-316`), Chores responsibility hand-over, Hub `assigned_to`, packing `assigned_to`, meal `for_user_id`, trip `scope`, budget `assigned_to`, health `managing_user_id`, Activity Log `audience`.

**Roles.** Every shared record can answer six questions. A module stores only the ones it needs; the rest default as shown.

| Role | Question | Default when not stored |
|---|---|---|
| Owner | Whose record is it? | `user_id` |
| Subject | Who is it about or for? | Owner (whole household for household-scoped rows such as meal plans with `for_user_id = null`) |
| Doer | Who is expected to act? | Subject |
| Viewers | Who may see it? | Module default (see below) |
| Editors | Who may change it? | Owner and doer; partner too when the row is shared |
| Recipients | Who is told about due times and changes? | Doer; both when explicitly "notify household" |

**Person references.** A role holds a household member's user id. Role-relative values (`budget_allocations.assigned_to = 'user' | 'partner' | 'both'`) are translated to user ids at the API boundary by one function, `resolveParticipants(row, ownerId, household)`, so screens and ERA never interpret "partner" themselves. Colours are derived from the resolved user id (Hard Rule 14), never from the role word.

**Visibility defaults stay per module** (they encode decisions: Outfits private, Catalogue shared, health private), but every module documents its default in one table in its vault doc, and new modules use the opt-in form `is_public` / `shared_with_household`.

**Notification rule.** A due-time push goes to recipients. A change notification ("Lina moved Pick up dry cleaning to Thursday") goes to the doer when the actor is someone else. Nobody is notified about their own action.

**Failure behaviour.** If the household link cannot be resolved (H1), the record is treated as owner-only and the response says so; it is never silently shown to nobody.

### 2.4 Lifecycle and deletion

Serves U5, U1. Consumers: `src/lib/recycleBin/registry.ts` (9 sources), `src/features/era/nativeActions.ts` (already restores through the Recycle Bin), item hooks, toasts, `cron/purge-recycle-bin`, `syncItemToGoogleCalendar`, trip completion.

**States.** `active` → `archived` (owner hides it; reversible; not in the Recycle Bin) → `deleted` (`deleted_at` set; recoverable for 30 days) → `purged`. Progress states (`cooked`, `packed`, `closed`, `completed`) are not lifecycle.

**Rules.**

1. **A user-facing delete is a soft delete** for every registered table, online and offline. Hard deletes are reserved for purge and for derived rows that are rebuilt from a source (alerts, mirrors).
2. **Undo of a delete restores the same id** through the Recycle Bin route (the ERA path), never re-creates.
3. **Delete takes its derived effects with it, restore brings them back:** alerts deactivated/reactivated (only those it deactivated), Google event removed/re-pushed, money legs reversed/re-applied (M4). The registry entry lists those effects.
4. **References survive deletion as references.** Activity rows, artifacts and notifications keep the id; opening a deleted target shows "in Recycle Bin" with Restore, and "no longer available" after purge.
5. **Generated items are owned by their generator.** Deleting a medication or fitness plan deletes its generated items; deleting one generated item from Schedule is refused or redirected to the generator.

**Failure behaviour.** A restore that cannot re-apply a side effect (account no longer accessible) restores nothing and says why.

### 2.5 Corrections

Serves U1, U5, U8. Consumers: transaction PATCH, balance history `change_type` (`2026-11-03_balance-history-change-types.sql`), statement-import revert ledger, recipe and fitness plan versions, Catalogue `revision`, recurrence exceptions, ERA amend (`src/features/era/intents/resolvers/amend.ts`), trip side-effect ledger.

| Fact class | Correction method (already used somewhere) | Rule |
|---|---|---|
| Money | Edit the row; post the delta through `adjustAccountBalance()` with a history row whose `change_type` names the correction | History is never edited; corrections are new rows |
| Imported batches | Ledger + revert planner (`src/lib/statement-revert.ts`) | Revert never overwrites a newer human edit (already the planner's rule) |
| Definitions people iterate on (recipes, PT plans) | New version, pointer to the active one | Logs keep the version they used (`cooking_logs.version_id`) |
| Shared editable records (Catalogue) | Optimistic `revision` check | A stale edit gets 409 and the current value |
| One occurrence | Exception with override payload | The rule is untouched |
| History (activity, artifacts, logs) | None | Append-only; a correction appears as a new event |

**Failure behaviour.** A correction whose base changed since it was read is refused with 409 for money and Catalogue rows (the latter already does).

### 2.6 References

Serves U1, U7, U8. Consumers: `src/lib/era/artifacts.ts` (≈14 entity kinds with routes and Recycle Bin mapping), Activity Log open links, notification deep links (`DeepLinkHandler.tsx`, `notifications.action_url`, service-worker URLs), Recycle Bin, trip side effects, storage signed-URL routes (receipts, outfits, trip documents, Catalogue documents).

**`EntityRef`.** `{ kind, id }` where `kind` comes from one vocabulary: the ERA artifact entity list, extended with the Activity Log's source tables that people can open. One function `routeFor(ref, context?)` builds the deep link (it exists today as the artifact registry's `href`). Activity, artifacts, notifications and the service worker call it instead of building URLs. The database keeps its current columns; the mapping from `source_table` to `kind` is a code table.

**`StoredFileRef`.** `{ bucket, path }`. Rows store the path; a signed URL is created on read and never stored. Hub voice and photo rows that hold signed URLs are converted in a data-repair stage (owner-run).

**When to use what.**

| Situation | Reference |
|---|---|
| Parent and child in one module | Foreign key |
| Link between modules with one fixed target type (transaction → trip, item → medication) | Foreign key, `ON DELETE SET NULL` where the source can outlive the target |
| "Something happened to any entity" (activity, artifacts, notifications, side-effect ledgers) | `EntityRef` |
| A person | Household member user id (§2.3) |
| A file | `StoredFileRef` |
| Lists of ids (`room_ids`, `shopping_message_ids`) | Allowed only with a documented clean-up on delete |
| Names or free text | Display only, never identity (debt counterparties stay text until §2.7 changes) |

**Category references (U8)** use `resolveCategoryRef()` (`src/lib/merchantMatch.ts:58`): id on the same account, then slug, then name. Statement import's `categoryOf()` becomes a caller of it.

### 2.7 Not recommended now

| Idea | Why not now |
|---|---|
| A shared People/Contacts entity joining debts, guests, health profiles and Catalogue contacts | No current flow reads across them; the only cross-use (ERA recording a debt "for Sami") works with text. Revisit when a feature needs "everything about Sami" |
| One Task table for items, shopping rows, packing, checklists | Each has different lifecycle and sharing; the cost is a migration of the busiest tables for no named consumer |
| One completion table | Mirrors (§2.2 rule 5) already give the one cross-module case a working pattern |
| A unified category system | Only money categories cross modules |
| A generic event bus | The Activity Log trigger and artifact registry already cover the consumers |
| A per-person time-zone column | Useful, but a schema change; Stage 3 decision D-3 below |

## 3. Worked examples (fictional data)

People: **Rami** (blue theme) and **Lina** (pink theme), one household, both in Beirut (UTC+2 after 25 Oct 2026).

**W1 — A chore done late during a trip.** "Water plants" is a weekly flexible chore, planned for Thu 19 Nov 2026 18:00. Lina does it on Fri 20 Nov at 09:10.

- CURRENT: the completion stores `occurrence_date = 2026-11-20T07:10:00Z` and `metadata_json.planned_for` = the Thursday slot. A household trip activated for 18–25 Nov (if the cascade were on) would have skipped only the 18 Nov occurrence ([01-atlas F-U6](../01-atlas/ARCHITECTURE.md#f-u6-the-trip-cascade-that-would-return-is-only-visible-in-a-stale-snapshot)).
- PROPOSED: `occurrence_date = 2026-11-19T16:00:00Z` (the plan), `metadata_json.done_at = 2026-11-20T07:10:00Z`. The trip writes one `recurrence_pauses` row 18–25 Nov. Week view, Activity Log ("Lina completed Water plants · planned Thu"), and any mirror agree on which occurrence was done.

**W2 — "This month" with a start day of 31.** Today is 4 Nov 2026.

- CURRENT: the dashboard's default range is 31 Oct → 30 Dec; ERA's `spend.month` uses 31 Oct → 29 Nov ([SOURCE-OF-TRUTH-MATRIX §3.1](SOURCE-OF-TRUTH-MATRIX.md#31-billing-period)).
- PROPOSED: both call `getDefaultDateRange(31, "2026-11-04")` → 31 Oct → 29 Nov. Acceptance: the dashboard total and ERA's answer for the same account are equal.

**W3 — Handing over a packing item and a chore.** Rami assigns "Pack the first-aid kit" (trip packing) and "Take out recycling" (chore) to Lina.

| Role | Packing item | Chore |
|---|---|---|
| Owner | Rami (`user_id`) | Rami |
| Subject | the household trip | the household |
| Doer | Lina (`assigned_to`) | Lina (`responsible_user_id`) |
| Editors | trip editors | Rami, Lina |
| Recipients | Lina is told once ("Rami gave you Pack the first-aid kit") | Lina gets the due-time push |

Both rows are outlined pink on both phones (Lina's colour), whoever is looking.

**W4 — ERA delete, then restore from the Activity Log.** Rami tells ERA "delete the dentist reminder" for Thu 12 Nov 16:00 (alert 15:30).

1. CURRENT: ERA calls `DELETE /api/items/[id]` → `deleted_at` set, alert deactivated, Google event removed; artifact `{ kind: "reminder", id }`.
2. PROPOSED: the Activity Log row "Rami deleted Dentist" opens through `routeFor({kind:"reminder", id})`, which sees `deleted_at` and offers Restore.
3. PROPOSED: Restore keeps the same id, reactivates the alert only because 15:30 on 12 Nov is still ahead, and re-pushes the Google event (the restore route already calls the Google sync; alert reactivation is not verified).
4. PROPOSED: the same result if Rami had deleted it from the Event dialog online (today that path hard-deletes).

**W5 — A receipt and a voice note a year later.** Lina attaches a receipt photo to "Pharmacy $18.40" on 4 Nov 2026 and sends a voice note "get the blue one" in the Groceries thread.

- CURRENT: the receipt stores a path and gets a fresh signed URL on each open; the voice note stores a signed URL valid until about 4 Nov 2027.
- PROPOSED: both store `{bucket, path}`; on 20 Dec 2027 both still open.

**W6 — A 07:00 nudge.** Rami sets the daily "log your spending" nudge to 07:00.

- CURRENT: the cron evaluates 07:00 in `notification_preferences.timezone`, default `UTC`; no client code writes it, so it fires at 09:00 Beirut unless the row holds another zone (live value UNKNOWN).
- PROPOSED: saving preferences sends `Asia/Beirut`; the push arrives at 07:00 Beirut, and at 07:00 Paris time if Rami saves preferences while travelling and chooses to update the zone.

**W7 — Correcting an imported spend.** A statement import created "SPINNEYS 27.90" on Wallet; Rami changes it to $29.70 two days later.

- The edit posts a −1.80 delta with a history row naming the correction. A later batch revert of that import sees a newer human edit and leaves the row alone (current planner rule).

## 4. Staged transition

No stage below is performed by this document. Stages 0–2 change code only; Stage 3 needs owner-run SQL and is optional.

| Stage | What changes | Entry criteria | Acceptance | Rollback |
|---|---|---|---|---|
| **0. Pin current behaviour** | Characterisation tests for: the four billing-period functions (W2 table), occurrence keys written by `completeItems.ts` and `bulkComplete.ts`, `canMutateItem`, recipient selection, artifact routes | None | Tests describe today's outputs, including the divergent ones, marked "known divergence" | Delete tests |
| **1. Shared helpers, no behaviour change** | `src/lib/`: `LocalDate` type and `toLocalDate()`, `billingPeriod()` wrapping `getDefaultDateRange`, `resolveParticipants()`, `routeFor()` lifted from `src/lib/era/artifacts.ts`, `StoredFileRef` helpers, `isAllDay()` | Stage 0 green | Helpers imported by at least one consumer each; all Stage 0 tests unchanged | Revert the commit |
| **2. Move consumers** | Dashboard and preferences call `billingPeriod()`; money routes require `localDate`; notification preferences send the zone; Activity Log, notifications and SW deep links call `routeFor()`; Schedule deletes go through the API (01-atlas P1); chores write the planned instant + `done_at`; trip cascade code (still disabled) uses pauses for chores | Owner decisions D-1, D-2 | W1–W6 acceptance examples pass; Stage 0 "known divergence" tests flip to the agreed value | Per consumer; each is a small commit |
| **3. Data and schema (owner-run, optional)** | Data repair: Hub `voice_url` / photo URLs → paths; backfill `notification_preferences.timezone`; optional columns: per-person zone, `item_occurrence_actions.done_at`, `deleted_at` on tables that lack it | Owner approval per item; `db-state.json` refreshed; migration files written first (Hard Rule 24) | Verification queries in each runbook; W5, W6 pass on the phone | Each runbook carries its rollback |
| **4. Retire duplicates** | Delete `src/features/preferences/useDatePreferences.ts#startOfCustomMonth`, `getThisMonthRange`, the unused expander or the duplicate, the unused `item_attachments`/`household_members` (owner SQL) | Stage 2 shipped for a month without regressions | Import scan shows no callers | Restore from Git |

**Interruptions and partial completion.** Each Stage 2 move is one consumer per commit, so a half-done stage leaves some screens on the old helper and some on the new one; the Stage 0 tests show which. Chores written before the occurrence-key change keep `planned_for`; readers accept both shapes until a Stage 3 backfill, if ever approved.

## 5. Decisions that need the owner

| ID | Decision | Default if no answer |
|---|---|---|
| D-1 | Is "delete" always recoverable (soft) for Schedule items? (same as 01-atlas D-1) | Work proceeds on helpers; delete paths unchanged |
| D-2 | May chores change what `occurrence_date` means (planned instant), with actual time kept separately? | Readers accept both shapes; writers unchanged |
| D-3 | Add a per-person time zone, or keep zones per record? | Per record; client sends the zone on preference save |
| D-4 | Should money writes without a client date be refused (400) or default to the stored zone's day? | Refuse |
| D-5 | Convert stored Hub signed URLs to paths (data repair)? | New uploads store paths; old links expire |
| D-6 | Which household notifications are wanted for hand-overs (W3)? | None added; only due-time pushes |
| D-7 | Keep Catalogue's "shared by default" while other modules are private by default? | Keep; document per module |
