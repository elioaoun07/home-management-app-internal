---
created: 2026-03-23
updated: 2026-05-17
type: overview
module: meal-planning
module-type: standalone
tags:
  - type/overview
  - module/meal-planning
---

# Meal Planning

> **Source:** `src/features/meal-planning/`, `src/app/api/meal-plans/`, `src/components/web/WebMealPlanCalendar.tsx`
> **Type:** Standalone with junction-like dependencies on Recipes and Shopping List
> **Sub-PWA:** `/meal-plan` — installable separately via `public/manifests/meal-plan.webmanifest`

## Architecture

- **DB table:** `meal_plans` — scoped by `household_id` (required). Columns: `recipe_id`, `planned_date` (date cooked), `meal_type` (breakfast/lunch/dinner/snack), `status` (planned/cooked/skipped), `for_user_id` (NULL = both partners, set = one partner only), `eats_through_date` (last leftover day), `servings_planned`.
- **API routes:** `src/app/api/meal-plans/route.ts` (GET/POST), `[id]/route.ts` (GET/PATCH/DELETE), `add-to-shopping/route.ts`.
- **Hooks:** `src/features/meal-planning/hooks.ts` — `useMealPlansForWeek`, `useMealPlansForDate`, `useCreateMealPlan`, `useUpdateMealPlan`, `useDeleteMealPlan`, `useHousehold`.
- **Web UI:** `src/components/web/WebMealPlanCalendar.tsx` (7-day grid, drag-drop from RecipeSidePanel), `RecipeSidePanel.tsx`, `MealPlanDropSheet.tsx`.
- **Entry point:** 5th tab in `WebViewContainer.tsx` ("Meals"), also `/meal-plan` standalone route.

## Household Assignment (`for_user_id`)

- `NULL` → shared meal, both partners see and eat it.
- Set to a user UUID → shown only to that partner (UX filter, not RLS boundary — both are in the same household).
- `MealPlanDropSheet` shows "Both / Me / Partner" segmented control when a household partner exists.
- Color identity follows Hard Rule 14: blue-theme user = blue dot, partner = pink dot (inverse for pink-theme).

## Leftover Spread (`eats_through_date`)

- When creating a meal plan, default spread = `Math.floor(recipe.servings / householdSize)` days.
- The calendar renders the original entry on `planned_date` and faded "Leftover" cards on each subsequent day through `eats_through_date`.
- `useMealPlansForWeek` extends the API query start by 14 days to capture meals cooked before the current week with leftover dates overlapping into it.

## Hard Rules

- **Requires household:** `meal_plans.household_id` is NOT NULL. Creating a meal plan without a household returns 400. The UI should surface a prompt to set up household sharing if household is missing.
- **Toast Undo:** `MealPlanDropSheet` calls `useCreateMealPlan().mutateAsync()` and shows a toast with Undo (deletes the created plan). `MealPlanDetailSheet` status changes and deletes also toast with Undo.
- **No `fetch()` direct calls** — all mutations use `safeFetch()`.
- **Query keys** from `src/features/meal-planning/queryKeys.ts` (`mealPlanKeys.*`). Invalidate `mealPlanKeys.all` on any meal plan mutation.

## Gotchas

- `mealPlanKeys` is duplicated in `src/features/recipes/hooks.ts` (backwards compat for `WebMealPlanner.tsx`). Both use the same `["meal-plans"]` root key, so React Query deduplicates correctly.
- The old `WebMealPlanner.tsx` still exists as the Recipes tab > "Meal Planner" sub-tab. It will be removed in a follow-up cleanup PR once the new top-level tab is validated.
- The `eats_through_date` leftover logic uses `date + "T12:00:00"` to avoid UTC timezone midnight drift (hard rule equivalent: always anchor dates at noon).

## Future Requirements

- Calorie tracking (`calories_per_serving` on recipes)
- Macros (protein/carbs/fat) per recipe
- Diet preferences / allergen filtering in `RecipeSidePanel`
- Nutrition AI briefings ("30% over carbs this week")
- Meal AI assistant ("What should I cook tonight?")
- Snack & dessert slots (schema already supports: `meal_type` has 'snack')
- Shopping list auto-build from full week's meal plan
- Watch UI — today's next meal on the watch face
- Mobile calendar parity

## See Also

- [[Recipes Overview|Recipes]]
- [[Shopping List Overview|Shopping List]]
- [[Items & Reminders Overview|Items & Reminders]]
