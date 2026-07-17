---
created: 2026-07-17
type: feature-doc
module: Healthcare
module-type: standalone
status: active
tags:
  - type/feature-doc
  - module/healthcare
related:
  - "[[Common Patterns]]"
---

# Healthcare

> **Module:** `src/features/healthcare/` | **API:** `src/app/api/healthcare/` | **Page:** `src/app/healthcare/`
> **DB Tables:** `health_profiles`, `health_allergies`, `health_conditions`, `health_vaccines` (Phase 2 adds `health_medications`, `health_medication_logs`)
> **Type:** Standalone
> **Status:** Active — Phase 1 shipped 2026-07-17 (of 4; plan of record in [[../../10 - Project Management/Healthcare/2 - Vision & Roadmap|PM · Vision & Roadmap]])

## Overview

Family health profiles: allergies (junction → Recipes warnings), medical history (conditions/surgeries/visits), vaccines, and — in Phase 2 — medications materialized as high-criticality reminder items with verified Google Calendar sync.

## Architecture

- **One bundle read** (Hard Rule 21): `GET /api/healthcare` → `get_health_bundle()` SECURITY DEFINER RPC returns profiles + allergies + conditions + vaccines in one call. Own profiles always; partner profiles only when `shared_with_household = true`.
- **Allergen feed** (separate, always household-wide): `GET /api/healthcare/allergens` → `get_household_allergens()` returns minimal `{allergen, severity, keywords, profile_name}` rows for EVERY profile in the household, regardless of sharing — whoever cooks must see them. Consumed by `useHouseholdAllergens()` (`src/hooks/useHouseholdAllergens.ts`, shared layer so Recipes never imports the healthcare feature dir), persisted via the `household-allergens` STABLE_KEYS entry in `src/app/providers.tsx` so recipe warnings work offline.
- **Matching**: `src/lib/health/allergenMatch.ts` — pure keyword matcher (word-boundary + simple plurals) over free-text `recipes.ingredients[].name`, seeded from `ALLERGEN_SYNONYMS` (Lebanese staples included) at allergy creation; **stored per-allergy `keywords[]` always win** so user edits fix false matches. Warning aid, never a guarantee or a gate.
- **Recipe surfaces**: `RecipeAllergenBanner` + `IngredientAllergenFlag` (`src/components/web/RecipeAllergenWarning.tsx`) rendered in `RecipeDetailView`.
- Mutations: standard CRUD routes (auth → Zod → insert with `managing_user_id` from session → 23505→409), hooks with safeFetch + real inverse-action Undo toasts (`src/features/healthcare/hooks.ts`).

## Database

- All four tables carry **`managing_user_id`** (denormalized on children by the `health_child_sync_managing_user()` BEFORE-trigger from the parent profile) with **owner-only RLS** (`managing_user_id = auth.uid()` FOR ALL). Household visibility happens ONLY inside the two SECURITY DEFINER RPCs — Hard Rule 20 compliant, no EXISTS-subquery policies.
- `health_profiles.user_id` **nullable** — `NULL` = dependent without an account (child/parent). `is_self` on create maps to the session user id; a profile can never claim another account.
- Profile delete is **soft** (`deleted_at`) so Undo restores children intact; child records hard-delete with re-create Undo.
- Severity/kind/status are text + CHECK constraints (not enums): `mild|moderate|severe|anaphylaxis`, `condition|surgery|doctor_visit`, `active|resolved`.
- Migration: `migrations/2026-07-17_healthcare-core.sql` (idempotent, must be run manually in Supabase SQL Editor).

## Key Files

- `src/features/healthcare/{types,queryKeys,hooks}.ts` — domain types, `healthcareKeys`, bundle query + CRUD mutations
- `src/hooks/useHouseholdAllergens.ts` — shared allergen feed hook + key (persisted)
- `src/lib/health/allergenMatch.ts` (+ `.test.ts`) — matcher, synonym seed, `deriveDefaultKeywords`
- `src/components/web/RecipeAllergenWarning.tsx` — banner / inline flag / list-dot components
- `src/app/api/healthcare/` — `route.ts` (bundle), `allergens/`, `profiles/`, `allergies/`, `conditions/`, `vaccines/` (+ `[id]/` each)
- `src/app/healthcare/HealthcareClient.tsx` — page UI

## Gotchas

- **The module slug is `healthcare`, not `health`** — `/api/health` is the connectivity probe endpoint (`isReallyOnline()`, Hard Rule 7). Never reuse the `health` route namespace.
- **Allergies are intentionally NOT private** even when the profile isn't shared — this asymmetry is a product decision (recipe safety > privacy for this one record type). Don't "fix" it.
- The allergies POST relies on the DB trigger to stamp `managing_user_id` from the parent profile; RLS `WITH CHECK` then rejects writes against profiles you don't manage (surfaces as a 500 today — acceptable, unreachable via UI).
- Keyword matching runs on the **stored** keywords, never live from `ALLERGEN_SYNONYMS` — editing the synonym map does not change existing allergies.
- Recipe **list** cards have no allergen dot: `RecipeListItem` has no ingredients (lean payload). Deferred to HLTH-18.

## See Also

- [[Common Patterns]] · [[Sync and Offline]]
- PM campaign: `ERA Notes/10 - Project Management/Healthcare/`
- Origin spec: Module Map Tier 1 #1 (`07 - Backlog & Ideas/ERA - Module Map & New Module Ideas.md`)
