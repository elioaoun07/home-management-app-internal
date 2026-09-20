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

- **Reading guide:** Owner-executed verification; no code change. Read enough to interpret a failure. The page is one RPC: `src/app/api/healthcare/route.ts` calls `get_health_bundle()` (SECURITY DEFINER — its own comment says it returns own profiles plus shared household ones), consumed by `useHealthBundle()` in `src/features/healthcare/hooks.ts` and rendered by `src/app/healthcare/HealthcareClient.tsx`. The allergen half is a *separate* feed: `src/app/api/healthcare/allergens/route.ts` → `get_household_allergens()`, deliberately ignoring `shared_with_household` so a partner cooking sees the allergy, with no medical notes. Both-accounts privacy is therefore two different questions — and per Hard Rule #27 the only repo artifact that is evidence about it is `migrations/db-state.json`, never `schema.sql` or a vault doc. The route slug is `healthcare`, not `health`. Recipe warning surface: `src/components/web/RecipeAllergenWarning.tsx`.

### HLTH-19

**Outcome:** Establish medication safety and privacy contracts.

- **Acceptance:** Author the healthcare domain skill through skill-factory before HLTH-8/9. Cover PHI boundaries, dose math, asymmetric visibility, household allergy availability, dependent profiles with nullable user_id, exactly-once dose materialization and real-device alarm evidence. Do not infer medical safety from ingredient text matching.

**Provenance:** [4 - Checklist.md](<../_Archive/2026-09-10 PM Refactor/Before/Healthcare/4 - Checklist.md>). The source is historical; this entry owns the retained outcome.

- **Reading guide:** Authoring task, and it gates HLTH-8/9. Follow `.claude/skills/skill-factory/SKILL.md` — it has the decision gate and the house template — and ground every rule in code rather than prose. The domains it must cover already have anchors: dose math and exactly-once materialization → `.claude/skills/recurrence-safety/SKILL.md` and `src/lib/schedule/materializeOccurrence.ts`; asymmetric visibility → `get_health_bundle()` (shared/private) versus `get_household_allergens()` (always household-wide) in `src/app/api/healthcare/`; keyword matching's limits → `src/lib/health/allergenMatch.ts` (`deriveDefaultKeywords`, `ALLERGEN_SYNONYMS`, `matchIngredient`) and its own test file. "Do not infer medical safety from ingredient text matching" is the load-bearing sentence — the existing component already calls itself a warning aid, not a guarantee.

### HLTH-21

**Outcome:** Distinguish unavailable allergy evidence from a completed check.

- **Acceptance:** Propagate allergy-feed availability so an unavailable household feed cannot be interpreted as a completed ingredient check.

**Retained contract — ASTRA-HLTH-1:**

- **Outcome:** Recipe warnings distinguish a checked result from an unavailable or cached allergen feed.
- **Boundary:** Validate feed payload shape; malformed/missing allergens is an error, not[]. Preserve query status/dataUpdatedAt with matched output through a small tested adapter used by the actual hook/component. Cached hits remain visible on offline or failed refresh; no cached data yields unavailable. Preserve per-ingredient flags and keyword rules. Expose a compact status/i affordance only where availability is ambiguous; no explanatory banner or “safe” label, no cooking gate. Retain existing cache key/invalidation unless owner scope evidence requires a separately scoped fix.
- **Money/schedule math?:** No. Availability fixture: successful empty feed→checked-empty; first-load503→unavailable; cached peanut hit + offline→hit retained with cached status; successful refresh removing the allergy→new checked result.
- **Gate:** `pnpm exec vitest run tests/allergen-feed-state.test.ts src/lib/health/allergenMatch.test.ts --reporter=verbose` → nonzero cases pass for loading, malformed payload, empty success, first failure and cached failure. Common gates. Owner390×844 recipe capture covers first-load failure, cached offline hit and refreshed result; two-account privacy/allergen evidence belongs to HLTH-7 and must be attached, not inferred from mocks.

**Provenance:** [4 - Checklist.md](<../_Archive/2026-09-10 PM Refactor/Before/Healthcare/4 - Checklist.md>). The source is historical; this entry owns the retained outcome.

- **Reading guide:** The defect is one line and verified 2026-09-20: `useRecipeAllergenMatches()` in `src/components/web/RecipeAllergenWarning.tsx` destructures `const { data: allergens = [] }` from `useHouseholdAllergens()`, so loading, offline and a 503 all collapse into the same empty array as "nobody is allergic". The feed is `useHouseholdAllergens()` in `src/hooks/useHouseholdAllergens.ts` — note it lives in `src/hooks/` on purpose so Recipes can use it without a standalone→standalone import, it is persisted to localStorage via `STABLE_KEYS` in `src/app/providers.tsx`, and its `fetchHouseholdAllergens()` swallows a malformed payload with `data.allergens ?? []` (the second half of the bug). The adapter the contract asks for must preserve `status`/`dataUpdatedAt`; matching itself (`matchRecipeIngredients`, per-ingredient flags) stays untouched. Render sites: `RecipeAllergenWarning.tsx` and `src/components/web/RecipeDetailView.tsx`. Hard Rule #28 — a compact `i` affordance, not a banner. `tests/allergen-feed-state.test.ts` does not exist yet; `src/lib/health/allergenMatch.test.ts` does.

### HLTH-8

**Outcome:** Define idempotent medication storage and materialization.

- **Acceptance:** *(packet **M-07a** of the [ERA Top Layer — Master Plan](<../_Archive/Plans/ERA Top Layer — Master Plan (2026-09-02).md>); plan sacrifice #3 if a gate is missed)* (Phase 2) Medications migration — `health_medications` + `health_medication_logs` (idempotent unique key), `items.source_medication_id` FK + partial index, occurrence-action mirror trigger, materialization RPCs
- **Depends on:** [HLTH-7](<Healthcare — Master Book.md#hlth-7>), [HLTH-19](<Healthcare — Master Book.md#hlth-19>).

**Provenance:** [4 - Checklist.md](<../_Archive/2026-09-10 PM Refactor/Before/Healthcare/4 - Checklist.md>). The source is historical; this entry owns the retained outcome.

- **Reading guide:** Migration-first and blocked on HLTH-19. Read `migrations/schema.sql` for the `items` table and the existing health tables before designing `health_medications`/`health_medication_logs`; the idempotent unique key is the whole point, so read `.claude/skills/recurrence-safety/SKILL.md` before writing the materialization RPCs — this repo's historical failure mode is duplicate occurrence generation, and there are already two recurrence systems not to add a third to. `items.source_medication_id` follows the existing `source_catalogue_item_id` precedent (see `src/app/api/items/route.ts` and `src/app/api/items/[id]/promote/route.ts`). The occurrence-action mirror trigger has to agree with `src/lib/schedule/materializeOccurrence.ts` and `alertResolution.ts`. Hard Rules #20 (no EXISTS policies on hot child tables), #24 (migration file, then `schema.sql`) and #26 (hand the SQL to the owner; never apply it).

### HLTH-9

**Outcome:** Create per-dose reminders with verified calendar sync.

- **Acceptance:** Medications routes — transactional item materialization (one `urgent` reminder item per dose-time), **awaited verified** gcal sync with `gcal_status` bookkeeping, warn-but-allow when Google disconnected → `src/lib/gcal/sync.ts`
- **Depends on:** [HLTH-8](<Healthcare — Master Book.md#hlth-8>).

**Provenance:** [4 - Checklist.md](<../_Archive/2026-09-10 PM Refactor/Before/Healthcare/4 - Checklist.md>). The source is historical; this entry owns the retained outcome.

- **Reading guide:** Depends on HLTH-8. Two existing systems to join, not replace. Item creation: `src/app/api/items/route.ts` is the canonical shape for writing an `items` row, and one `urgent` reminder per dose-time must be transactional with the medication write. Calendar: `src/lib/gcal/sync.ts` (`syncItemToGoogleCalendar`, `deleteItemFromGoogleCalendar`) and `src/lib/gcal/client.ts` (`isGoogleCalendarConfigured`, `isGoogleNotFoundError` — the disconnected case). "Awaited verified" is the operative word: the known historical failure here was a sync that reported success without firing from online mutations, so await the result and record `gcal_status` from it. Warn-but-allow when Google is disconnected is the already-decided behaviour. Hard Rule #6 — an external API call needs an explicit `timeoutMs`. Timezone through `src/lib/utils/date.ts` (Hard Rule #18).

### HLTH-10

**Outcome:** Reconcile medication calendar status.

- **Acceptance:** Extend reconcile cron — med items first, heal `gcal_status` both ways → `src/app/api/cron/gcal-reconcile/route.ts`
- **Depends on:** [HLTH-9](<Healthcare — Master Book.md#hlth-9>).

**Provenance:** [4 - Checklist.md](<../_Archive/2026-09-10 PM Refactor/Before/Healthcare/4 - Checklist.md>). The source is historical; this entry owns the retained outcome.

- **Reading guide:** Small extension of an existing cron: `src/app/api/cron/gcal-reconcile/route.ts`, which already has `maxDuration = 60`, the `Bearer CRON_SECRET` check and `supabaseAdmin()` (Hard Rule #8). Read its current reconcile loop and put med items first; healing `gcal_status` both ways means it can also clear a stale status, not only set one. The sync primitives it calls are in `src/lib/gcal/sync.ts`. There is no `vercel.json` — this cron only runs if an external scheduler invokes it, so any acceptance needs a last-run trace, not an assumption.

### HLTH-11

**Outcome:** Add medication and adherence controls.

- **Acceptance:** Medications UI — meds card (status, next dose, gcal badge), adherence history, "Connect Google" CTA
- **Depends on:** [HLTH-9](<Healthcare — Master Book.md#hlth-9>).

**Provenance:** [4 - Checklist.md](<../_Archive/2026-09-10 PM Refactor/Before/Healthcare/4 - Checklist.md>). The source is historical; this entry owns the retained outcome.

- **Reading guide:** UI only, on top of HLTH-9's data. The page is `src/app/healthcare/HealthcareClient.tsx`; add the meds card beside the existing allergy/condition/vaccine cards and follow their mutation pattern in `src/features/healthcare/hooks.ts` (`useCreateHealthAllergy` and siblings are the template — optimistic mutation, `healthcareKeys` invalidation from `src/features/healthcare/queryKeys.ts`). The "Connect Google" CTA state comes from `isGoogleCalendarConfigured()` / the user's stored refresh token, not from a local flag. Hard Rules: #1 (Undo on destructive actions, `ToastIcons`), #3 (no red on individual rows), #5 (mobile-first), #28 (a status pill and a number, not explanatory prose).

### HLTH-12

**Outcome:** Verify dose, edit, replay and physical alarm behavior.

- **Acceptance:** Verification battery — 2-dose med = exactly 2 items/events; native alarm with app closed; edit → zero duplicates; offline dose log replay = one row
- **Depends on:** [HLTH-9](<Healthcare — Master Book.md#hlth-9>), [HLTH-10](<Healthcare — Master Book.md#hlth-10>), [HLTH-11](<Healthcare — Master Book.md#hlth-11>).

- **Acceptance:** a 2-dose medication produces exactly 2 items and 2 Google events; the native alarm fires with the app closed on a real phone; a schedule edit produces zero duplicate occurrences; an offline dose log replays to exactly one row.

**Provenance:** [4 - Checklist.md](<../_Archive/2026-09-10 PM Refactor/Before/Healthcare/4 - Checklist.md>). The source is historical; this entry owns the retained outcome.

- **Reading guide:** A verification battery, not a feature — most of it cannot be proved in-repo. What the repo can tell you: exactly-once is a property of HLTH-8's unique key and the RPCs, edit-without-duplicates is a property of `src/lib/schedule/materializeOccurrence.ts` and `expandOccurrences.ts` (which has its own test, `expandOccurrences.test.ts`), and offline dose replay is a property of the IndexedDB queue in `src/lib/offlineQueue.ts` plus `src/lib/offlineSyncEngine.ts` — replay-to-exactly-one-row is that queue's idempotency, so read `ERA Notes/01 - Architecture/Sync and Offline.md`. The native alarm with the app closed needs a real phone and depends on the Native App campaign; nothing in this repo proves it.

### HLTH-22

**Outcome:** Cover core healthcare route contracts.

- **Acceptance:** Reverify current core routes and test authentication, dependent profiles, partner sharing/opt-in, unavailable allergy feed and Zod/error boundaries. Historical ten-route count is not a current guarantee.
- **Depends on:** [HLTH-7](<Healthcare — Master Book.md#hlth-7>).

**Provenance:** [Healthcare — Master Book.md](<../_Archive/2026-09-10 PM Refactor/Before/Healthcare/Healthcare — Master Book.md>). The source is historical; this entry owns the retained outcome.

- **Reading guide:** Re-inventory before testing — the historical ten-route count is not a guarantee. Verified 2026-09-20 there are 11 route files under `src/app/api/healthcare/` (`route.ts` = the `get_health_bundle` bundle, plus `allergens/`, and collection+`[id]` pairs for `allergies`, `conditions`, `profiles`, `vaccines`), and a separate `src/app/api/health/route.ts` that is the connectivity probe used by `safeFetch`/`isReallyOnline` — not a healthcare route; do not test or change it here. Template for what a correct route looks like: `.claude/skills/api-route/SKILL.md` and `src/app/api/accounts/route.ts` (auth → Zod → household linking → error mapping, 23505→409). The four contract axes each have a concrete anchor: authentication (every route's `supabase.auth.getUser()` guard), dependent profiles (nullable `user_id` on health profiles — check `migrations/schema.sql`), partner sharing/opt-in (`shared_with_household` honoured by `get_health_bundle()` but deliberately *not* by `get_household_allergens()`), and unavailable allergy feed (HLTH-21 owns the client half; here it is the route's error shape). Depends on HLTH-7.

### HLTH-13

**Outcome:** Extend healthcare catalogue metadata (insurance fields + expiry) in types + detail/edit dialogs.

- **Acceptance:** Extend healthcare catalogue metadata (insurance fields + expiry) in types + detail/edit dialogs → `src/types/catalogue.ts`

**Provenance:** [4 - Checklist.md](<../_Archive/2026-09-10 PM Refactor/Before/Healthcare/4 - Checklist.md>). The source is historical; this entry owns the retained outcome.

- **Reading guide:** Types first: `src/types/catalogue.ts` — the `healthcare` category is already declared (`CatalogueCategory`, its label, icon and colour), `DocumentItemMetadata.expiry_date` exists at ~line 545, and there is a `doctor_name` field at ~line 483. Add the insurance fields to the metadata interfaces there, then the detail/edit dialogs under `src/features/catalogue/` and `src/app/catalogue/`. Per CLAUDE.md's enum/type rule, a metadata change is a five-place edit: migration + TS type + API route + UI + utilities, together. Expiry *behaviour* is HLTH-14, not this.

### HLTH-14

**Outcome:** Generic expiry→reminder-item materialization via `source_catalogue_item_id` (also revives dead `DocumentItemMetadata.expiry_date`).

- **Acceptance:** Generic expiry→reminder-item materialization via `source_catalogue_item_id` (also revives dead `DocumentItemMetadata.expiry_date`)

**Provenance:** [4 - Checklist.md](<../_Archive/2026-09-10 PM Refactor/Before/Healthcare/4 - Checklist.md>). The source is historical; this entry owns the retained outcome.

- **Reading guide:** The link column already exists and is used: `items.source_catalogue_item_id` is written in `src/app/api/items/route.ts`, read back in `src/app/api/catalogue/items/[id]/route.ts` and `src/app/api/items/[id]/promote/route.ts`, and surfaced as `isLinkedToCatalogue` in `src/components/items/ItemDetailModal.tsx`. So this is a materialization choke point over an existing relation, not a new one — and HLTH-16 is meant to reuse the same one, so design it generically. `DocumentItemMetadata.expiry_date` in `src/types/catalogue.ts` is the dead field to revive. Exactly-once rules: `.claude/skills/recurrence-safety/SKILL.md`; do not add a third expansion engine. Dates through `src/lib/utils/date.ts`.

### HLTH-15

**Outcome:** Doctor pickers on health record forms + Care Contacts card on the health page.

- **Acceptance:** Doctor pickers on health record forms + Care Contacts card on the health page

**Provenance:** [4 - Checklist.md](<../_Archive/2026-09-10 PM Refactor/Before/Healthcare/4 - Checklist.md>). The source is historical; this entry owns the retained outcome.

- **Reading guide:** Two small surfaces. Doctors live in the catalogue's `healthcare` category (`src/types/catalogue.ts`, `doctor_name` at ~line 483) — the picker should read catalogue items through `src/features/catalogue/`, and because Healthcare and Catalogue are both standalone, any shared picker belongs in `src/components/` or `src/lib/`, never a cross-feature import. The forms to extend are the record dialogs in `src/app/healthcare/HealthcareClient.tsx` with mutations from `src/features/healthcare/hooks.ts`. The Care Contacts card is a read-only card on the same page.

### HLTH-16

**Outcome:** Vaccine `next_due_on` booster reminders via the same materialization choke point.

- **Acceptance:** Vaccine `next_due_on` booster reminders via the same materialization choke point

**Provenance:** [4 - Checklist.md](<../_Archive/2026-09-10 PM Refactor/Before/Healthcare/4 - Checklist.md>). The source is historical; this entry owns the retained outcome.

- **Reading guide:** Deliberately dependent on HLTH-14's choke point — read that guide first and reuse it rather than writing a vaccine-specific path. The vaccine record and its `next_due_on` come through `get_health_bundle()` (`src/app/api/healthcare/route.ts`, typed in `src/features/healthcare/types.ts`) and the CRUD routes under `src/app/api/healthcare/vaccines/`. Mutations: `useCreateHealthVaccine`/`useUpdateHealthVaccine` in `src/features/healthcare/hooks.ts`.

### HLTH-17

**Outcome:** Hub Chat "took my pill" intent (propose→confirm) + briefing signals from `get_health_bundle`.

- **Acceptance:** Hub Chat "took my pill" intent (propose→confirm) + briefing signals from `get_health_bundle`

**Provenance:** [4 - Checklist.md](<../_Archive/2026-09-10 PM Refactor/Before/Healthcare/4 - Checklist.md>). The source is historical; this entry owns the retained outcome.

- **Reading guide:** Two halves, both junction work. The chat intent goes through the AI layer — `src/lib/ai/gemini.ts` and `src/app/api/ai-chat/` — and must follow the standing rule that AI proposes and the human confirms (the drafts/proposal pattern, `src/features/drafts/`); never let a model write a dose log directly. Message-to-record wiring precedent: `src/features/hub/messageActions.ts`. The briefing half reads `get_health_bundle()` via `src/app/api/healthcare/route.ts`; the briefing itself is in the AI Assistant junction (`ERA Notes/03 - Junction Modules/AI Assistant/`) with its Focus-briefing cache hard rule. Depends on HLTH-8/9 for there being a dose to log.

### HLTH-18

**Outcome:** Meal-planning allergen badges + recipe list-card dot (needs ingredients in list payload).

- **Acceptance:** Meal-planning allergen badges + recipe list-card dot (needs ingredients in list payload)

**Provenance:** [4 - Checklist.md](<../_Archive/2026-09-10 PM Refactor/Before/Healthcare/4 - Checklist.md>). The source is historical; this entry owns the retained outcome.

- **Reading guide:** The blocker is in the payload, and it is stated in the title: the recipe *list* endpoint does not return ingredients, so a list-card dot has nothing to match on. Start by reading the recipe list route under `src/app/api/recipes/` and confirming that, then decide between widening the payload and a separate lightweight allergen-relevant field — widening a list payload has a real cost on mobile. The matching side is already built and shared: `matchRecipeIngredients()` in `src/lib/health/allergenMatch.ts` with `useHouseholdAllergens()` from `src/hooks/useHouseholdAllergens.ts`, rendered by `src/components/web/RecipeAllergenWarning.tsx`. Meal planning is `src/features/meal-planning/` and `src/components/web/WebMealPlanCalendar.tsx`. Land HLTH-21 first or the badge will silently show "clear" on a failed feed.

### HLTH-20

**Outcome:** Med stock + refill reminders.

- **Acceptance:** Med stock + refill reminders

**Provenance:** [4 - Checklist.md](<../_Archive/2026-09-10 PM Refactor/Before/Healthcare/4 - Checklist.md>). The source is historical; this entry owns the retained outcome.

- **Reading guide:** Parked, and it depends on HLTH-8's `health_medications` existing before stock has anywhere to live. When it restarts: stock is a counter on the medication row, and refill reminders reuse HLTH-14's materialization choke point rather than a new engine. The nearest existing model for "count down and warn" is `src/features/inventory/`. Nothing to read in Healthcare yet beyond the schema.

### HLTH-23

**Accepted specification:** [Catalogue final build plan §10](<../../../docs/Catalogue — ASTRA Deep Dive.md#10-final-build-plan--2026-09-07>), packet C15. Its detailed data/rollout contract applies; earlier Object Memory/Tasks V2 alternatives were withdrawn.

**Outcome:** Select private medical reference records.

- **Acceptance:** Catalogue C15: healthcare reference pickers respect source privacy and lineage; a contact/document link does not become a medication or grant household access.
- **Depends on:** [KIT-20](<../Kitchen/Kitchen — Master Book.md#kit-20>), [HLTH-7](<Healthcare — Master Book.md#hlth-7>).

**Provenance:** [Healthcare — Master Book.md](<../_Archive/2026-09-10 PM Refactor/Before/Healthcare/Healthcare — Master Book.md>). The source is historical; this entry owns the retained outcome.

- **Reading guide:** Depends on KIT-20 and HLTH-7; the accepted specification is the linked Catalogue build plan §10 (packet C15) — read it before the code. The privacy asymmetry is the crux and it already exists in code: `get_health_bundle()` in `src/app/api/healthcare/route.ts` respects `shared_with_household`, while `get_household_allergens()` deliberately does not. A reference picker must not launder the first into the second. Catalogue side: `src/types/catalogue.ts` (the `healthcare` category and its metadata interfaces), `src/features/catalogue/`, and the lineage column `source_catalogue_item_id` used in `src/app/api/items/[id]/promote/route.ts`. "A contact/document link does not become a medication" is a type/lineage invariant, so enforce it in the route and the type, not in the UI.

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
