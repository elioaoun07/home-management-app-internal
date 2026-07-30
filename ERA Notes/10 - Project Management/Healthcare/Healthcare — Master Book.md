---
created: 2026-07-17
updated: 2026-07-30
type: master-book
status: active
owner: Elio
consolidates: "_index, 1 - Feature State, 2 - Vision & Roadmap, 3 - Action Plan, FABLED 3 (originals in ../_Archive/Healthcare/)"
tags:
  - pm/master-book
  - scope/module
  - module/healthcare
---

# Healthcare — Master Book

> **Campaign:** Healthcare · prefix `HLTH` · working queue → [4 · Checklist](<4 - Checklist.md>)

## Identity & North Star

Family health module — profiles (household + dependents), allergies (junction → Recipes), medical history, vaccines, medications (junction → Items/Reminders with verified Google Calendar sync), and a catalogue junction for doctors/insurance/hospitals.

The household's health facts live in heads and on paper. ERA's promise — capture once, get foresight back — applies directly: **an allergy captured once warns on every recipe forever; a medication captured once becomes reminders that fire even with the app closed.**

**Slug is `healthcare`, tables are `health_*`.** Never create routes under `/api/health` — that is the connectivity probe the whole app polls every 30 s (Hard Rule 7).

**Source:** `src/features/healthcare/`, `src/app/healthcare/`, `src/app/api/healthcare/` (10 routes), `src/lib/health/`, `src/components/web/RecipeAllergenWarning.tsx`. Migration: `migrations/2026-07-17_healthcare-core.sql`. Origin spec: [Module Map Tier 1 #1](<../../07 - Backlog & Ideas/ERA - Module Map & New Module Ideas.md>).

## Current State (verified)

**Maturity 4.8 / 10 as of 2026-07-18 (FABLED 3, first audit — the module joined the layer at generation 3, one day after Phase 1 shipped). Young, clean, unprotected.**

| Dimension | Score | Evidence |
|---|---|---|
| Data correctness | 7 | trigger-synced `managing_user_id`, soft delete, owner-only RLS + SECURITY DEFINER visibility RPCs — **but the migration is not yet run in prod** |
| Test protection | 3 | only `src/lib/health/allergenMatch.test.ts`; zero route tests |
| Cross-module bridges | 4 | recipe allergen warning is live; the Items/gcal medication junction is unbuilt |
| Code health | 8 | 2,239 LOC total, house-pattern compliant (bundle RPC per Hard Rule 21, Zod, 23505→409, `safeFetch`); the one blob is `HealthcareClient.tsx` at 1,013 lines |
| AI leverage | 2 | no Hub Chat intent, no briefing signal yet |
| Handoff readiness | 5 | any-model for scoped CRUD (the patterns are exemplary); medications Phase 2 is mid-tier+; no domain skill yet |

**Roadmap status:** P1 core + allergies ✅ code-complete 2026-07-17 (migration run pending) · P2 medications + verified gcal sync · P3 catalogue junction · P4 seams + domain skill.

## Pain Inventory

- 🔴 **The core migration has not been run in Supabase.** Until `migrations/2026-07-17_healthcare-core.sql` is executed manually, `/healthcare` and `/api/healthcare/*` 500 on missing tables, and mobile-viewport + both-accounts verification cannot happen. The module is UI over a missing schema.
- 🟠 **Zero route tests across 10 API routes** — and Phase 2 (medications, safety-critical) is about to land on top of them.
- 🟠 **No domain skill yet.** It should be authored *before* medications, not after, so the safety-critical work is skill-guarded from day one.
- 🟡 Recipe *list* cards show no allergen dot — the `RecipeListItem` payload has no ingredients, so this needs a recipes list API change. Deferred; the detail view (the pre-cook surface) is covered.
- 🟡 `HealthcareClient.tsx` is 1,013 lines — extract into `src/components/healthcare/` rather than growing it.
- ⚪ Allergen matching is keyword-based over free-text ingredients — a warn-aid, not a guarantee, by design. Keywords are editable per allergy to correct drift.
- ⚪ The `shared_with_household` privacy boundary is under-documented — ask before assuming.

## Shipped Log

- ✅ 2026-07-17 — **HLTH-1** module scaffold: six index surfaces, slug `healthcare` (`node scripts/check-feature-index.mjs` green)
- ✅ 2026-07-17 — **HLTH-2** core DB: `health_profiles` / `health_allergies` / `health_conditions` / `health_vaccines`, owner-only RLS + `managing_user_id` sync trigger, `get_health_bundle()` + `get_household_allergens()` RPCs (`migrations/2026-07-17_healthcare-core.sql` — **code-complete, migration not yet run**)
- ✅ 2026-07-17 — **HLTH-3** CRUD API routes (profiles, allergies with keyword seeding, conditions, vaccines) + bundle + allergen feed, typecheck clean
- ✅ 2026-07-17 — **HLTH-4** allergen matcher: word-boundary + plurals, Lebanese-staples synonyms, editable per-allergy keywords (`allergenMatch.test.ts` 12/12)
- ✅ 2026-07-17 — **HLTH-5** recipe allergen warnings: detail-view banner + per-ingredient flags, both partners' allergies, offline-persisted feed (`household-allergens` in `STABLE_KEYS`)
- ✅ 2026-07-17 — **HLTH-6** health page UI: profile chips including dependents, allergies with severity/keywords, medical history, vaccines, Undo on every mutation

## Delivery session log

*(Delivery runner appends dated progress bullets here automatically.)*

## Vision & Decisions

### Privacy model (owner-confirmed 2026-07-17)

- Profiles/conditions/vaccines are **private to the managing user**, with a per-profile `shared_with_household` opt-in.
- **Allergies are always household-visible** — whoever cooks must see them — surfaced via `get_household_allergens()` only; the table's RLS stays owner-only.
- **Dependent profiles** (`user_id NULL`) are supported from day 1. *(IMPLEMENTED 2026-07-17)*

### Standing decisions

- **Allergen matching is a warning aid, never a gate** — keyword match over free-text ingredients with an over-warn bias and user-editable keywords; it never blocks cooking. *(IMPLEMENTED 2026-07-17)*
- **Medication reminders ride the existing engines** — reminder-type items at priority `urgent`, one item per dose-time, the existing rrule pipeline and the existing Google Calendar sync promoted to a *verified* state (`gcal_status`). Google native alarms are the offline-reliable channel; the cron/push path is secondary.
- **Warn-but-allow when Google is disconnected** (owner decision 2026-07-17): the save succeeds, with a persistent "not backed up" warning until verified.
- **Schedule edits archive-and-recreate items** — never in-place RRULE mutation (duplicate-occurrence history). Adherence history lives in `health_medication_logs`, not on items.
- **Expiry alerts materialize reminder items** via the existing `source_catalogue_item_id` mechanism — **no new alert engine, ever.**

### Phase 2 shape (medications — safety-critical)

Migration: `health_medications`, `health_medication_logs` (UNIQUE `(medication_id, occurrence_date, dose_time)`), `items.source_medication_id` FK + partial index, `mirror_medication_occurrence_action()` trigger, and the RPCs `create_medication_with_items` / `update_medication_schedule` / `set_medication_status`.

Routes: transactional materialization (one reminder item per dose-time), **awaited** `syncItemToGoogleCalendar` with a `google_event_id` re-read (verified sync), `gcal_status` bookkeeping, warn-but-allow when disconnected. Extend `cron/gcal-reconcile` to take med items first and heal `gcal_status` both ways. Dose logging rides existing occurrence actions (offline via the existing queue), mirrored by the DB trigger.

### The next three moves

1. **Run the core migration** and verify the allergen warning on both accounts — everything else is blocked behind it.
2. **Route tests for the 10 API routes** before Phase 2 lands on top of them.
3. **Author the `healthcare` domain skill early, not late** — before medications, so the safety-critical work is guarded from day one.

## Acceptance Criteria Index

### HLTH-7
- **Acceptance:** with the migration run, creating self + partner profiles and a "peanut" allergy makes a recipe containing "peanut butter" show the banner and the inline ingredient flag from **both** accounts, and a private condition is invisible to the partner. Verified on a mobile viewport.

### HLTH-12
- **Acceptance:** a 2-dose medication produces exactly 2 items and 2 Google events; the native alarm fires with the app closed on a real phone; a schedule edit produces zero duplicate occurrences; an offline dose log replays to exactly one row.

## Successor Briefing

**Who should read this:** you are about to change Healthcare code. If anything here contradicts the code, the code wins — fix this file.

**First 10 minutes:**

```bash
git log --format="%h %ad %s" --date=short --since=2026-07-18 -- src/features/healthcare src/app/api/healthcare src/app/healthcare src/lib/health
npx vitest run src/lib/health/allergenMatch.test.ts
find src/app/api/healthcare -name "route.ts"        # expect 10
```

Then read [4 · Checklist](<4 - Checklist.md>) (the queue) → `src/app/api/healthcare/allergies/route.ts` (the canonical route) → `migrations/2026-07-17_healthcare-core.sql` §4–5 (RLS + RPCs).

**Task-tier map:**

| Task archetype | Tier | Route |
|---|---|---|
| Add/change a field on profiles/allergies/conditions/vaccines | any-model | `add-feature`; copy the `allergies/route.ts` pattern; migration file first (Hard Rule 24) |
| UI changes on the healthcare page | any-model | `ui-guardrails`; extract into `src/components/healthcare/`, don't grow `HealthcareClient.tsx` |
| New CRUD entity following the existing 4-table shape | any-model | mirror the trigger + direct-RLS pattern from the core migration exactly |
| Medications / dose scheduling | mid-tier+ | `recurrence-safety` + `timezone-handling` + `db-migration` open; one materialization choke point, never a second expansion engine |
| Changing RLS policies or RPC visibility logic | human-first | partner-visible medical data; propose SQL, let Elio run and verify with both accounts |
| Anything touching `shared_with_household` semantics | human-first | the privacy boundary is under-documented; ask before assuming |

**Out-of-depth tells — stop if:** you're about to add an `EXISTS`-subquery RLS policy (Hard Rule 20); you can't say which of the two recurrence systems your medication change belongs to; you're writing a second place that decides profile visibility (it lives ONLY in the RPCs).

**Trap registry:**

| Trap | Symptom | Guard |
|---|---|---|
| Migration not yet run in prod | healthcare page 500s / "function does not exist" | run `migrations/2026-07-17_healthcare-core.sql` first; it's idempotent |
| Slug is `healthcare`, tables are `health_*` | grep misses, wrong route paths | never create routes under `/api/health` — that's the connectivity probe |
| `managing_user_id` is trigger-set | manual setting seems to work, then diverges on profile move | let the trigger own it; never bypass with service role |
| Bundle cache invalidation is dual | stale allergen warnings in recipes after a mutation | every healthcare mutation must invalidate BOTH `healthcareKeys.all` and `householdAllergenKeys.all` |
| `/api/health` vs `/api/healthcare` | the connectivity manager probes `/api/health` every 30 s | breaking that route makes the whole app think it's offline |

**Verification manifest:**

| Claim | Command | Expected |
|---|---|---|
| 10 API routes | `find src/app/api/healthcare -name route.ts \| wc -l` | 10 |
| RLS is direct-column, no EXISTS | `grep -n "EXISTS" migrations/2026-07-17_healthcare-core.sql` | no policy hits |
| `schema.sql` paired | `grep -c "health_" migrations/schema.sql` | ≥ 38 |
| Allergen matcher tested | `npx vitest run src/lib/health/allergenMatch.test.ts` | green |
| Dual invalidation intact | `grep -n "householdAllergenKeys" src/features/healthcare/hooks.ts` | hit in mutation `onSuccess` |

**Note:** Healthcare post-dates FABLED 2 and had never been audited before 2026-07-18. Distrust any older doc claiming a "Health" module under a different slug.

## Pointers

- Working queue: [4 · Checklist](<4 - Checklist.md>) · conventions: [_Conventions](<../_Conventions.md>)
- Vault: [Healthcare](<../../02 - Standalone Modules/Healthcare/>)
- Pre-consolidation originals: `../_Archive/Healthcare/`
