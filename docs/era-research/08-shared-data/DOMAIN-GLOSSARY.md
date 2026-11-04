---
created: 2026-11-04
updated: 2026-11-04
type: research
status: draft
owner: Elio
evidence_cutoff: "commit 77141d1 (2026-11-04); application code and migrations unchanged since 53443c0. Read from migrations/schema.sql, migrations/*.sql, src/ and ERA Notes. No database, deployment or device was inspected."
---

# ERA Domain Glossary

[README](README.md) · **Glossary** · [Entity Map](ENTITY-MAP.md) · [Source of Truth](SOURCE-OF-TRUTH-MATRIX.md) · [Contracts](CROSS-MODULE-CONTRACTS.md)

One entry per concept that more than one module uses. Each entry gives the meaning ERA's code actually gives the word (CURRENT IMPLEMENTATION), where documents say something else (DOCUMENTED INTENT), and the term this research proposes (PROPOSED DESIGN). UNKNOWN marks what only the live database or the owner can answer. Field names come from `migrations/schema.sql` unless another file is cited.

## People and households

| Term | Current meaning in code | Notes |
|---|---|---|
| **User** | A Supabase `auth.users` id. Every owner column (`user_id`, `responsible_user_id`, `collaborator_id`, `recipient_user_id`, `managing_user_id`, `assigned_to` on Hub rows and packing items) holds one. | The only person identity with an id that every module accepts. |
| **Household** | One active `household_links` row pairing `owner_user_id` and `partner_user_id`. Hub, recipes, meal plans, shopping groups, notifications and ERA actions store its row id as `household_id`. | Not an entity of its own: the "household id" is the link row's id, so re-linking creates a new household id (H1 in the Major Bug Sweep notes that stale active rows exist). `household_members` exists in the schema with roles `owner/partner/viewer` but no code reads it. |
| **Partner** | The other user on the active link. Resolved per request in about 54 places (45 API route files and 9 client modules). | Always derived, never stored on a record except as a user id. |
| **Person colour** | Derived, not stored: the viewer's theme (`pink` or other) decides their own colour, the partner gets the other one (`CLAUDE.md` Hard Rule 14). | If both people choose the same theme the derivation cannot tell them apart; UNKNOWN whether that happens. |
| **Display name** | `/api/household` resolves names from `auth.users` via the service role; `profiles.full_name` is a client-readable mirror that can be empty (Feature Map `statement-import.md`, BUD-47). | Two name sources. |
| **Named non-user** | Free text in four places: `debts.debtor_name`, `guest_*.guest_name`, `health_profiles.name` (a family member who may have no account; optional `user_id`), Catalogue contacts (`catalogue_items` in the `contacts` module, created by ERA `contact.create`). | No link between them. |
| **Role-relative person value** | `budget_allocations.assigned_to` is text `user / partner / both`, relative to the row's `user_id`. | The only owner field that is not a user id. |

**PROPOSED.** "Person" in shared contracts means a household **member** user id. Named non-users stay module-local until a use case needs to join them (see [CROSS-MODULE-CONTRACTS §2.7](CROSS-MODULE-CONTRACTS.md#27-not-recommended-now)).

## Participation (who, for each record)

| Term | Meaning | Current fields that carry it |
|---|---|---|
| **Owner** | The account that holds the record and can always change or delete it. | `user_id` almost everywhere; `managing_user_id` in Healthcare; `sender_user_id` on Hub messages; `created_by` on threads, topics, groups |
| **Subject** ("who it concerns") | The person the fact is about or for. | `health_profiles.user_id` / `name`; `meal_plans.for_user_id` (null = everyone); `trips.scope` (`solo` = traveller only); `budget_allocations.assigned_to`; for transactions, the account owner |
| **Doer** ("who is responsible") | The person expected to act. | `items.responsible_user_id` (NOT NULL); `hub_messages.assigned_to`; `trip_packing_items.assigned_to` |
| **Viewer** | Who may see it. | Opt-in flags `is_public` (accounts, items, day plans default false; Catalogue tables default **true**); opt-out flags `is_private` (transactions, recurring payments, Hub threads, default false); `shared_with_household` (health profiles); `scope` (trips); `hidden_for` (per-user hide on Hub messages); `audience` (Activity Log snapshot) |
| **Editor** | Who may change it. | Items: owner, doer, or partner when `is_public` (`canMutateItem`, `src/app/api/items/[id]/route.ts:26-46`). Elsewhere implied by RLS and route checks; RLS state is UNKNOWN after 2026-08-04 |
| **Recipient** | Who is notified. | Items: `responsible_user_id` (fallback `user_id`), or every member when `notify_all_household` (`src/app/api/cron/item-reminders/route.ts:288-316`). Hub: the other member, except private threads. Splits: the collaborator. PM: `PM_OWNER_USER_ID` |
| **Actor** | Who performed a change. | `household_activity.actor_user_id` (`auth.uid()` in the trigger), `checked_by`, `completed_by`, `changed_by`, `deleted_by` |

**PROPOSED.** Keep these seven words distinct in every new contract. Today "owner" is used for both owner and subject, and "responsible" for both doer and recipient.

## Time

| Term | Current meaning | Storage |
|---|---|---|
| **Instant** | A moment in absolute time. | `timestamptz`, ISO with `Z` (Hard Rule 18). Examples: `reminder_details.due_at`, `event_details.start_at`, `item_alerts.trigger_at`, `health_medication_logs.scheduled_at` |
| **Local date** | A calendar day as the person experiences it, no time zone attached. | SQL `date` or `YYYY-MM-DD` text: `transactions.date`, `meal_plans.planned_date`, `day_plans.plan_date`, `trips.start_date`, `recurring_payments.next_due_date`, `account_balance_history.effective_date`, `fitness_sessions.local_date`, `health_vaccines.next_due_on` |
| **Wall-clock time** | A time of day with no zone. | `time without time zone`: `trip_places.scheduled_time`, `item_flexible_schedules.scheduled_for_time`, `catalogue_items.preferred_time`, `notification_preferences.quiet_start`; text `HH:MM` in `health_medications.dose_times` |
| **Zone** | An IANA name. | Stored only in `notification_preferences.timezone` (default `UTC`), `health_medications.timezone` (default `UTC`) and `fitness_plans.timezone`. There is **no per-person zone**; most code uses the device's zone at the moment of the call. |
| **Today** | On the client, the device's local day (`formatDate()`, `src/lib/utils/date.ts:9`). On the server, often UTC's day (`new Date().toISOString().split("T")[0]`, 53 sites; T1/BUD-93). | — |
| **All-day** | Events: `event_details.all_day`. Reminders: `due_at` at local noon plus `items.metadata_json.all_day = true` (Feature Map `chores.md`). | Two conventions. |
| **Billing month** | The period starting on the person's chosen day 1–31. Day is the second half of `user_preferences.date_start` (text like `mon-1`), parsed with `split("-")` where needed (e.g. `src/features/era/intents/resolvers/budget.ts:72`). | Computed by at least four functions (see [SOURCE-OF-TRUTH-MATRIX §3](SOURCE-OF-TRUTH-MATRIX.md#3-derived-values-computed-in-more-than-one-place)). `budget_allocations.budget_month` is free text. |
| **Week** | Week start is the first half of `date_start`; Fitness uses Monday weeks (`fitness_plans.activated_week`). | — |

## Recurrence and occurrences

| Term | Current meaning |
|---|---|
| **Item rule** | One RFC 5545 RRULE per item in `item_recurrence_rules` (`rrule`, `start_anchor`, `end_until`), expanded with DTSTART in UTC (`buildFullRRuleString`, `src/lib/utils/date.ts:179`). |
| **Occurrence** | One expansion of an item rule, identified by `(item_id, occurrence_date)` where `occurrence_date` is a `timestamptz`. The same key is used by `item_occurrence_actions`, `item_alerts`, `item_alert_suppressions`, `item_subtasks`, `item_subtask_completions` and `item_recurrence_exceptions.exdate`. |
| **Occurrence action** | `completed / postponed / cancelled / skipped` on one occurrence (`item_occurrence_actions.action_type`), upserted on `item_id + occurrence_date + action_type` by `completeItems.ts` (`src/lib/items/completeItems.ts:115-150`). |
| **Exception** | A changed or skipped occurrence (`item_recurrence_exceptions`, optional `override_payload_json`), chosen through "this one / all future / all" (`EditScopeDialog.tsx`). |
| **Pause** | A date range when an item does not recur (`recurrence_pauses`). |
| **Flexible routine** | A target count per period (week/month) placed on days by the person (`item_flexible_schedules`: `period_start_date`, `scheduled_for_date`, `occurrence_index`). Used by Chores and Fitness. |
| **Recurring payment** | A separate engine: `recurrence_type` (`daily/weekly/monthly/yearly`) + `recurrence_day` + an advancing `next_due_date` (`recurring_payments`). |
| **Catalogue recurrence** | A template's pattern (`catalogue_items.recurrence_pattern` incl. `biweekly`, `quarterly`, `custom`, `recurrence_custom_rrule`, `recurrence_days_of_week`, `frequency`, `next_due_date`), turned into items when activated. |
| **Medication course** | `dose_times` + `starts_at`/`ends_at` + `timezone`, expanded in SQL into one `FREQ=DAILY` item per dose time (`migrations/2026-09-26_healthcare-medications.sql:177-306`). |
| **Notification schedule** | `notification_preferences.frequency`, `custom_cron`, `days_of_week`, `metadata.preferred_times` (local times). |

DOCUMENTED INTENT: "Two recurrence systems exist… that's already one too many… never add a third" (Design Doctrine §4). In code there are two **engines** (RRULE items, payment due dates) and four further **pattern formats** that feed the RRULE engine or their own runners.

## Things that happen

| Term | Current meaning |
|---|---|
| **Event** | An `items` row with `type = 'event'` and `event_details` (`start_at`, `end_at`, `all_day`, `location_text`). Trip places (`trip_places.scheduled_date/time/end_time`) and meal plans (`planned_date`, `meal_type`) are event-like but are not items. |
| **Task / reminder** | `items.type` `task` or `reminder`; reminders carry `reminder_details.due_at`. A **chore** is an item with `is_chore = true` whose definition lives in Catalogue. A **template** is a `catalogue_items` row (`item_type` `reminder/event/task`) or a `reminder_templates` row. |
| **To-do (other)** | Shopping rows (`hub_messages.checked_at`), NFC checklist items, `day_plans.checklist` (JSON), `item_subtasks`, `catalogue_sub_items`, packing items (`is_packed`). |
| **Completion** | No single meaning. See the [completion table in ENTITY-MAP](ENTITY-MAP.md#4-completion-and-lifecycle). |
| **Activity** | One row in `household_activity` written by a trigger on 80 source tables (`migrations/2026-09-26_household-activity-log.sql`). |
| **Artifact** | One row in `era_actions` that records an ERA write and its deep link (`src/lib/era/artifacts.ts`). |
| **Notification** | One `notifications` row for one recipient, optionally pushed. |

## Records, documents and categories

| Term | Current meaning |
|---|---|
| **Document / file** | A Supabase Storage object. Referenced by a **path** (`trip_documents.storage_path`, `wardrobe_items.image_path`, `trip_places.attachment_paths[]`), by a path in a column named `*_url` (`transactions.receipt_url`, `catalogue_items.image_url`), or by a **signed URL that expires after a year** (`hub_messages.voice_url`, `src/app/api/hub/voice-message/route.ts:151`; Hub item photos, `src/app/api/hub/item-chat-photo/route.ts:56`). `item_attachments` exists and is unused. |
| **Category (money)** | `user_categories`: per user **and per account**, two levels (`parent_id`), matched across partners by `slug` and resolved id → slug → name by `resolveCategoryRef()` (`src/lib/merchantMatch.ts:58`). |
| **Category (other)** | Catalogue categories (tree, `depth ≤ 5`, `path`), item `categories text[]`, packing categories (`trip_packing_category` + `trips.custom_packing_categories` JSON), shopping groups, Hub topics, recipe `category`/`cuisine`/`tags`, wardrobe `slot`/`style_tags`, place and document types. Each is local to its module. |
| **Room** | `home_rooms`, referenced from Catalogue as `catalogue_items.room_ids uuid[]` and copied onto chore instances as `items.metadata_json.room_id` (`src/lib/schedule/catalogueInstance.ts:86-91`). |

## Lifecycle words

| Word | Meaning in code |
|---|---|
| **Deleted** | `deleted_at` set; recoverable from the Recycle Bin for 30 days when the table is registered there (9 sources, `src/lib/recycleBin/registry.ts`). Some paths hard-delete instead. |
| **Archived** | `archived_at` set, `is_archived = true`, or a `status` of `archived`. Hidden from active lists, not in the Recycle Bin. |
| **Inactive** | `is_active = false` or `active = false` (recurring payments, alerts, NFC tags, prerequisites, push subscriptions). |
| **Hidden** | Per-viewer only: `hub_messages.hidden_for`. |
| **Revoked** | `revoked_at` (ERA lexicon entries, fitness rewards). |
| **Purged** | Rows removed for good by `cron/purge-recycle-bin` after 30 days. |

**PROPOSED.** Shared contracts use exactly four states for "can I see it, can I get it back": `active`, `archived` (hidden, kept, reversible by the owner), `deleted` (recoverable until purge), `purged` (gone). Module-specific states (`cooked`, `packed`, `closed`) are progress, not lifecycle. See [CROSS-MODULE-CONTRACTS §2.4](CROSS-MODULE-CONTRACTS.md#24-lifecycle-and-deletion).
