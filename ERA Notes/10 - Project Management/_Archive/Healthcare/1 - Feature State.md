---
created: 2026-07-17
updated: 2026-07-17
type: feature-state
status: active
owner: Elio
tags:
  - pm/feature-state
  - module/healthcare
---

# Healthcare · 1 — Feature State

> **Command Center:** [_index](<_index.md>) · [1 · Feature State](<1 - Feature State.md>) · [2 · Vision & Roadmap](<2 - Vision & Roadmap.md>) · [3 · Action Plan](<3 - Action Plan.md>) · [4 · Checklist](<4 - Checklist.md>)

## Shipped

| ID | What | Status | Evidence |
|---|---|---|---|
| HLTH-1 | Module scaffold (six index surfaces, slug `healthcare` — `health` is the connectivity probe route) | ✅ 2026-07-17 | `node scripts/check-feature-index.mjs` green |
| HLTH-2 | Core DB: `health_profiles` / `health_allergies` / `health_conditions` / `health_vaccines`, owner-only RLS + `managing_user_id` sync trigger, `get_health_bundle()` + `get_household_allergens()` RPCs | ✅ 2026-07-17 (code) — **migration NOT yet run in Supabase** | `migrations/2026-07-17_healthcare-core.sql` |
| HLTH-3 | CRUD API routes (profiles, allergies w/ keyword seeding, conditions, vaccines) + bundle + allergen feed | ✅ 2026-07-17 | `src/app/api/healthcare/` — typecheck clean |
| HLTH-4 | Allergen matcher (word-boundary + plurals, Lebanese-staples synonyms, editable per-allergy keywords) | ✅ 2026-07-17 | `pnpm vitest run src/lib/health/allergenMatch.test.ts` — 12/12 |
| HLTH-5 | Recipe allergen warnings (detail-view banner + per-ingredient flags, both partners' allergies, offline-persisted feed) | ✅ 2026-07-17 | `src/components/web/RecipeAllergenWarning.tsx`; `household-allergens` in STABLE_KEYS |
| HLTH-6 | Health page UI (profile chips incl. dependents, allergies severity/keywords, medical history, vaccines; Undo on every mutation) | ✅ 2026-07-17 | `src/app/healthcare/HealthcareClient.tsx` |

## Privacy model (decided 2026-07-17, owner-confirmed)

- Profiles/conditions/vaccines **private to the managing user**; per-profile `shared_with_household` opt-in.
- **Allergies always household-visible** (whoever cooks must see them) — via `get_household_allergens()` only, table RLS stays owner-only.
- Dependent profiles (`user_id NULL`) supported from day 1.

## Known gaps / pain clusters

- **HLTH-GAP-1 (blocker until done):** `2026-07-17_healthcare-core.sql` must be run manually in the Supabase SQL Editor — until then `/healthcare` and `/api/healthcare/*` 500 on missing tables. Mobile-viewport + both-accounts verification pending that run (HLTH-7).
- **HLTH-GAP-2 (annoyance):** recipe *list* cards show no allergen dot — `RecipeListItem` payload has no ingredients; adding it means a recipes list API change. Deferred; detail view (the pre-cook surface) is covered.
- **HLTH-GAP-3 (by design):** allergen matching is keyword-based over free-text ingredients — warn-aid, not a guarantee. Keywords editable per allergy to correct drift.

## Next

Phase 2 — medications + Items junction + verified Google sync (warn-but-allow, owner-decided). See [3 · Action Plan](<3 - Action Plan.md>).
