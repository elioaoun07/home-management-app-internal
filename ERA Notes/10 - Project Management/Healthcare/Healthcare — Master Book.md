---
created: 2026-09-10
updated: 2026-09-10
type: master-book
status: active
owner: Elio
---

# Healthcare — Master Book

[Backlog](<4 - Checklist.md>) · [PM home](<../_index.md>) · [Governance](<../_Conventions.md>)

## Purpose & ownership

Private health records and dependable reminders with explicit evidence limits. Standalone health records with Schedule, Catalogue, Recipes and Notifications junctions.

## Current state & evidence

Core profiles, allergies, conditions, vaccines and warning integration shipped as code July17. Current application, privacy and mobile acceptance remain HLTH-7. Medication materialization and alarm verification are pending; the domain skill precedes them.

Refactored 2026-09-10 against repository HEAD `8d952332b0d7917369ce074730cfe830a5c37a97` and dated source studies. This date records document reconciliation, not a fresh runtime, DB or device witness. The [pre-refactor record](<../_Archive/2026-09-10 PM Refactor/Before/Healthcare/Healthcare — Master Book.md>) preserves detailed older narratives and receipts.

## Vision & Decisions

- Conditions/vaccines/profiles are private to the managing user with per-profile household opt-in. Allergies are household-visible through the approved feed, not blanket direct-table sharing. Dependent profiles with user_id NULL are supported. *(IMPLEMENTED as code 2026-07-17; deployment witness HLTH-7)*
- Allergen matching is an editable warning aid, never a cooking gate or proof of safety. Unavailable household evidence must remain unavailable.
- Medication reminders use existing urgent reminder items, one per dose-time, existing recurrence and Google sync. No new alert engine. Dose log uniqueness includes medication, occurrence date and dose time.
- Warn-but-allow when Google is disconnected (owner decision July17). Sync is awaited with bookkeeping; an event identifier still does not prove a physical alarm. Schedule edits archive/recreate reminder items; adherence history remains in medication logs.
- Expiry and vaccine reminders use the existing materialization boundary. Healthcare skill HLTH-19 is required before medication math, not a final polish item. UI extraction is only an on-touch rider.

Unresolved policy choices live in the [decision register](<../_Decisions.md>); original exploratory ideas live in [Research options](<../Research/Options.md>). A Later item is retained work, not automatic permission to start.

## Pain Inventory

🔴 **HLTH-7** Verify core deployment, household privacy and mobile use. See [acceptance](<#hlth-7>) for the root cause, evidence and gate.

🟠 **HLTH-19** Establish medication safety and privacy contracts. See [acceptance](<#hlth-19>) for the root cause, evidence and gate.

🟠 **HLTH-21** Distinguish unavailable allergy evidence from a completed check. See [acceptance](<#hlth-21>) for the root cause, evidence and gate.



The remaining retained defects, decisions and enhancements are indexed below and ordered once in the checklist. Historical study claims are not new production incidents.

## Acceptance Criteria Index

### HLTH-7

**Outcome:** Verify core deployment, household privacy and mobile use.

- **Acceptance:** *(bundled into the Phase-0 owner day, packet **E-00**, of the [ERA Top Layer — Master Plan](<../_Archive/Plans/ERA Top Layer — Master Plan (2026-09-02).md>))* (Phase 1) Owner verifies the current core schema and privacy contract, applies missing reviewed SQL only if needed, then verifies mobile viewport + both-accounts allergen warning + privacy (partner cannot see unshared condition)

- **Acceptance:** with the migration run, creating self + partner profiles and a "peanut" allergy makes a recipe containing "peanut butter" show the banner and the inline ingredient flag from **both** accounts, and a private condition is invisible to the partner. Verified on a mobile viewport.

**Provenance:** [4 - Checklist.md](<../_Archive/2026-09-10 PM Refactor/Before/Healthcare/4 - Checklist.md>). The source is historical; this entry owns the retained outcome.

### HLTH-19

**Outcome:** Establish medication safety and privacy contracts.

- **Acceptance:** Author the healthcare domain skill through skill-factory before HLTH-8/9. Cover PHI boundaries, dose math, asymmetric visibility, household allergy availability, dependent profiles with nullable user_id, exactly-once dose materialization and real-device alarm evidence. Do not infer medical safety from ingredient text matching.

**Provenance:** [4 - Checklist.md](<../_Archive/2026-09-10 PM Refactor/Before/Healthcare/4 - Checklist.md>). The source is historical; this entry owns the retained outcome.

### HLTH-21

**Outcome:** Distinguish unavailable allergy evidence from a completed check.

- **Acceptance:** Propagate allergy-feed availability so an unavailable household feed cannot be interpreted as a completed ingredient check.

**Retained contract — ASTRA-HLTH-1:**

- **Outcome:** Recipe warnings distinguish a checked result from an unavailable or cached allergen feed.
- **Boundary:** Validate feed payload shape; malformed/missing allergens is an error, not[]. Preserve query status/dataUpdatedAt with matched output through a small tested adapter used by the actual hook/component. Cached hits remain visible on offline or failed refresh; no cached data yields unavailable. Preserve per-ingredient flags and keyword rules. Expose a compact status/i affordance only where availability is ambiguous; no explanatory banner or “safe” label, no cooking gate. Retain existing cache key/invalidation unless owner scope evidence requires a separately scoped fix.
- **Money/schedule math?:** No. Availability fixture: successful empty feed→checked-empty; first-load503→unavailable; cached peanut hit + offline→hit retained with cached status; successful refresh removing the allergy→new checked result.
- **Gate:** `pnpm exec vitest run tests/allergen-feed-state.test.ts src/lib/health/allergenMatch.test.ts --reporter=verbose` → nonzero cases pass for loading, malformed payload, empty success, first failure and cached failure. Common gates. Owner390×844 recipe capture covers first-load failure, cached offline hit and refreshed result; two-account privacy/allergen evidence belongs to HLTH-7 and must be attached, not inferred from mocks.

**Provenance:** [4 - Checklist.md](<../_Archive/2026-09-10 PM Refactor/Before/Healthcare/4 - Checklist.md>). The source is historical; this entry owns the retained outcome.

### HLTH-8

**Outcome:** Define idempotent medication storage and materialization.

- **Acceptance:** *(packet **M-07a** of the [ERA Top Layer — Master Plan](<../_Archive/Plans/ERA Top Layer — Master Plan (2026-09-02).md>); plan sacrifice #3 if a gate is missed)* (Phase 2) Medications migration — `health_medications` + `health_medication_logs` (idempotent unique key), `items.source_medication_id` FK + partial index, occurrence-action mirror trigger, materialization RPCs
- **Depends on:** [HLTH-7](<Healthcare — Master Book.md#hlth-7>), [HLTH-19](<Healthcare — Master Book.md#hlth-19>).

**Provenance:** [4 - Checklist.md](<../_Archive/2026-09-10 PM Refactor/Before/Healthcare/4 - Checklist.md>). The source is historical; this entry owns the retained outcome.

### HLTH-9

**Outcome:** Create per-dose reminders with verified calendar sync.

- **Acceptance:** Medications routes — transactional item materialization (one `urgent` reminder item per dose-time), **awaited verified** gcal sync with `gcal_status` bookkeeping, warn-but-allow when Google disconnected → `src/lib/gcal/sync.ts`
- **Depends on:** [HLTH-8](<Healthcare — Master Book.md#hlth-8>).

**Provenance:** [4 - Checklist.md](<../_Archive/2026-09-10 PM Refactor/Before/Healthcare/4 - Checklist.md>). The source is historical; this entry owns the retained outcome.

### HLTH-10

**Outcome:** Reconcile medication calendar status.

- **Acceptance:** Extend reconcile cron — med items first, heal `gcal_status` both ways → `src/app/api/cron/gcal-reconcile/route.ts`
- **Depends on:** [HLTH-9](<Healthcare — Master Book.md#hlth-9>).

**Provenance:** [4 - Checklist.md](<../_Archive/2026-09-10 PM Refactor/Before/Healthcare/4 - Checklist.md>). The source is historical; this entry owns the retained outcome.

### HLTH-11

**Outcome:** Add medication and adherence controls.

- **Acceptance:** Medications UI — meds card (status, next dose, gcal badge), adherence history, "Connect Google" CTA
- **Depends on:** [HLTH-9](<Healthcare — Master Book.md#hlth-9>).

**Provenance:** [4 - Checklist.md](<../_Archive/2026-09-10 PM Refactor/Before/Healthcare/4 - Checklist.md>). The source is historical; this entry owns the retained outcome.

### HLTH-12

**Outcome:** Verify dose, edit, replay and physical alarm behavior.

- **Acceptance:** Verification battery — 2-dose med = exactly 2 items/events; native alarm with app closed; edit → zero duplicates; offline dose log replay = one row
- **Depends on:** [HLTH-9](<Healthcare — Master Book.md#hlth-9>), [HLTH-10](<Healthcare — Master Book.md#hlth-10>), [HLTH-11](<Healthcare — Master Book.md#hlth-11>).

- **Acceptance:** a 2-dose medication produces exactly 2 items and 2 Google events; the native alarm fires with the app closed on a real phone; a schedule edit produces zero duplicate occurrences; an offline dose log replays to exactly one row.

**Provenance:** [4 - Checklist.md](<../_Archive/2026-09-10 PM Refactor/Before/Healthcare/4 - Checklist.md>). The source is historical; this entry owns the retained outcome.

### HLTH-22

**Outcome:** Cover core healthcare route contracts.

- **Acceptance:** Reverify current core routes and test authentication, dependent profiles, partner sharing/opt-in, unavailable allergy feed and Zod/error boundaries. Historical ten-route count is not a current guarantee.
- **Depends on:** [HLTH-7](<Healthcare — Master Book.md#hlth-7>).

**Provenance:** [Healthcare — Master Book.md](<../_Archive/2026-09-10 PM Refactor/Before/Healthcare/Healthcare — Master Book.md>). The source is historical; this entry owns the retained outcome.

### HLTH-13

**Outcome:** Extend healthcare catalogue metadata (insurance fields + expiry) in types + detail/edit dialogs.

- **Acceptance:** Extend healthcare catalogue metadata (insurance fields + expiry) in types + detail/edit dialogs → `src/types/catalogue.ts`

**Provenance:** [4 - Checklist.md](<../_Archive/2026-09-10 PM Refactor/Before/Healthcare/4 - Checklist.md>). The source is historical; this entry owns the retained outcome.

### HLTH-14

**Outcome:** Generic expiry→reminder-item materialization via `source_catalogue_item_id` (also revives dead `DocumentItemMetadata.expiry_date`).

- **Acceptance:** Generic expiry→reminder-item materialization via `source_catalogue_item_id` (also revives dead `DocumentItemMetadata.expiry_date`)

**Provenance:** [4 - Checklist.md](<../_Archive/2026-09-10 PM Refactor/Before/Healthcare/4 - Checklist.md>). The source is historical; this entry owns the retained outcome.

### HLTH-15

**Outcome:** Doctor pickers on health record forms + Care Contacts card on the health page.

- **Acceptance:** Doctor pickers on health record forms + Care Contacts card on the health page

**Provenance:** [4 - Checklist.md](<../_Archive/2026-09-10 PM Refactor/Before/Healthcare/4 - Checklist.md>). The source is historical; this entry owns the retained outcome.

### HLTH-16

**Outcome:** Vaccine `next_due_on` booster reminders via the same materialization choke point.

- **Acceptance:** Vaccine `next_due_on` booster reminders via the same materialization choke point

**Provenance:** [4 - Checklist.md](<../_Archive/2026-09-10 PM Refactor/Before/Healthcare/4 - Checklist.md>). The source is historical; this entry owns the retained outcome.

### HLTH-17

**Outcome:** Hub Chat "took my pill" intent (propose→confirm) + briefing signals from `get_health_bundle`.

- **Acceptance:** Hub Chat "took my pill" intent (propose→confirm) + briefing signals from `get_health_bundle`

**Provenance:** [4 - Checklist.md](<../_Archive/2026-09-10 PM Refactor/Before/Healthcare/4 - Checklist.md>). The source is historical; this entry owns the retained outcome.

### HLTH-18

**Outcome:** Meal-planning allergen badges + recipe list-card dot (needs ingredients in list payload).

- **Acceptance:** Meal-planning allergen badges + recipe list-card dot (needs ingredients in list payload)

**Provenance:** [4 - Checklist.md](<../_Archive/2026-09-10 PM Refactor/Before/Healthcare/4 - Checklist.md>). The source is historical; this entry owns the retained outcome.

### HLTH-20

**Outcome:** Med stock + refill reminders.

- **Acceptance:** Med stock + refill reminders

**Provenance:** [4 - Checklist.md](<../_Archive/2026-09-10 PM Refactor/Before/Healthcare/4 - Checklist.md>). The source is historical; this entry owns the retained outcome.

### HLTH-23

**Accepted specification:** [Catalogue final build plan §10](<../../../docs/Catalogue — ASTRA Deep Dive.md#10-final-build-plan--2026-09-07>), packet C15. Its detailed data/rollout contract applies; earlier Object Memory/Tasks V2 alternatives were withdrawn.

**Outcome:** Select private medical reference records.

- **Acceptance:** Catalogue C15: healthcare reference pickers respect source privacy and lineage; a contact/document link does not become a medication or grant household access.
- **Depends on:** [KIT-20](<../Kitchen/Kitchen — Master Book.md#kit-20>), [HLTH-7](<Healthcare — Master Book.md#hlth-7>).

**Provenance:** [Healthcare — Master Book.md](<../_Archive/2026-09-10 PM Refactor/Before/Healthcare/Healthcare — Master Book.md>). The source is historical; this entry owns the retained outcome.

## Shipped Log

- ✅ 2026-07-17 — **HLTH-1** module scaffold: six index surfaces, slug `healthcare` (`node scripts/check-feature-index.mjs` green)
- ✅ 2026-07-17 — **HLTH-2** core DB: `health_profiles` / `health_allergies` / `health_conditions` / `health_vaccines`, owner-only RLS + `managing_user_id` sync trigger, `get_health_bundle()` + `get_household_allergens()` RPCs (`migrations/2026-07-17_healthcare-core.sql` — **code-complete, migration not yet run**)
- ✅ 2026-07-17 — **HLTH-3** CRUD API routes (profiles, allergies with keyword seeding, conditions, vaccines) + bundle + allergen feed, typecheck clean
- ✅ 2026-07-17 — **HLTH-4** allergen matcher: word-boundary + plurals, Lebanese-staples synonyms, editable per-allergy keywords (`allergenMatch.test.ts` 12/12)
- ✅ 2026-07-17 — **HLTH-5** recipe allergen warnings: detail-view banner + per-ingredient flags, both partners' allergies, offline-persisted feed (`household-allergens` in `STABLE_KEYS`)
- ✅ 2026-07-17 — **HLTH-6** health page UI: profile chips including dependents, allergies with severity/keywords, medical history, vaccines, Undo on every mutation

## Delivery session log

*(Delivery runner appends dated progress bullets here automatically.)*

## Successor Briefing

Read the checklist, the selected acceptance entry and its dependencies; then use the [Feature Map](<../../01 - Architecture/Feature Map/_index.md>) for source routing and the module architecture docs for invariants. Delta from the source cutoff before implementation. Use current owner-supplied DB evidence for access/application questions; agents never apply production SQL. Record code, applied migration and device/runtime acceptance separately.

Finish with the repository playbook and [governance](<../_Conventions.md>): update acceptance/evidence, sweep only completed work, and validate the canonical queue. A completed child does not complete its coordination parent.
