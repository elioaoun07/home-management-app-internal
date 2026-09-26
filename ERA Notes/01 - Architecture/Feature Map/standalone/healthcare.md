# Healthcare

**Type:** Standalone
**Route:** `/healthcare`

## What it does

Family health profiles: medications (dose checklist + Schedule reminders), allergies, conditions, vaccines

## Files at a glance

- **Page entry**: `src/app/healthcare/page.tsx`
- **Main component**: `src/app/healthcare/HealthcareClient.tsx` · medications UI `src/app/healthcare/MedicationsSection.tsx` · shared modal `src/app/healthcare/healthUi.tsx`
- **Hooks**: `src/features/healthcare/hooks.ts`
- **Query keys**: `src/features/healthcare/queryKeys.ts`
- **Types**: `src/features/healthcare/types.ts`
- **API routes**: `src/app/api/healthcare/route.ts` (GET bundle) + `allergens/`, `profiles/`, `allergies/`, `conditions/`, `vaccines/` (each with `[id]/`) + `medications/` (`[id]/`, `[id]/doses/`)
- **Medication helpers**: `src/lib/health/medicationSchedule.ts` (dose-slot math, tested) · `src/lib/health/medicationServer.ts` (server-only Zod, RPC errors, Google sync)
- **Allergen matcher**: `src/lib/health/allergenMatch.ts` · shared feed hook `src/hooks/useHouseholdAllergens.ts`
- **Recipe warning components**: `src/components/web/RecipeAllergenWarning.tsx`
- **DB tables**: `health_profiles`, `health_allergies`, `health_conditions`, `health_vaccines`, `health_medications`, `health_medication_logs` (+ `items.source_medication_id`)

## Common edit scenarios

- **"Change the health page UI"** -> `src/app/healthcare/HealthcareClient.tsx`.
- **"Recipe allergen warning wrong / missing"** -> matcher logic `src/lib/health/allergenMatch.ts`; surfaces `src/components/web/RecipeAllergenWarning.tsx` + `RecipeDetailView.tsx`; the allergy's editable `keywords[]` (health page) usually fixes false matches without code.
- **"Add a field to a health record"** -> `migrations/` (new file + schema.sql) + `src/features/healthcare/types.ts` + the route's Zod schema + `HealthcareClient.tsx` form + `get_health_bundle()` RPC if selected.
- **"Medication reminder / dose checklist wrong"** -> SQL rules in `migrations/2026-09-26_healthcare-medications.sql` (`health_rebuild_medication_reminders`, `health_set_dose`, mirror trigger); client slot math `src/lib/health/medicationSchedule.ts` must stay in step with it.
- **"Change fetch / cache behavior"** -> `src/features/healthcare/hooks.ts` (bundle) or `src/hooks/useHouseholdAllergens.ts` (allergen feed, persisted via STABLE_KEYS).

## Connected modules

- **Recipes** — allergen warnings on recipe detail (via shared lib/hook, no feature-dir import).
- **Household Sharing** — asymmetric: profiles private by default (`shared_with_household` opt-in), allergies always household-visible via `get_household_allergens()`.
- **Sync & Offline** — allergen feed persisted (`household-allergens` STABLE_KEYS entry in `src/app/providers.tsx`).
- **Items/Reminders** — each course dose time is an urgent recurring reminder item (`items.source_medication_id`); completing it in Schedule ticks the dose (DB trigger). Google Calendar sync best-effort (verified status = HLTH-9).
- **Planned:** Catalogue (Phase 3 doctors/insurance), Hub Chat + AI briefing (Phase 4).
