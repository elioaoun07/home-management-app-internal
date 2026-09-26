---
created: 2026-09-10
updated: 2026-09-26
type: master-book
status: active
owner: Elio
---

# Healthcare — Master Book

[Backlog](<4 - Checklist.md>) · [PM home](<../_index.md>) · [Governance](<../_Conventions.md>)

## Purpose & ownership

Private health records and dependable reminders with explicit evidence limits. Standalone health records with Schedule, Catalogue, Recipes and Notifications junctions.

## Current state & evidence

Core profiles, allergies, conditions, vaccines and warning integration shipped as code July17. Current application, privacy and mobile acceptance remain HLTH-7.

Medications shipped as code 2026-09-26 (HLTH-24, owner request while sick, ahead of the HLTH-19 skill gate): medicine list with dose, full-course vs as-needed, food timing, dose times and course length; a day-by-day taken checklist; one urgent recurring Schedule reminder per dose time, kept in sync both ways with the checklist. Evidence is local only — PGlite fixture run 31/31 and `medicationSchedule.test.ts` 14/14. The migration is **not applied**; until the owner runs it (HLTH-25) "Add medication" fails. Verified Google status (HLTH-9/10), calendar badge (HLTH-11) and the phone alarm battery (HLTH-12) remain.

Refactored 2026-09-10 against repository HEAD `8d952332b0d7917369ce074730cfe830a5c37a97` and dated source studies. This date records document reconciliation, not a fresh runtime, DB or device witness. The [pre-refactor record](<../_Archive/2026-09-10 PM Refactor/Before/Healthcare/Healthcare — Master Book.md>) preserves detailed older narratives and receipts.

## Vision & Decisions

- Conditions/vaccines/profiles are private to the managing user with per-profile household opt-in. Allergies are household-visible through the approved feed, not blanket direct-table sharing. Dependent profiles with user_id NULL are supported. *(IMPLEMENTED as code 2026-07-17; deployment witness HLTH-7)*
- Allergen matching is an editable warning aid, never a cooking gate or proof of safety. Unavailable household evidence must remain unavailable.
- Medication reminders use existing urgent reminder items, one per dose-time, existing recurrence and Google sync. No new alert engine. Dose log uniqueness includes medication, occurrence date and dose time. *(IMPLEMENTED as code 2026-09-26 — HLTH-24: key is `(medication_id, scheduled_at)`, the slot instant; migration pending HLTH-25)*
- Warn-but-allow when Google is disconnected (owner decision July17). Sync is awaited with bookkeeping; an event identifier still does not prove a physical alarm. Schedule edits archive/recreate reminder items; adherence history remains in medication logs. *(Partly IMPLEMENTED 2026-09-26: edits hard-delete and recreate the reminder items in one RPC, then re-mark already-taken doses as completed occurrences; history stays in logs. Google sync is still best-effort — verified bookkeeping is HLTH-9.)*
- Medication model (owner, 2026-09-26): two modes — **full course** (fixed wall-clock dose times from a first-dose instant for N days; N blank = ongoing) and **as needed** (taken based on symptoms, optional minimum gap and daily max, no reminders). Food timing is `any | empty_stomach | with_food`. Dose times live in the medication's own IANA zone so checklist, dose keys and reminders agree when the phone travels. The Health checklist and the Schedule reminder are one fact: ticking either side marks the other (RPC one way, `item_occurrence_actions` trigger the other). *(IMPLEMENTED as code 2026-09-26)*
- Expiry and vaccine reminders use the existing materialization boundary. Healthcare skill HLTH-19 is required before medication math, not a final polish item. UI extraction is only an on-touch rider.

Unresolved policy choices live in the [decision register](<../_Decisions.md>); original exploratory ideas live in [Research options](<../Research/Options.md>). A Later item is retained work, not automatic permission to start.

## Pain Inventory

🔴 **HLTH-25** Medication tracking is code-complete but its migration is not applied — "Add medication" fails until the owner runs it. See [acceptance](<#hlth-25>).

🔴 **HLTH-7** Verify core deployment, household privacy and mobile use. See [acceptance](<#hlth-7>) for the root cause, evidence and gate.

🟠 **HLTH-19** Establish medication safety and privacy contracts. See [acceptance](<#hlth-19>) for the root cause, evidence and gate.

🟠 **HLTH-21** Distinguish unavailable allergy evidence from a completed check. See [acceptance](<#hlth-21>) for the root cause, evidence and gate.



The remaining retained defects, decisions and enhancements are indexed below and ordered once in the checklist. Historical study claims are not new production incidents.

## Acceptance Criteria Index

Item plans use the [execution-plan convention](<../_Conventions.md#9-item-execution-plans>). Read only the selected ID, its declared dependencies and relevant source; planning does not certify deployment or mark work complete.

### HLTH-25

**Outcome:** Apply the medications migration and accept doses + reminders on phone.

**Kind:** verification

**Touches:** none

- **Acceptance:** Owner runs `migrations/2026-09-26_healthcare-medications.sql` in the Supabase SQL Editor (idempotent). Its section 10 holds read-only checks: both new tables show RLS on with a `*_owner_all` policy, `item_occurrence_actions` has the two `health_mirror_occurrence_*` triggers, and `get_health_bundle()` returns `medications` and `medication_logs`.
- **Acceptance (390×844):** add a 3×/day full course → Schedule shows 3 urgent reminders titled "<name> · <dose>"; tick a dose in Health → that occurrence is completed in Schedule; complete the next one from Schedule → it is ticked in Health; un-tick → both revert; the push arrives at the next dose time; delete → reminders disappear and Undo restores them with ticks intact; an as-needed medicine logs "Take" with Undo and shows the minimum-gap wait.
- **Failure case:** "Add medication" failing with a missing `health_save_medication` function means the migration is not applied.
- **Local evidence (not deployment proof), 2026-09-26:** PGlite fixture run against a stub schema, 31/31 — migration re-runs cleanly; 3 reminders per 3-dose course with correct anchors/UNTIL; double tick → 1 log + 1 completed occurrence; Schedule complete/un-complete mirrors; edit replaces reminders with zero duplicates and re-completes taken doses; item cascade delete keeps history; soft delete/restore; as-needed replay idempotent; partner writes denied (P0002/42501) and an unshared profile's medications absent from the partner bundle; malformed time/timezone rejected. `src/lib/health/medicationSchedule.test.ts` 14/14.

- **Reading guide:** Owner-executed; read only to interpret a failure. The migration header NOTES state the contracts. Server: `src/app/api/healthcare/medications/` (`route.ts`, `[id]/route.ts`, `[id]/doses/route.ts`) and `src/lib/health/medicationServer.ts` (Zod, RPC error map, best-effort Google sync around the RPCs). Client: `src/app/healthcare/MedicationsSection.tsx`, hooks in `src/features/healthcare/hooks.ts`, slot math in `src/lib/health/medicationSchedule.ts`. Push delivery is the existing `src/app/api/cron/item-reminders/route.ts`, which only runs if the external scheduler calls it — no push with a correct row points there, not at Healthcare.

### HLTH-7

**Outcome:** Verify core deployment, household privacy and mobile use.

- **Acceptance:** *(bundled into the Phase-0 owner day, packet **E-00**, of the [ERA Top Layer — Master Plan](<../_Archive/Plans/ERA Top Layer — Master Plan (2026-09-02).md>))* (Phase 1) Owner verifies the current core schema and privacy contract, applies missing reviewed SQL only if needed, then verifies mobile viewport + both-accounts allergen warning + privacy (partner cannot see unshared condition)

- **Acceptance:** with the migration run, creating self + partner profiles and a "peanut" allergy makes a recipe containing "peanut butter" show the banner and the inline ingredient flag from **both** accounts, and a private condition is invisible to the partner. Verified on a mobile viewport.

**Provenance:** [4 - Checklist.md](<../_Archive/2026-09-10 PM Refactor/Before/Healthcare/4 - Checklist.md>). The source is historical; this entry owns the retained outcome.

- **Reading guide:** Owner-executed verification; no code change. Read enough to interpret a failure. The page is one RPC: `src/app/api/healthcare/route.ts` calls `get_health_bundle()` (SECURITY DEFINER — its own comment says it returns own profiles plus shared household ones), consumed by `useHealthBundle()` in `src/features/healthcare/hooks.ts` and rendered by `src/app/healthcare/HealthcareClient.tsx`. The allergen half is a *separate* feed: `src/app/api/healthcare/allergens/route.ts` → `get_household_allergens()`, deliberately ignoring `shared_with_household` so a partner cooking sees the allergy, with no medical notes. Both-accounts privacy is therefore two different questions — and per Hard Rule #27 the only repo artifact that is evidence about it is `migrations/db-state.json`, never `schema.sql` or a vault doc. The route slug is `healthcare`, not `health`. Recipe warning surface: `src/components/web/RecipeAllergenWarning.tsx`.


**Execution plan — 2026-09-26**

**Readiness:** owner evidence.

**Verify:** Owner refreshes snapshot, then run `pnpm db:verify-rls`. At 390×844 owner checks self/dependent profiles, both-account peanut warning and private-condition refusal. Record account role, served revision, expected/actual result and applied migration receipt separately.

```delivery-plan-v1
{
  "outcome": "The shipped healthcare core has current deployment, privacy and mobile acceptance evidence.",
  "acceptance": [
    "Both accounts see the household peanut warning and ingredient flag.",
    "An unshared condition remains invisible to the partner; dependent profiles work without an account user_id."
  ],
  "scope": [],
  "steps": [
    "Start with migrations/db-state.json; request a fresh untruncated owner snapshot before evaluating current healthcare access.",
    "Compare the observed core tables, policies, trigger and two RPC bodies with the existing reviewed migration; identify only genuinely missing application.",
    "Owner applies any necessary reviewed SQL and verifies own/shared/private/dependent cases with separate allergen-feed observations.",
    "Record the mobile results and evidence links without treating source-present code as deployment proof."
  ],
  "invariants": [
    "Allergy sharing is a distinct minimal household feed, not blanket sharing of medical notes.",
    "A partner profile is not permission to claim that partner's account identity.",
    "The agent neither applies SQL nor creates live health fixtures."
  ],
  "exclusions": [
    "Medication implementation, general schema repair or changing correct routes before policy evidence."
  ],
  "risks": [
    "A successful bundle read alone does not prove the separate allergen privacy boundary."
  ],
  "unknowns": [
    "Current schema application, two-account privacy and phone behavior await owner evidence."
  ],
  "dependencies": [],
  "risk": "high",
  "provenance": "2026-09-26: Healthcare acceptance/vault contract and parsed snapshot timestamp reviewed. Snapshot is 2026-08-04; no privacy route diagnosis or live verification undertaken.",
  "checks": [],
  "ownerReviewed": false
}
```

### HLTH-19

**Outcome:** Establish medication safety and privacy contracts.

- **2026-09-26:** medication code landed first on owner request (HLTH-24). The skill now codifies shipped contracts — the migration header NOTES and the `src/lib/health/medicationSchedule.ts` header — instead of preceding them.

- **Acceptance:** Author the healthcare domain skill through skill-factory before HLTH-8/9. Cover PHI boundaries, dose math, asymmetric visibility, household allergy availability, dependent profiles with nullable user_id, exactly-once dose materialization and real-device alarm evidence. Do not infer medical safety from ingredient text matching.

**Provenance:** [4 - Checklist.md](<../_Archive/2026-09-10 PM Refactor/Before/Healthcare/4 - Checklist.md>). The source is historical; this entry owns the retained outcome.

- **Reading guide:** Authoring task, and it gates HLTH-8/9. Follow `.claude/skills/skill-factory/SKILL.md` — it has the decision gate and the house template — and ground every rule in code rather than prose. The domains it must cover already have anchors: dose math and exactly-once materialization → `.claude/skills/recurrence-safety/SKILL.md` and `src/lib/schedule/materializeOccurrence.ts`; asymmetric visibility → `get_health_bundle()` (shared/private) versus `get_household_allergens()` (always household-wide) in `src/app/api/healthcare/`; keyword matching's limits → `src/lib/health/allergenMatch.ts` (`deriveDefaultKeywords`, `ALLERGEN_SYNONYMS`, `matchIngredient`) and its own test file. "Do not infer medical safety from ingredient text matching" is the load-bearing sentence — the existing component already calls itself a warning aid, not a guarantee.


**Execution plan — 2026-09-26**

**Readiness:** implementation draft.

**Verify:** Follow skill-factory's junior test: every path and quoted source exists, trigger is clear, scenarios distinguish unsafe outcomes, and skill stays under roughly 150 lines. Run `pnpm sync:ai`, `pnpm docs:check`, `pnpm pm:lint` and `pnpm pm:check-docs` after registration.

```delivery-plan-v1
{
  "outcome": "A compact healthcare risk-domain skill gates medication work and protects health-data boundaries.",
  "acceptance": [
    "The skill covers PHI, nullable dependent identity, asymmetric allergy sharing and unavailable evidence.",
    "It requires explicit dose units, exactly-once materialization and physical alarm evidence before claiming reliability."
  ],
  "scope": [
    ".claude/skills/healthcare-safety/SKILL.md",
    "CLAUDE.md",
    ".claude/skills/start-task/SKILL.md",
    ".claude/skills/fix-bug/SKILL.md"
  ],
  "steps": [
    "Use skill-factory's domain gate and inspect existing recurrence/privacy instructions to avoid overlapping ownership.",
    "Author the proposed healthcare-safety skill from verified source and accepted health contracts; mark medication behavior planned until implemented.",
    "Require worked unit/time examples, dose identity/replay/edit scenarios, explicit PHI boundaries and source-backed evidence limits.",
    "Register its triggers in CLAUDE/start-task, add appropriate failure routing, sync generated mirrors and run a cold-start junior walkthrough."
  ],
  "invariants": [
    "Allergen text matching is a warning aid, never proof of medical safety.",
    "The skill routes to recurrence/timezone/cache rules instead of duplicating them.",
    "No medication schedule or clinical recommendation is invented from missing data."
  ],
  "exclusions": [
    "Building medications, embedding a module encyclopedia or changing healthcare data policy."
  ],
  "risks": [
    "Copying stale route/RPC claims into an authoritative skill propagates unsafe assumptions."
  ],
  "unknowns": [
    "Current deployment evidence remains HLTH-7; future medication names/contracts must be revalidated when they land."
  ],
  "dependencies": [],
  "risk": "high",
  "provenance": "2026-09-26: skill-factory read; allergenMatch.ts:3-10 and healthcare vault invariants inspected; no healthcare skill found in .claude/skills. New path is proposed.",
  "checks": [],
  "ownerReviewed": false
}
```

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


**Execution plan — 2026-09-26**

**Readiness:** implementation draft.

**Verify:** Add the already-specified proposed `tests/allergen-feed-state.test.ts`, then run `pnpm exec vitest run tests/allergen-feed-state.test.ts src/lib/health/allergenMatch.test.ts --reporter=verbose`. Cases: loading, malformed feed, empty success, first 503, cached offline hit and allergy-removal refresh; owner verifies 390×844 separately.

```delivery-plan-v1
{
  "outcome": "Recipe warnings distinguish checked evidence, cached evidence and unavailable allergy data.",
  "acceptance": [
    "Malformed/missing allergens is an error; a successful empty feed alone means checked-empty.",
    "Cached hits survive failed/offline refresh, and ingredient flags update when a successful refresh changes the feed."
  ],
  "scope": [
    "src/hooks/useHouseholdAllergens.ts",
    "src/components/web/RecipeAllergenWarning.tsx",
    "src/components/web/RecipeDetailView.tsx",
    "src/lib/health/allergenFeedState.ts",
    "tests/allergen-feed-state.test.ts"
  ],
  "steps": [
    "Validate the actual feed payload in fetchHouseholdAllergens instead of defaulting malformed input to an empty array.",
    "Add the proposed small allergenFeedState adapter and preserve query status/dataUpdatedAt alongside matched output.",
    "Use the adapter in the actual warning hook/component; retain cached matches through failure and show only a compact availability affordance where ambiguous.",
    "Run differentiating adapter/matcher fixtures and capture the owner mobile cases; attach HLTH-7 privacy evidence separately."
  ],
  "invariants": [
    "No 'safe' claim or cooking gate.",
    "Existing keyword rules, per-ingredient flags and household-allergen cache identity remain intact.",
    "No cached data plus failure stays unavailable."
  ],
  "exclusions": [
    "Changing matching vocabulary, new list-card payloads HLTH-18 or restructuring healthcare privacy."
  ],
  "risks": [
    "Testing an unused adapter while the component still defaults to [] leaves the defect intact."
  ],
  "unknowns": [
    "Current two-account privacy is not established by these local fixtures."
  ],
  "dependencies": [],
  "risk": "high",
  "provenance": "2026-09-26 source: useHouseholdAllergens.ts:19-24 returns data.allergens ?? []; RecipeAllergenWarning.tsx:26-30 defaults query data to []. Adapter/test paths are proposed; no tests run in this planning pass.",
  "checks": [],
  "ownerReviewed": false
}
```

### HLTH-8

**Outcome:** Define idempotent medication storage and materialization.

- **Status 2026-09-26:** delivered as code by HLTH-24 (see Shipped Log) — `health_medications`, `health_medication_logs` with the slot-keyed unique index, `items.source_medication_id` (+ partial index, ON DELETE CASCADE), the occurrence-action mirror triggers and the save / delete / dose / rebuild RPCs. Deviation: edits hard-delete and recreate reminder items (children cascade) rather than archiving; history stays in logs. Application is HLTH-25. The plan below is historical.

- **Acceptance:** *(packet **M-07a** of the [ERA Top Layer — Master Plan](<../_Archive/Plans/ERA Top Layer — Master Plan (2026-09-02).md>); plan sacrifice #3 if a gate is missed)* (Phase 2) Medications migration — `health_medications` + `health_medication_logs` (idempotent unique key), `items.source_medication_id` FK + partial index, occurrence-action mirror trigger, materialization RPCs
- **Depends on:** [HLTH-7](<Healthcare — Master Book.md#hlth-7>), [HLTH-19](<Healthcare — Master Book.md#hlth-19>).

**Provenance:** [4 - Checklist.md](<../_Archive/2026-09-10 PM Refactor/Before/Healthcare/4 - Checklist.md>). The source is historical; this entry owns the retained outcome.

- **Reading guide:** Migration-first and blocked on HLTH-19. Read `migrations/schema.sql` for the `items` table and the existing health tables before designing `health_medications`/`health_medication_logs`; the idempotent unique key is the whole point, so read `.claude/skills/recurrence-safety/SKILL.md` before writing the materialization RPCs — this repo's historical failure mode is duplicate occurrence generation, and there are already two recurrence systems not to add a third to. `items.source_medication_id` follows the existing `source_catalogue_item_id` precedent (see `src/app/api/items/route.ts` and `src/app/api/items/[id]/promote/route.ts`). The occurrence-action mirror trigger has to agree with `src/lib/schedule/materializeOccurrence.ts` and `alertResolution.ts`. Hard Rules #20 (no EXISTS policies on hot child tables), #24 (migration file, then `schema.sql`) and #26 (hand the SQL to the owner; never apply it).


**Execution plan — 2026-09-26**

**Readiness:** split first.

**Verify:** Proposed isolated SQL fixtures cover two dose times, duplicate operation, simultaneous materialization, dependent profile, cross-owner refusal and rollback after child failure. Owner applies reviewed SQL separately; run `pnpm typecheck` and relevant schema/type checks after local changes.

```delivery-plan-v1
{
  "outcome": "Medication storage materializes one reminder per dose time and records each dose action once.",
  "acceptance": [
    "Provide medications/logs, item linkage, partial index, action mirror and transactional materialization RPCs.",
    "Dose log identity includes medication, occurrence date and dose time; repeated actions do not duplicate records."
  ],
  "scope": [
    "migrations/schema.sql",
    "src/features/healthcare/types.ts"
  ],
  "steps": [
    "Wait for HLTH-7 current privacy evidence and HLTH-19 safety rules; read current items/health schema and occurrence-action contracts.",
    "Specify dose units, local-time/occurrence identity, authorization and archive/recreate edit behavior before choosing constraints.",
    "Write a proposed dated migration first, then schema end-state and types; reuse existing item recurrence and efficient access enforcement.",
    "Exercise transactional/race fixtures in isolation and prepare owner inspect/apply/verify instructions; record application separately."
  ],
  "invariants": [
    "No third recurrence/alert engine.",
    "Medication, dose-time reminders and required links commit atomically.",
    "Schedule edits preserve adherence history; nullable dependent user_id is valid."
  ],
  "exclusions": [
    "Routes/calendar delivery HLTH-9, UI HLTH-11, stock/refill features or agent-applied SQL."
  ],
  "risks": [
    "A unique key missing dose time merges distinct daily doses; a non-atomic materializer leaves orphan reminders."
  ],
  "unknowns": [
    "Exact medication columns, dose-unit contract and current occurrence trigger semantics require the safety/design pass."
  ],
  "dependencies": [
    "HLTH-7",
    "HLTH-19"
  ],
  "risk": "high",
  "provenance": "2026-09-26 planning from Healthcare acceptance, vault model and Plans/ERA Top Layer.md. Medication implementation is pending; source/schema and prerequisite evidence must be revalidated at dispatch.",
  "checks": [],
  "ownerReviewed": false
}
```

### HLTH-9

**Outcome:** Verify medication calendar sync with status bookkeeping.

- **Rescoped 2026-09-26:** per-dose reminder creation shipped in HLTH-24 (transactional `health_rebuild_medication_reminders()`, one urgent recurring reminder per dose time). Google sync currently runs best-effort around the RPCs in `src/lib/health/medicationServer.ts` (`unsyncMedicationReminders` before a rebuild, `syncMedicationReminders` after). Remaining: an awaited, *verified* sync outcome persisted as `gcal_status`, and warn-but-allow when disconnected.

- **Acceptance:** Medications routes — transactional item materialization (one `urgent` reminder item per dose-time), **awaited verified** gcal sync with `gcal_status` bookkeeping, warn-but-allow when Google disconnected → `src/lib/gcal/sync.ts`
- **Depends on:** [HLTH-8](<Healthcare — Master Book.md#hlth-8>).

**Provenance:** [4 - Checklist.md](<../_Archive/2026-09-10 PM Refactor/Before/Healthcare/4 - Checklist.md>). The source is historical; this entry owns the retained outcome.

- **Reading guide:** Depends on HLTH-8. Two existing systems to join, not replace. Item creation: `src/app/api/items/route.ts` is the canonical shape for writing an `items` row, and one `urgent` reminder per dose-time must be transactional with the medication write. Calendar: `src/lib/gcal/sync.ts` (`syncItemToGoogleCalendar`, `deleteItemFromGoogleCalendar`) and `src/lib/gcal/client.ts` (`isGoogleCalendarConfigured` for server setup; inspect the authenticated connection separately; `isGoogleNotFoundError` detects a missing Google resource). "Awaited verified" is the operative word: the known historical failure here was a sync that reported success without firing from online mutations, so await the result and record `gcal_status` from it. Warn-but-allow when Google is disconnected is the already-decided behaviour. Hard Rule #6 — an external API call needs an explicit `timeoutMs`. Timezone through `src/lib/utils/date.ts` (Hard Rule #18).


**Execution plan — 2026-09-26**

**Readiness:** split first.

**Verify:** Proposed route fixtures: authorized two-dose create, malformed units/time, dependent owner, transaction rollback, disconnected Google, sync failure, edit and replay. Assert exactly two reminder identities and truthful status; use isolated Calendar fakes, then owner-run real sync.

```delivery-plan-v1
{
  "outcome": "Medication routes create urgent per-dose reminders and report verified calendar synchronization status.",
  "acceptance": [
    "Medication/item writes are transactional with one urgent reminder per dose time.",
    "Await Calendar synchronization and store its actual outcome; Google disconnection warns but permits saving."
  ],
  "scope": [
    "src/app/api/healthcare",
    "src/features/healthcare/types.ts",
    "src/lib/gcal/sync.ts"
  ],
  "steps": [
    "Revalidate HLTH-8 RPCs and the actual Calendar helper result contract; do not equate a swallowed error with success.",
    "Add proposed medication routes with auth/Zod ownership boundaries; delegate item writes to the transaction contract.",
    "Extend the sync seam to return an inspectable outcome if necessary, await it and persist gcal_status accurately.",
    "Implement edit/archive/recreate and inverse behavior through the owning contract, preserving logs; give client long operations an explicit timeout."
  ],
  "invariants": [
    "Two dose times yield two items, never one blended schedule.",
    "Google disconnected remains warn-but-allow, not a save gate.",
    "A stored event ID does not certify that the phone alarm fired."
  ],
  "exclusions": [
    "A new notification engine, silent best-effort success or physical alarm certification."
  ],
  "risks": [
    "Existing sync helpers catch failures internally, so awaiting their return alone may still misreport success."
  ],
  "unknowns": [
    "The verified result shape and authorized bookkeeping path must be established before routes rely on them."
  ],
  "dependencies": [
    "HLTH-8"
  ],
  "risk": "high",
  "provenance": "2026-09-26 planning from Healthcare acceptance, vault model and Plans/ERA Top Layer.md. Medication implementation is pending; source/schema and prerequisite evidence must be revalidated at dispatch.",
  "checks": [],
  "ownerReviewed": false
}
```

### HLTH-10

**Outcome:** Reconcile medication calendar status.

- **Acceptance:** Extend reconcile cron — med items first, heal `gcal_status` both ways → `src/app/api/cron/gcal-reconcile/route.ts`
- **Depends on:** [HLTH-9](<Healthcare — Master Book.md#hlth-9>).

**Provenance:** [4 - Checklist.md](<../_Archive/2026-09-10 PM Refactor/Before/Healthcare/4 - Checklist.md>). The source is historical; this entry owns the retained outcome.

- **Reading guide:** Small extension of an existing cron: `src/app/api/cron/gcal-reconcile/route.ts`, which already has `maxDuration = 60`, the `Bearer CRON_SECRET` check and `supabaseAdmin()` (Hard Rule #8). Read its current reconcile loop and put med items first; healing `gcal_status` both ways means it can also clear a stale status, not only set one. The sync primitives it calls are in `src/lib/gcal/sync.ts`. There is no `vercel.json` — this cron only runs if an external scheduler invokes it, so any acceptance needs a last-run trace, not an assumption.


**Execution plan — 2026-09-26**

**Readiness:** implementation draft.

**Verify:** Proposed reconcile fixtures cover medication priority, missing event, stale success, disconnected account, per-item failure and bounded job budget. Run `pnpm typecheck` and `pnpm lint`; owner records an authenticated scheduled run and actual status repair.

```delivery-plan-v1
{
  "outcome": "Calendar reconciliation prioritizes medication items and corrects status in both directions.",
  "acceptance": [
    "Medication items are processed before ordinary eligible items.",
    "A vanished/failed Calendar event clears stale success while successful repair restores the correct status."
  ],
  "scope": [
    "src/app/api/cron/gcal-reconcile/route.ts",
    "src/lib/gcal/sync.ts"
  ],
  "steps": [
    "Read the current bounded reconcile loop and HLTH-9's verified sync outcome; identify how medication linkage and status are selected.",
    "Process medication items first without starving or duplicating the remaining eligible set.",
    "Derive gcal_status from verified outcomes, including failed/deleted/disconnected cases rather than success-only updates.",
    "Test partial failures and limits; use HUB-38 liveness evidence or an explicit owner last-run trace to verify actual scheduling."
  ],
  "invariants": [
    "Auth/admin/maxDuration controls stay in place.",
    "A caught sync failure does not increment a verified-success count.",
    "Reconcile cannot claim phone alarm delivery."
  ],
  "exclusions": [
    "New scheduler configuration, broad calendar semantics changes or automatic production repair by an agent."
  ],
  "risks": [
    "Incrementing synced after a best-effort helper returns can overstate repaired medication alarms."
  ],
  "unknowns": [
    "Current scheduler liveness and deployed HLTH-9 status semantics."
  ],
  "dependencies": [
    "HLTH-9"
  ],
  "risk": "high",
  "provenance": "2026-09-26 planning from Healthcare acceptance, vault model and Plans/ERA Top Layer.md. Medication implementation is pending; source/schema and prerequisite evidence must be revalidated at dispatch.",
  "checks": [],
  "ownerReviewed": false
}
```

### HLTH-11

**Outcome:** Show medication calendar status and Connect Google.

- **Rescoped 2026-09-26:** the medications card (schedule, course day, taken/total, next dose), the day-by-day dose checklist and as-needed "Take" shipped in HLTH-24 (`src/app/healthcare/MedicationsSection.tsx`). Remaining: a per-medication Google status badge from HLTH-9's bookkeeping and the "Connect Google" CTA. Effort re-estimated S.

- **Acceptance:** Medications UI — meds card (status, next dose, gcal badge), adherence history, "Connect Google" CTA
- **Depends on:** [HLTH-9](<Healthcare — Master Book.md#hlth-9>).

**Provenance:** [4 - Checklist.md](<../_Archive/2026-09-10 PM Refactor/Before/Healthcare/4 - Checklist.md>). The source is historical; this entry owns the retained outcome.

- **Reading guide:** UI only, on top of HLTH-9's data. The page is `src/app/healthcare/HealthcareClient.tsx`; add the meds card beside the existing allergy/condition/vaccine cards and follow their mutation pattern in `src/features/healthcare/hooks.ts` (`useCreateHealthAllergy` and siblings are the template — optimistic mutation, `healthcareKeys` invalidation from `src/features/healthcare/queryKeys.ts`). The "Connect Google" CTA uses the authenticated connection-status API; server configuration alone is insufficient, and refresh tokens never enter the client. Hard Rules: #1 (Undo on destructive actions, `ToastIcons`), #3 (no red on individual rows), #5 (mobile-first), #28 (a status pill and a number, not explanatory prose).


**Execution plan — 2026-09-26**

**Readiness:** implementation draft.

**Verify:** Use the HLTH-9 mocked contract to verify pending/failed/disconnected/synced states, two upcoming doses, history retention and real Undo. Run `pnpm typecheck` and `pnpm lint`; owner checks 390×844 with both permitted account roles.

```delivery-plan-v1
{
  "outcome": "Healthcare shows medication status, next dose, adherence history and a working Connect Google action.",
  "acceptance": [
    "Cards expose actual medication/calendar state and the next dose from the canonical schedule.",
    "Adherence reflects stored dose logs; editing or archiving retains history and truthful mutation outcomes."
  ],
  "scope": [
    "src/app/healthcare/HealthcareClient.tsx",
    "src/features/healthcare/hooks.ts",
    "src/features/healthcare/queryKeys.ts",
    "src/features/healthcare/types.ts"
  ],
  "steps": [
    "Read HLTH-9 response/status shapes and the existing health hooks before adding a medication card.",
    "Add narrowly scoped hooks and invalidation using healthcare query keys, preserving the health/allergen separation.",
    "Render status, next dose and history with compact controls; derive Connect Google availability from the authenticated connection API.",
    "Wire edit/archive/inverse states to existing domain routes and test failed/offline saves without false confirmation."
  ],
  "invariants": [
    "The UI does not calculate a separate dose schedule.",
    "Secrets/refresh tokens never reach the client; configuration presence is not a user's connection.",
    "Minimal text, theme/person identity and mobile control rules apply."
  ],
  "exclusions": [
    "Stock/refill reminders, new clinical recommendations or broad HealthcareClient extraction."
  ],
  "risks": [
    "A local connected flag can advertise alarms after the actual Google connection expired."
  ],
  "unknowns": [
    "Available adherence controls and inverse payloads depend on HLTH-8/9 final contracts."
  ],
  "dependencies": [
    "HLTH-9"
  ],
  "risk": "high",
  "provenance": "2026-09-26 planning from Healthcare acceptance, vault model and Plans/ERA Top Layer.md. Medication implementation is pending; source/schema and prerequisite evidence must be revalidated at dispatch.",
  "checks": [],
  "ownerReviewed": false
}
```

### HLTH-12

**Outcome:** Verify dose, edit, replay and physical alarm behavior.

- **2026-09-26:** the medication pieces now exist (HLTH-24). Exactly-once = `health_medication_logs_slot_key` + `health_set_dose()`; edit = `health_rebuild_medication_reminders()` replace-not-append; as-needed doses carry client ids. The Health UI does not queue dose ticks offline yet (it errors), so "offline replay = one row" needs a queue path first or a scoped exclusion.

- **Acceptance:** Verification battery — 2-dose med = exactly 2 items/events; native alarm with app closed; edit → zero duplicates; offline dose log replay = one row
- **Depends on:** [HLTH-9](<Healthcare — Master Book.md#hlth-9>), [HLTH-10](<Healthcare — Master Book.md#hlth-10>), [HLTH-11](<Healthcare — Master Book.md#hlth-11>).

- **Acceptance:** a 2-dose medication produces exactly 2 items and 2 Google events; the native alarm fires with the app closed on a real phone; a schedule edit produces zero duplicate occurrences; an offline dose log replays to exactly one row.

**Provenance:** [4 - Checklist.md](<../_Archive/2026-09-10 PM Refactor/Before/Healthcare/4 - Checklist.md>). The source is historical; this entry owns the retained outcome.

- **Reading guide:** A verification battery, not a feature — most of it cannot be proved in-repo. What the repo can tell you: exactly-once is a property of HLTH-8's unique key and the RPCs, edit-without-duplicates is a property of `src/lib/schedule/materializeOccurrence.ts` and `expandOccurrences.ts` (which has its own test, `expandOccurrences.test.ts`), and offline dose replay is a property of the IndexedDB queue in `src/lib/offlineQueue.ts` plus `src/lib/offlineSyncEngine.ts` — replay-to-exactly-one-row is that queue's idempotency, so read `ERA Notes/01 - Architecture/Sync and Offline.md`. The Google Calendar native alarm with the app closed needs a real phone; this does not require the Native App shell to be built. Nothing in this repo proves physical delivery.


**Execution plan — 2026-09-26**

**Readiness:** split first.

**Verify:** Proposed automated/isolated battery asserts 2 dose times→2 item/event identities, same-action replay→1 log, edit→no duplicate active occurrence and history retained. Owner separately records real-phone alarm with app closed, lock state, versions, timing and expected/actual result.

```delivery-plan-v1
{
  "outcome": "Medication dose identity, edits, offline replay and physical alarm behavior have separate recorded evidence.",
  "acceptance": [
    "A two-dose medication produces exactly two reminder items and two Google events.",
    "Schedule edit creates no duplicate occurrences; offline dose replay writes one log; phone alarm fires with the app closed."
  ],
  "scope": [],
  "steps": [
    "Collect HLTH-9/10/11 implementation and manual-application receipts; list any missing automated fixtures as a bounded test sheet before owner acceptance.",
    "Run the isolated identity/edit/replay battery against actual materialization and queue boundaries, including duplicate delivery of the same operation.",
    "Prepare owner UAT steps for Google connection, two events, drift repair and alarm while locked/app closed.",
    "Record automated, applied and physical-device results separately; leave only failed/unverified claims pending and create scoped engineering follow-up for reproduced defects."
  ],
  "invariants": [
    "Event creation and native alarm delivery are different observations.",
    "No live health/medication fixtures are created by the agent.",
    "Offline replay proof uses a durable stored operation, not a simulated success toast."
  ],
  "exclusions": [
    "New medication behavior, browser-only proof of phone alarms or an assumed Native App shell dependency."
  ],
  "risks": [
    "A correct database row can coexist with a disabled phone/calendar notification setting."
  ],
  "unknowns": [
    "Owner credentials/device access and exact delivered platform versions."
  ],
  "dependencies": [
    "HLTH-9",
    "HLTH-10",
    "HLTH-11"
  ],
  "risk": "high",
  "provenance": "2026-09-26 planning from Healthcare acceptance, vault model and Plans/ERA Top Layer.md. Medication implementation is pending; source/schema and prerequisite evidence must be revalidated at dispatch.",
  "checks": [],
  "ownerReviewed": false
}
```

### HLTH-22

**Outcome:** Cover core healthcare route contracts.

- **Acceptance:** Reverify current core routes and test authentication, dependent profiles, partner sharing/opt-in, unavailable allergy feed and Zod/error boundaries. Historical ten-route count is not a current guarantee.
- **Depends on:** [HLTH-7](<Healthcare — Master Book.md#hlth-7>).

**Provenance:** [Healthcare — Master Book.md](<../_Archive/2026-09-10 PM Refactor/Before/Healthcare/Healthcare — Master Book.md>). The source is historical; this entry owns the retained outcome.

- **Reading guide:** Re-inventory before testing — the historical ten-route count is not a guarantee. Re-inventoried 2026-09-26: there are 10 route files under `src/app/api/healthcare/` (`route.ts` = the `get_health_bundle` bundle, plus `allergens/`, and collection+`[id]` pairs for `allergies`, `conditions`, `profiles`, `vaccines`), and a separate `src/app/api/health/route.ts` that is the connectivity probe used by `safeFetch`/`isReallyOnline` — not a healthcare route; do not test or change it here. Template for what a correct route looks like: `.claude/skills/api-route/SKILL.md` and `src/app/api/accounts/route.ts` (auth → Zod → household linking → error mapping, 23505→409). The four contract axes each have a concrete anchor: authentication (every route's `supabase.auth.getUser()` guard), dependent profiles (nullable `user_id` on health profiles — check `migrations/schema.sql`), partner sharing/opt-in (`shared_with_household` honoured by `get_health_bundle()` but deliberately *not* by `get_household_allergens()`), and unavailable allergy feed (HLTH-21 owns the client half; here it is the route's error shape). Depends on HLTH-7.


**Execution plan — 2026-09-26**

**Readiness:** implementation draft.

**Verify:** Add proposed route-contract tests using existing Vitest tooling; cover auth, dependent identity, denied target, shared/private responses, malformed input, 23505 and failed allergen RPC. Run the new scoped tests, `pnpm typecheck` and `pnpm lint`; owner privacy evidence remains HLTH-7.

```delivery-plan-v1
{
  "outcome": "Current core healthcare routes have executable contract coverage without mistaking mocks for RLS proof.",
  "acceptance": [
    "Inventory the current routes and cover auth, nullable dependent user_id, sharing/opt-in and error boundaries.",
    "An unavailable allergen RPC stays an error rather than a successful empty feed."
  ],
  "scope": [
    "src/app/api/healthcare",
    "tests"
  ],
  "steps": [
    "Enumerate the ten current healthcare route files and their methods; exclude the unrelated /api/health connectivity probe.",
    "Map each method to its authenticated ownership, Zod and error response contract; inspect HLTH-7's separate live privacy receipts.",
    "Add proposed focused route suites with injected Supabase/RPC results for positive and negative cases.",
    "Fix only reproduced contract discrepancies in the owning route and preserve the intended minimal household allergy feed."
  ],
  "invariants": [
    "Mocked policy success cannot certify deployed RLS.",
    "Dependent profiles may have null user_id; session ownership remains authoritative.",
    "Shared allergens do not imply shared conditions or medical notes."
  ],
  "exclusions": [
    "Medication route coverage, real production fixtures or broad healthcare API refactoring."
  ],
  "risks": [
    "Copying a stale route count can leave an actual method untested."
  ],
  "unknowns": [
    "Any route contract differing from the accepted privacy model requires evidence before deciding the repair."
  ],
  "dependencies": [
    "HLTH-7"
  ],
  "risk": "high",
  "provenance": "2026-09-26: rg --files src/app/api/healthcare returned ten routes, correcting the guide's eleven. Planning uses accepted privacy contracts; methods/source require test-authoring revalidation.",
  "checks": [],
  "ownerReviewed": false
}
```

### HLTH-13

**Outcome:** Extend healthcare catalogue metadata (insurance fields + expiry) in types + detail/edit dialogs.

- **Acceptance:** Extend healthcare catalogue metadata (insurance fields + expiry) in types + detail/edit dialogs → `src/types/catalogue.ts`

**Provenance:** [4 - Checklist.md](<../_Archive/2026-09-10 PM Refactor/Before/Healthcare/4 - Checklist.md>). The source is historical; this entry owns the retained outcome.

- **Reading guide:** Read `HealthcareItemMetadata` and `DocumentItemMetadata` in `src/types/catalogue.ts`; doctor/contact fields and document `expiry_date` already exist. The actual edit/detail surfaces are `src/components/web/CatalogueItemDialog.tsx` and `CatalogueItemDetailDialog.tsx`, with Catalogue route validation. Confirm the bounded insurance field list, then keep types, validation and UI aligned without replacing unrelated metadata. A JSON metadata field change does not itself require a table migration; follow migration-first only when a database schema/constraint change is actually needed. Expiry behavior belongs to HLTH-14.


**Execution plan — 2026-09-26**

**Readiness:** investigation first.

**Verify:** Proposed metadata fixtures round-trip existing doctor fields, accepted insurance fields, empty values and expiry dates without deleting unrelated metadata. Verify edit/detail parity at 390×844; run `pnpm typecheck` and `pnpm lint`. Add SQL checks only if an actual schema/constraint change is required.

```delivery-plan-v1
{
  "outcome": "Healthcare Catalogue records support the agreed insurance and expiry metadata.",
  "acceptance": [
    "Types, validation and detail/edit surfaces preserve the accepted fields and existing records.",
    "Expiry is stored/displayed consistently; reminder behavior remains HLTH-14."
  ],
  "scope": [
    "src/types/catalogue.ts",
    "src/app/api/catalogue/items",
    "src/components/web/CatalogueItemDialog.tsx",
    "src/components/web/CatalogueItemDetailDialog.tsx"
  ],
  "steps": [
    "Inspect HealthcareItemMetadata, DocumentItemMetadata and current per-kind form/validation support; list the missing insurance fields without guessing a broad medical schema.",
    "Confirm only the field names/meaning the owner needs, then extend the existing metadata kind and validated patch contract.",
    "Render compact inputs and details, preserving unknown legacy metadata and source privacy through update/Undo.",
    "Verify old and new records round-trip; propose a migration only for a verified database schema/constraint change."
  ],
  "invariants": [
    "A JSON metadata field addition alone does not automatically require new columns or tables.",
    "No clinical detail is copied into generic contact/document search.",
    "Clearing one field cannot replace unrelated metadata."
  ],
  "exclusions": [
    "Expiry scheduling, medication data, insurance advice or redesigning Catalogue kinds."
  ],
  "risks": [
    "Whole-object metadata replacement can erase fields the current dialog does not understand."
  ],
  "unknowns": [
    "The short acceptance does not enumerate insurance fields; settle that bounded content choice before adding inputs."
  ],
  "dependencies": [
    "KIT-20"
  ],
  "risk": "medium",
  "provenance": "2026-09-26: catalogue.ts HealthcareItemMetadata:482 and DocumentItemMetadata:540 inspected; current doctor and document expiry fields exist. Final insurance field list remains unspecified.",
  "checks": [],
  "ownerReviewed": false
}
```

### HLTH-14

**Outcome:** Generic expiry→reminder-item materialization via `source_catalogue_item_id` (also revives dead `DocumentItemMetadata.expiry_date`).

- **Acceptance:** Generic expiry→reminder-item materialization via `source_catalogue_item_id` (also revives dead `DocumentItemMetadata.expiry_date`)

**Provenance:** [4 - Checklist.md](<../_Archive/2026-09-10 PM Refactor/Before/Healthcare/4 - Checklist.md>). The source is historical; this entry owns the retained outcome.

- **Reading guide:** The link column already exists and is used: `items.source_catalogue_item_id` is written in `src/app/api/items/route.ts`, read back in `src/app/api/catalogue/items/[id]/route.ts` and `src/app/api/items/[id]/promote/route.ts`, and surfaced as `isLinkedToCatalogue` in `src/components/items/ItemDetailModal.tsx`. So this is a materialization choke point over an existing relation, not a new one — and HLTH-16 is meant to reuse the same one, so design it generically. `DocumentItemMetadata.expiry_date` in `src/types/catalogue.ts` is the dead field to revive. Exactly-once rules: `.claude/skills/recurrence-safety/SKILL.md`; do not add a third expansion engine. Dates through `src/lib/utils/date.ts`.


**Execution plan — 2026-09-26**

**Readiness:** split first.

**Verify:** Proposed isolated materialization fixtures cover create, repeated trigger, expiry edit/removal, source archive, ownership refusal and inverse. Assert one active reminder identity and no orphan after failure; run Schedule tests/`pnpm typecheck` and `pnpm lint`. Owner-applied migration and phone alert evidence remain separate.

```delivery-plan-v1
{
  "outcome": "Catalogue expiry fields materialize a single linked reminder through a reusable boundary.",
  "acceptance": [
    "Document expiry_date and accepted healthcare expiry use the same source-linked reminder contract.",
    "Replays and edits reconcile the same logical source reminder without duplicates or losing its source relationship."
  ],
  "scope": [
    "src/app/api/catalogue/items",
    "src/lib/schedule",
    "src/types/catalogue.ts",
    "src/features/catalogue/hooks.ts",
    "migrations"
  ],
  "steps": [
    "Read source_catalogue_item_id, expiry_date and reminder_before_days plus current item creation/inverse contracts.",
    "Define when the user enables the reminder and its lead-time/timezone semantics; reuse an existing choice where present rather than inventing a default.",
    "Implement one proposed materialization seam with source identity and transactional link/replace behavior, then integrate owning Catalogue mutations.",
    "Test duplicate requests, expiry changes, removal and source archive/Undo; prepare reviewed SQL only for actual missing identity/constraint support."
  ],
  "invariants": [
    "No new recurrence or alert engine.",
    "A missing/unknown expiry creates no invented due date.",
    "Reminder scope cannot broaden access to a private document or health source."
  ],
  "exclusions": [
    "Automatic policy adoption, clinical scheduling advice, stock refills or separate vaccine-specific engine."
  ],
  "risks": [
    "Updating expiry by inserting another item can leave the previous reminder active."
  ],
  "unknowns": [
    "Accepted opt-in/lead-time behavior and current materialization atomicity; inventory/design can proceed before that choice."
  ],
  "dependencies": [],
  "risk": "high",
  "provenance": "2026-09-26 planning from current Healthcare acceptance and vault contracts; schema/types and producer APIs must be revalidated before implementation. No live PHI, permission or deployment verification.",
  "checks": [],
  "ownerReviewed": false
}
```

### HLTH-15

**Outcome:** Doctor pickers on health record forms + Care Contacts card on the health page.

- **Acceptance:** Doctor pickers on health record forms + Care Contacts card on the health page

**Provenance:** [4 - Checklist.md](<../_Archive/2026-09-10 PM Refactor/Before/Healthcare/4 - Checklist.md>). The source is historical; this entry owns the retained outcome.

- **Reading guide:** Two small surfaces. Doctors live in the catalogue's `healthcare` category (`src/types/catalogue.ts`, `doctor_name` at ~line 483) — the picker should read catalogue items through `src/features/catalogue/`, and because Healthcare and Catalogue are both standalone, any shared picker belongs in `src/components/` or `src/lib/`, never a cross-feature import. The forms to extend are the record dialogs in `src/app/healthcare/HealthcareClient.tsx` with mutations from `src/features/healthcare/hooks.ts`. The Care Contacts card is a read-only card on the same page.


**Execution plan — 2026-09-26**

**Readiness:** implementation draft after reference contract.

**Verify:** Proposed picker fixtures cover permitted doctor, wrong kind, revoked/deleted reference and a private dependent profile. Verify Care Contacts and form selection at 390×844, preserving historical provider text; run `pnpm typecheck` and `pnpm lint` and relevant HLTH-22/C15 contract tests once present.

```delivery-plan-v1
{
  "outcome": "Health forms can select permitted doctors and show useful Care Contacts.",
  "acceptance": [
    "The picker selects an authorized compatible Catalogue reference rather than duplicating its contact fields.",
    "The card exposes permitted current contact details without revealing private patient usage."
  ],
  "scope": [
    "src/app/healthcare/HealthcareClient.tsx",
    "src/features/healthcare/hooks.ts",
    "src/features/healthcare/types.ts",
    "src/components/healthcare"
  ],
  "steps": [
    "Use HLTH-23's validated reference contract and shared Catalogue lookup; identify which existing condition/vaccine forms can hold catalogue_item_id.",
    "Add a proposed shared picker under src/components/healthcare with selected-ID identity and explicit missing/revoked state.",
    "Add the compact Care Contacts card from authorized linked references, keeping clinical record/history content in Healthcare.",
    "Verify doctor edits refresh permitted previews and a removed reference does not erase historical provider text."
  ],
  "invariants": [
    "Healthcare and Catalogue standalone feature directories do not import each other.",
    "A shared doctor contact does not make a profile or condition shared.",
    "The patient/subject is not assumed to be the source record's owner."
  ],
  "exclusions": [
    "New contact database, medication prescribing, automatic changes to visit history or duplicate C15 authorization work."
  ],
  "risks": [
    "A reverse contact-use count can expose the existence of private medical records."
  ],
  "unknowns": [
    "Which forms have an existing compatible reference slot and current HLTH-23 API contract require revalidation."
  ],
  "dependencies": [
    "HLTH-23"
  ],
  "risk": "high",
  "provenance": "2026-09-26 planning from current Healthcare acceptance and vault contracts; schema/types and producer APIs must be revalidated before implementation. No live PHI, permission or deployment verification.",
  "checks": [],
  "ownerReviewed": false
}
```

### HLTH-16

**Outcome:** Vaccine `next_due_on` booster reminders via the same materialization choke point.

- **Acceptance:** Vaccine `next_due_on` booster reminders via the same materialization choke point

**Provenance:** [4 - Checklist.md](<../_Archive/2026-09-10 PM Refactor/Before/Healthcare/4 - Checklist.md>). The source is historical; this entry owns the retained outcome.

- **Reading guide:** Deliberately dependent on HLTH-14's choke point — read that guide first and reuse it rather than writing a vaccine-specific path. The vaccine record and its `next_due_on` come through `get_health_bundle()` (`src/app/api/healthcare/route.ts`, typed in `src/features/healthcare/types.ts`) and the CRUD routes under `src/app/api/healthcare/vaccines/`. Mutations: `useCreateHealthVaccine`/`useUpdateHealthVaccine` in `src/features/healthcare/hooks.ts`.


**Execution plan — 2026-09-26**

**Readiness:** implementation draft after materialization contract.

**Verify:** Proposed fixtures cover vaccine next_due_on create/edit/clear, repeated request, dependent profile, private source and archive/Undo. Verify one active linked booster reminder and unchanged administered history. Run affected Schedule/health route tests, `pnpm typecheck` and `pnpm lint`; owner verifies real alert separately.

```delivery-plan-v1
{
  "outcome": "A vaccine's recorded next due date can produce one linked booster reminder.",
  "acceptance": [
    "Use HLTH-14's materialization boundary and the stored next_due_on value.",
    "Edits/removal update the source-linked reminder without duplicate occurrences or altered vaccine history."
  ],
  "scope": [
    "src/app/api/healthcare/vaccines",
    "src/features/healthcare/hooks.ts",
    "src/features/healthcare/types.ts",
    "src/lib/schedule",
    "migrations"
  ],
  "steps": [
    "Read the existing next_due_on DTO and HLTH-14 source-identity contract; verify the current schema has no suitable reminder link before proposing one.",
    "Bind the vaccine source to the shared materializer with authenticated manager/profile scope.",
    "Reconcile create/edit/clear/archive and real inverse behavior transactionally, preserving administered_on and historical provider data.",
    "Test replay and date boundaries, then hand any required linkage migration to the owner with isolated verification cases."
  ],
  "invariants": [
    "No calculated medical booster interval; the owner-entered due date is authoritative.",
    "A private health source does not become a household-visible clinical title by default.",
    "No independent vaccine expansion engine."
  ],
  "exclusions": [
    "Vaccine recommendations, blanket household sharing, medication materialization or agent-applied SQL."
  ],
  "risks": [
    "Reusing a Catalogue FK for a vaccine record would misrepresent lineage; source type must remain explicit."
  ],
  "unknowns": [
    "Final shared materializer's source identity and privacy-safe reminder-title behavior need confirmation."
  ],
  "dependencies": [
    "HLTH-14"
  ],
  "risk": "high",
  "provenance": "2026-09-26 planning from current Healthcare acceptance and vault contracts; schema/types and producer APIs must be revalidated before implementation. No live PHI, permission or deployment verification.",
  "checks": [],
  "ownerReviewed": false
}
```

### HLTH-17

**Outcome:** Hub Chat "took my pill" intent (propose→confirm) + briefing signals from `get_health_bundle`.

- **Acceptance:** Hub Chat "took my pill" intent (propose→confirm) + briefing signals from `get_health_bundle`

**Provenance:** [4 - Checklist.md](<../_Archive/2026-09-10 PM Refactor/Before/Healthcare/4 - Checklist.md>). The source is historical; this entry owns the retained outcome.

- **Reading guide:** Use the shared ERA turn/capability/proposal path (`src/features/era/capabilities/`, `intents/`, `useEraAskAI.ts`) rather than extending the floating `/api/ai-chat` assistant. Medication dose identity/materialization comes from HLTH-8/9 and its safety contract from HLTH-19. The model proposes an exact dose candidate; the human confirms through the medication owner's route. Briefing integration reads the authorized health bundle through HUB-41 coverage/provenance, preserving profile privacy; pending medication features remain fixture-only. Two bounded sheets, no direct model dose logging.


**Execution plan — 2026-09-26**

**Readiness:** split first.

**Verify:** Proposed capability fixtures cover one known pending dose, two possible doses, already logged dose, stale target and failed confirmation. Assert zero log before confirmation and one on replay. Test private/partial briefing reads; run affected ERA tests/`pnpm typecheck` and `pnpm lint`.

```delivery-plan-v1
{
  "outcome": "ERA can propose a dose log and surface permitted Healthcare briefing facts.",
  "acceptance": [
    "'Took my pill' resolves an exact medication/dose candidate and requires confirmation.",
    "Briefing signals use authorized health facts with coverage; no clinical safety claim or automatic medication write is inferred."
  ],
  "scope": [
    "src/features/era/capabilities",
    "src/features/era/intents",
    "src/features/era/useEraAskAI.ts",
    "src/lib/ai/context.ts",
    "src/features/healthcare"
  ],
  "steps": [
    "Wait for HLTH-8/9 dose identities and HLTH-19 safety contract; inspect the shared ERA turn/proposal path.",
    "Implement one dose-log capability that reads eligible candidates, asks on ambiguity and delegates confirmed writes to the medication owner.",
    "Bind result/replay to the dose identity and HUB-47 verified-outcome gate rather than learning from a proposal.",
    "Add the separately scoped Healthcare briefing adapter through HUB-41; preserve subject/manager sharing and unavailable evidence."
  ],
  "invariants": [
    "No model directly records adherence.",
    "The date and dose time are part of identity; a medication name alone is insufficient.",
    "Generic household context excludes private clinical rows."
  ],
  "exclusions": [
    "Extending the floating ai-chat assistant, inventing dose schedules, medication advice or a new log store."
  ],
  "risks": [
    "A conversational 'it' can point to yesterday's dose or a different dependent without explicit grounding."
  ],
  "unknowns": [
    "Current medication API and confirmation/inverse contract; pending functionality stays fixture-only."
  ],
  "dependencies": [
    "HLTH-8",
    "HLTH-9",
    "HLTH-19",
    "HUB-41"
  ],
  "risk": "high",
  "provenance": "2026-09-26 planning from current Healthcare acceptance and vault contracts; schema/types and producer APIs must be revalidated before implementation. No live PHI, permission or deployment verification.",
  "checks": [],
  "ownerReviewed": false
}
```

### HLTH-18

**Outcome:** Meal-planning allergen badges + recipe list-card dot (needs ingredients in list payload).

- **Acceptance:** Meal-planning allergen badges + recipe list-card dot (needs ingredients in list payload)

**Provenance:** [4 - Checklist.md](<../_Archive/2026-09-10 PM Refactor/Before/Healthcare/4 - Checklist.md>). The source is historical; this entry owns the retained outcome.

- **Reading guide:** The blocker is in the payload, and it is stated in the title: the recipe *list* endpoint does not return ingredients, so a list-card dot has nothing to match on. Start by reading the recipe list route under `src/app/api/recipes/` and confirming that, then decide between widening the payload and a separate lightweight allergen-relevant field — widening a list payload has a real cost on mobile. The matching side is already built and shared: `matchRecipeIngredients()` in `src/lib/health/allergenMatch.ts` with `useHouseholdAllergens()` from `src/hooks/useHouseholdAllergens.ts`, rendered by `src/components/web/RecipeAllergenWarning.tsx`. Meal planning is `src/features/meal-planning/` and `src/components/web/WebMealPlanCalendar.tsx`. Land HLTH-21 first or the badge will silently show "clear" on a failed feed.


**Execution plan — 2026-09-26**

**Readiness:** implementation draft after availability contract.

**Verify:** Proposed fixtures cover a list recipe with a known hit, successful no-hit, missing ingredients, first feed failure and cached offline hit. Measure payload/request change and verify list/calendar at 390×844. Run matcher/availability tests and `pnpm typecheck` and `pnpm lint`.

```delivery-plan-v1
{
  "outcome": "Recipe lists and meal planning show compact allergen indicators with truthful evidence limits.",
  "acceptance": [
    "Indicators use actual ingredient evidence and HLTH-21 feed availability.",
    "Missing payload or failed household feed cannot render as checked-clear; detail ingredient flags remain intact."
  ],
  "scope": [
    "src/app/api/recipes/route.ts",
    "src/features/recipes",
    "src/components/web/WebRecipes.tsx",
    "src/components/web/WebMealPlanCalendar.tsx",
    "src/components/web/RecipeAllergenWarning.tsx"
  ],
  "steps": [
    "Measure the current lean list payload, which omits ingredients, and identify the minimum authorized matching input needed by both surfaces.",
    "Choose a bounded projection or shared matching read based on measured payload cost; avoid per-card requests and do not persist a viewer-specific result globally.",
    "Use the existing matcher and HLTH-21 availability adapter for the recipe dot and meal badge.",
    "Verify known hits, no-hit and unavailable states, preserving the existing detail warning and minimal UI wording."
  ],
  "invariants": [
    "Keyword matching is not a food-safety guarantee or cooking gate.",
    "Cached allergy hits remain visible when refresh fails.",
    "Recipe ownership and household allergy scope remain separate."
  ],
  "exclusions": [
    "New allergy vocabulary, ingredient normalization, clinical advice or widening every recipe response without need."
  ],
  "risks": [
    "A dot computed without ingredients silently suggests an all-clear; an oversized list payload harms mobile use."
  ],
  "unknowns": [
    "The smallest efficient input projection and final availability adapter contract need dispatch-time measurement."
  ],
  "dependencies": [
    "HLTH-21"
  ],
  "risk": "high",
  "provenance": "2026-09-26: recipes/route.ts:43-48 confirmed lean selection omits ingredients; Healthcare retained contract and existing matcher/feed surfaces reviewed.",
  "checks": [],
  "ownerReviewed": false
}
```

### HLTH-20

**Outcome:** Med stock + refill reminders.

- **Acceptance:** Med stock + refill reminders

**Provenance:** [4 - Checklist.md](<../_Archive/2026-09-10 PM Refactor/Before/Healthcare/4 - Checklist.md>). The source is historical; this entry owns the retained outcome.

- **Reading guide:** Parked. HLTH-8 must establish the medication model before stock can be designed. The owner has not yet specified stock units, refill threshold, variable/as-needed use or the consumption/Undo contract; a counter on the medication row is an option, not an accepted schema. On resumption, compare the existing Inventory patterns and HLTH-14 materialization boundary, then record the smallest accepted stock/refill contract before implementation. Do not infer prescribed usage or depletion dates.


**Execution plan — 2026-09-26**

**Readiness:** parked; exploration only.

**Verify:** When the owner resumes this item, use worked nonclinical inventory scenarios for dose logging/Undo, refill, variable use and duplicate replay. Verify that an unknown unit/count never produces a confident depletion date. No runtime tests or implementation are required while parked.

```delivery-plan-v1
{
  "outcome": "A bounded stock/refill contract is ready for an explicit future medication-stock decision.",
  "acceptance": [
    "The eventual feature records stock and produces agreed refill reminders without inventing dose consumption.",
    "The current parked state and medication prerequisites remain visible; planning does not activate the feature."
  ],
  "scope": [
    "ERA Notes/10 - Project Management/Healthcare/Healthcare — Master Book.md"
  ],
  "steps": [
    "After medication storage exists, inspect its dose/unit/log model and the existing Inventory counter/history patterns.",
    "Prepare a short decision matrix for stock unit, refill threshold, variable/as-needed use and when a confirmed dose changes stock.",
    "Have the owner choose the intended contract only when resuming work; retain unknown counts instead of estimating medical use.",
    "Then define a separate transactional stock/inverse slice and reuse the accepted reminder materializer after its contract fits the selected policy."
  ],
  "invariants": [
    "No inferred dosage or depletion date from a medication name.",
    "A failed/replayed dose cannot deduct twice; Undo must restore the same accepted stock event.",
    "Stock information never changes prescribed dose behavior."
  ],
  "exclusions": [
    "Adding counters now, automatic refill orders, clinical recommendations or treating Inventory's current implementation as an accepted medication design."
  ],
  "risks": [
    "A naive decrement-per-log fails for differing units, partial doses and variable use."
  ],
  "unknowns": [
    "Owner admission, stock unit/threshold/consumption semantics and medication readiness."
  ],
  "dependencies": [
    "HLTH-8",
    "HLTH-19"
  ],
  "risk": "high",
  "provenance": "2026-09-26 planning from current Healthcare acceptance and accepted source contracts; revalidate API/schema and prior item evidence at dispatch. No live privacy/device certification.",
  "checks": [],
  "ownerReviewed": false
}
```

### HLTH-23

**Accepted specification:** [Catalogue final build plan §10](<../../../docs/Catalogue — ASTRA Deep Dive.md#10-final-build-plan--2026-09-07>), packet C15. Its detailed data/rollout contract applies; earlier Object Memory/Tasks V2 alternatives were withdrawn.

**Outcome:** Select private medical reference records.

- **Acceptance:** Catalogue C15: healthcare reference pickers respect source privacy and lineage; a contact/document link does not become a medication or grant household access.
- **Depends on:** [KIT-20](<../Kitchen/Kitchen — Master Book.md#kit-20>), [HLTH-7](<Healthcare — Master Book.md#hlth-7>).

**Provenance:** [Healthcare — Master Book.md](<../_Archive/2026-09-10 PM Refactor/Before/Healthcare/Healthcare — Master Book.md>). The source is historical; this entry owns the retained outcome.

- **Reading guide:** Depends on KIT-20 and HLTH-7; the accepted specification is the linked Catalogue build plan §10 (packet C15) — read it before the code. The privacy asymmetry is the crux and it already exists in code: `get_health_bundle()` in `src/app/api/healthcare/route.ts` respects `shared_with_household`, while `get_household_allergens()` deliberately does not. A reference picker must not launder the first into the second. Catalogue side: `src/types/catalogue.ts` (the `healthcare` category and its metadata interfaces), `src/features/catalogue/`, and the lineage column `source_catalogue_item_id` used in `src/app/api/items/[id]/promote/route.ts`. "A contact/document link does not become a medication" is a type/lineage invariant, so enforce it in the route and the type, not in the UI.


**Execution plan — 2026-09-26**

**Readiness:** implementation draft after privacy/reference evidence.

**Verify:** Proposed C15 fixtures cover owner/partner/dependent/private/shared scopes, wrong-kind ID, revoked contact, changed phone with unchanged visit history and hidden reverse-use counts. Run healthcare route/type checks; attach fresh HLTH-7 owner privacy evidence separately.

```delivery-plan-v1
{
  "outcome": "Healthcare references select permitted contacts/documents without altering clinical ownership.",
  "acceptance": [
    "Validate the type and access of existing condition/vaccine catalogue_item_id references.",
    "Current contact previews update when permitted while historical provider text, visit/result and private facts stay unchanged."
  ],
  "scope": [
    "src/app/api/healthcare/conditions",
    "src/app/api/healthcare/vaccines",
    "src/app/healthcare/HealthcareClient.tsx",
    "src/features/healthcare",
    "src/components/healthcare"
  ],
  "steps": [
    "Recheck C15, KIT-20 and HLTH-7; verify existing FK columns and legacy linked kinds before changing validation.",
    "Reuse authorized shared Catalogue lookup, including C01/C02/C03/C10 producer contracts, and reject incompatible or unpermitted selections.",
    "Add the proposed shared healthcare reference picker/preview without duplicating clinical data or granting access through a contact.",
    "Test revoked and legacy-mismatched references gracefully; preserve readable history and avoid leaking private reverse-use counts."
  ],
  "invariants": [
    "A contact/document reference is not a medication.",
    "Shared Catalogue access never widens a health profile's sharing.",
    "Subject identity and managing/source owner are distinct."
  ],
  "exclusions": [
    "Medication implementation, clinical search in generic suggestions or rewriting existing foreign keys without evidence."
  ],
  "risks": [
    "A valid UUID alone does not prove a compatible reference kind or authorized source."
  ],
  "unknowns": [
    "Current legacy references and deployed privacy; alter constraints only in a separate evidenced migration if required."
  ],
  "dependencies": [
    "KIT-20",
    "HLTH-7",
    "HUB-69"
  ],
  "risk": "high",
  "provenance": "2026-09-26: Catalogue §10.9 C15 read; schema.sql health_conditions/health_vaccines and Healthcare DTOs already contain catalogue_item_id. This proves repository shape, not deployed permissions.",
  "checks": [],
  "ownerReviewed": false
}
```

## Shipped Log

- ✅ 2026-09-26 — **HLTH-24** Medications: list (dose, full course / as needed, food timing, dose times, course length), day-by-day taken checklist, one urgent recurring Schedule reminder per dose time synced both ways with the checklist (`migrations/2026-09-26_healthcare-medications.sql` — **code-complete, migration not yet run**, HLTH-25; PGlite fixtures 31/31, `medicationSchedule.test.ts` 14/14, typecheck + lint clean)
- ✅ 2026-09-26 — **HLTH-8** Idempotent medication storage and materialization — delivered inside HLTH-24 (same evidence; migration pending HLTH-25)

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
