---
created: 2026-07-18
type: deep-dive
status: living
owner: Elio (authored by Claude Fable 5, handoff session)
generation: 3
trigger: model-generation-handoff
first_generation: 3
tags:
  - pm/fabled3
  - module/healthcare
---

# Healthcare · FABLED 3.1 — Current Implementation

[_index](<_index.md>) · [3.2 Gaps](<2 - FABLED 3 — Gaps & Missing.md>) · [3.3 Optimization](<3 - FABLED 3 — Optimization Plan.md>) · [3.4 Enhancements](<4 - FABLED 3 — Future Enhancements.md>) · [3.5 Successor Briefing](<5 - FABLED 3 — Successor Briefing.md>)

**Verified against the working tree 2026-07-18** (HEAD `f0a8e19`; module shipped `9a037d8` 2026-07-17). First-generation audit — no predecessor to delta against.

## 1. Shape

Standalone module, slug **`healthcare`** (never `health` in routes/paths — the DB tables DO use the `health_` prefix). Total 2,239 LOC:

| Layer | Files | Notes |
|---|---|---|
| Page | `src/app/healthcare/page.tsx` (7) → `HealthcareClient.tsx` (1,013) | single client component, all cards |
| Hooks | `src/features/healthcare/hooks.ts` (444), `types.ts` (121), `queryKeys.ts` (10) | safeFetch + TanStack, invalidates `healthcareKeys.all` **and** `householdAllergenKeys.all` on every mutation (hooks.ts:80–81) |
| API | 10 routes under `src/app/api/healthcare/` | bundle + 4 entity pairs (collection + `[id]`) + `allergens` feed |
| Shared lib | `src/lib/health/allergenMatch.ts` (+ its test) | keyword matching for recipe warnings |

## 2. Data model (`migrations/2026-07-17_healthcare-core.sql`, 276 lines)

Four tables: `health_profiles` (person, `managing_user_id`, `shared_with_household`, `deleted_at` soft delete) → children `health_allergies` / `health_conditions` / `health_vaccines` (each `profile_id` FK + denormalized `managing_user_id`). A `BEFORE INSERT OR UPDATE OF profile_id` trigger (`health_child_sync_managing_user`, line ~140) copies the parent's `managing_user_id` — so RLS stays a **direct column check** (Hard Rule 20 compliant, no EXISTS subqueries).

- **RLS:** owner-only `FOR ALL USING/WITH CHECK (managing_user_id = auth.uid())` on all four tables, generated idempotently in a DO block (lines 150–166).
- **Household visibility is RPC-only:** `get_health_bundle()` (SECURITY DEFINER, line 173) returns own profiles + partner's `shared_with_household = true` profiles, resolving `household_links` internally. `get_household_allergens()` is the always-visible allergy feed for recipes.
- `schema.sql` updated in the same commit (38 `health_` references — pairing rule respected).

## 3. API pattern (exemplary — copy this)

`GET /api/healthcare` = whole page in ONE bundle call (Hard Rule 21). CRUD routes: `supabaseServer` + auth check → Zod (`safeParse` + `flatten()` 400) → insert with `managing_user_id: user.id` (trigger + RLS `WITH CHECK` enforce truth) → `23505 → 409` → `Cache-Control: no-store`. See `allergies/route.ts` as the canonical specimen.

## 4. Cross-module bridges (live)

Recipes: `useHouseholdAllergens.ts` → `RecipeAllergenWarning.tsx` + `RecipeDetailView.tsx` — warns when recipe ingredients match any household member's allergy keywords (defaults derived via `deriveDefaultKeywords`). This is the only live junction; Items/gcal medication bridge is Phase 2 (unbuilt).

## 5. Test reality

`pnpm test` 2026-07-18: `allergenMatch.test.ts` green. **No route tests, no RPC tests, no UI tests.** The module's correctness currently rests on the migration's triggers/RLS and manual verification (HLTH-7, still open).
