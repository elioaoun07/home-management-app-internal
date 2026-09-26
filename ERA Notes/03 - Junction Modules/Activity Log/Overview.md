---
created: 2026-09-26
type: feature-doc
module: Activity Log
module-type: junction
status: active
tags:
  - type/feature-doc
  - module/activity-log
related:
  - "[[Common Patterns]]"
---

# Activity Log

> **Module:** `src/features/activity-log/` | **API:** `src/app/api/activity-log/` | **Page:** `src/app/activity-log/`
> **DB Tables:** `household_activity`, `activity_log_sources`
> **Type:** Junction
> **Status:** Active

## Overview

The household's read-only timeline at `/activity-log`, with module, feature, person and local-date filters, newest first and cursor pagination. A separate manifest and icon allow home-screen installation alongside Trips and PM. User menu → Activity and ERA Artifacts → Household activity open it. Its own opaque sticky header replaces global navigation and the floating assistant on this route.

HUB-72 implements the owner's 2026-09-26 request. The existing HUB-25 `era_actions`/Artifacts feed only records assistant-originated actions; it remains available. This ledger records source-table changes regardless of the entry point, after the migration is applied. It does not invent historical create/update events from existing records.

## Architecture

Write: an existing module commits a source-row change → `AFTER INSERT/UPDATE/DELETE` trigger → `household_activity` in the same transaction. Rollback produces no history; `ON CONFLICT DO NOTHING` produces no create event and an upsert update produces only an update. There is no public log-write API. Source business values and balances are unchanged by the recorder.

Read: `ActivityLogClient` → `useActivityLog` → `safeFetch` GET `/api/activity-log` → authenticated `get_household_activity` SECURITY DEFINER RPC. Visibility is checked before ordering/limiting; one read returns events, string bigint cursor and installed-source coverage. The UI refreshes after successful local mutations and every 15 seconds while visible, plus focus/mount. Errors hide old events and are distinguished from an empty feed. Activity queries are neither persisted nor added to the service worker API cache; logout/account changes cancel and discard their cache.

Timestamps are UTC; From is inclusive local midnight and Through becomes exclusive next local midnight. The API validates offset-bearing ISO times and cursor/range bounds. `auth.uid()` alone determines the reader; caller-supplied user/household identifiers cannot select another audience.

## Database

`household_activity`: bigint sequence, timestamp, module/feature/action, source table/UUID, owner/actor UUIDs, snapshot audience, bounded title, changed field names and whitelisted ACL/parent context. Indexes cover owner/module/source plus descending sequence and timestamp. Actor is the authenticated writer; service-role/cron writes without a user identity display **System**, or **Guest portal** for external portal actions. The System / external filter includes both. Never infer the actor from the record owner or a guest-supplied name.

`activity_log_sources`: allowlisted source table, ID column, module, feature, label, visibility policy and optional parent relationship. Both tables have RLS enabled and no direct authenticated/anonymous grants or policies. Only the read RPC is granted to authenticated users; helper functions are private. No new parent-join RLS is installed on source tables.

The migration is `migrations/2026-09-26_household-activity-log.sql`; `schema.sql` records the table end state. The source registry, trigger and function definitions live in the migration. Application is **owner-only in Supabase SQL Editor**, unverified until the owner supplies evidence. Reapplying preserves records and replaces only this feature's triggers. Optional source tables absent at application are skipped; reapply after installing them. The RPC's `sources` list reports only tables with an enabled capture trigger.

### Visibility contract

- A reader must belong to the snapshot audience **and** still satisfy the current source/parent rules and current active household. Changing a public record to private hides its older history from the partner. Making a private record public does not reveal its earlier private snapshots. A replacement partner never inherits prior audiences.
- Partner-private/draft budget transactions are entirely absent. Accounts and their balance/category children follow account visibility. Transfers/allocations follow the existing household access contract; debts, future purchases and imports remain owner-only. No monetary values are stored or returned in activity payloads.
- Schedule follows owner/public/responsible-person rules; child records inherit the item boundary. Medication reminders also check the health profile boundary. Chat children inherit thread privacy/household and message `hidden_for`; shopping-thread messages appear under Kitchen → Shopping.
- Recipes/meals follow household membership; catalogue roots follow their public flag; stock/subitems inherit the catalogue item. Trips and children follow trip scope. Healthcare follows profile sharing and uses generic titles; Outfits, personal ERA conversations, notifications and preferences stay owner-only. NFC follows its household access contract.
- Deleted rows retain their last recorded ACL context, so deletion cannot reveal previously private history. Source links are omitted for deleted records. A pre-installation orphan/cascade child with no recoverable parent owner is not guessed; the root delete can still be recorded.
- Guest portal activity inherits the tag owner only; this does not claim to resolve HUB-61's open household-admin access question. Portal/visit/message/allergy/feedback/drink events have generic titles and retain no guest names, messages, fingerprints, Wi-Fi credentials or public slugs. No UUID guest deep link is generated. Templates, merchant mappings and statement subrecords stay personal; catalogue calendar-link history is personal.
- Titles retain at most 200 characters of a visible source label/message excerpt. Full rows, before/after values, medical notes, credentials, attachments and signed URLs are not retained. Healthcare, notification and settings events use generic labels. This is activity history, not an undo/restore or tamper-proof audit facility.

### Coverage

The explicit registry spans Budget (transactions, accounts/balances, transfers, recurring, debts, purchases, allocations/categories/imports, statement entries/skips, merchant mappings and templates); Schedule (items, details, subtasks/completions, recurrence, snoozes/alerts/suppressions, templates, attachments, planning, prerequisites and NFC); Chat (threads/messages/actions/notes); Kitchen (shopping, stock/restocks, recipes/versions/cooking/meals); Catalogue and calendar links; Trips (places, packing/checkpoints, documents); Healthcare (profiles, conditions/allergies/vaccines, medications/doses); Outfits; ERA conversations/messages/templates; Guest Portal (tags/visits/chat/allergies/feedback/drinks); notifications and preferences.

Operational telemetry, AI caches, PM bridge traffic, auth/profile administration, unadopted memory backends and rows in unregistered/new tables are not automatically recorded. New sources require an explicit ownership/privacy review and migration. Optional source coverage is discoverable via the information affordance and API; absence of an optional source is not proof its backend is installed. Template use counters and guest last-seen heartbeats do not create noisy update events.

## Key Files

- `src/features/activity-log/hooks.ts` — `useActivityLog`, read/poll/invalidation/auth cleanup
- `src/features/activity-log/queryKeys.ts` — `activityLogKeys` factory
- `src/features/activity-log/types.ts` — filters, `ActivityEvent`/`ActivityPage`, allowlisted source links
- `src/app/api/activity-log/route.ts` — authenticated, Zod-validated, no-store GET
- `src/app/activity-log/ActivityLogClient.tsx` — main UI
- `src/app/activity-log/layout.tsx`, `public/manifests/activity-log.webmanifest` — install identity/icons
- `src/features/activity-log/activityLog.database.test.ts`, `src/app/api/activity-log/route.test.ts` — isolated PostgreSQL and API boundary checks

## Gotchas

- A missing RPC returns explicit 503 setup-required, never an empty feed. The migration must be applied before this page can load history.
- AFTER triggers are required: BEFORE INSERT would record attempts rejected by ON CONFLICT.
- Recording errors roll back the source write; there is no silent best-effort capture. Optional tables are skipped at install, but present source schemas must match their registered columns. The isolated suite checks every registered source against the checked-in table columns; it is not evidence of live schema/RLS/function state.
- Migration preflight rejects incompatible UUID identity/parent columns inside the installation transaction. Its commented recovery block lets the owner pause only capture triggers while preserving source/history; reapply after a fix to resume. Missing optional sources and failed preflight/reapplication are tested locally.
- Money invariant example in isolated PG: source amount 25 → 30 remains 30; the log returns created/updated/deleted with field names only. No balance, recurrence expansion or AI mutation engine is introduced.
- Physical deletion can remove a pre-installation parent before its child capture fires. Do not widen child visibility or invent ownership to fill that gap.
- Valid unparented categories/legacy messages with a known user/sender retain strictly personal activity. A nullable parent is not a reason to block the existing write or publish it to the household.
- Local tests cover all registry ownership paths, private/public transitions, parent privacy, unlink/relink, hidden messages, rollback/upsert, cursor/date boundaries, raw-access denial and reapplication. Full live flows, 390px appearance and real iOS/Android installation remain owner UAT; no browser backend was available in this implementation session.

## See Also

- [[Common Patterns]]
- [[Sync and Offline]]
