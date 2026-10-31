# Meal Planning

**Type:** Standalone (filed under Junction in CLAUDE.md but lives in `src/features/meal-planning/`)
**Route:** `/meal-plan`
**Vault doc:** `ERA Notes/03 - Junction Modules/Meal Planning/`

## What it does

Weekly meal planner. Drag recipes onto days, see what's coming up, optionally roll the recipe's ingredients onto the shopping list.

## Files at a glance

- **Page entry**: `src/app/meal-plan/page.tsx`, `src/app/meal-plan/layout.tsx`
- **Components**:
  - `src/components/web/WebMealPlanCalendar.tsx`
  - `src/components/web/WebMealPlanner.tsx`
  - `src/components/web/MealPlanDropSheet.tsx`
- **Hooks**:
  - `src/features/meal-planning/hooks.ts`
  - `src/features/meal-planning/queryKeys.ts`
- **API routes**: `src/app/api/meal-plans/`
- **Coverage contract**: `src/lib/mealPlanCoverage.ts`. `getMealActiveDates` gives calendar days; `mealCoversDate` says who is fed. Shared by the calendar and ERA Chef (`src/features/era/intents/resolvers/chef.ts`).
- **DB tables**: `meal_plans` (confirm in `schema.sql`)

## Common edit scenarios

- **"Change the calendar grid"** → `src/components/web/WebMealPlanCalendar.tsx`.
- **"Edit drag-drop behavior"** → `MealPlanDropSheet.tsx`. Watch Hard Rule from `COMMON_PATTERNS.md`: **never mix `<motion.div draggable>` with HTML5 drag**.

## Gotchas

- Framer Motion + HTML5 drag must not be combined on the same element.
- `GET /api/meal-plans?date=` / `?start=&end=` return every meal whose planned → `eats_through_date` interval **overlaps**, not only meals planned in the range. Never re-add a lookback window client-side.
- Display ≠ coverage: a skipped meal still shows on the calendar but feeds nobody; a `for_user_id` meal covers only that person. Use `mealCoversDate`, never `planned_date` sets.
- Dates are local `YYYY-MM-DD`. Never `toISOString().split("T")[0]` — it shifts local midnight to the previous UTC day.
- Recipe → shopping list flow goes through `src/components/web/AddToShoppingDialog.tsx`.

## Connected modules

- **Recipes** ([./recipes.md](./recipes.md)) — source of meals.
- **Shopping List** ([../junction/shopping-list.md](../junction/shopping-list.md)) — destination for ingredients.
- **Items & Reminders** ([./items-and-reminders.md](./items-and-reminders.md)) — meal entries can become items on the schedule.
