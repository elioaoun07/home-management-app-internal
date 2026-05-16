---
slug: meal-plan
title: Meal Planning
category: standalone-page
route: /meal-plan
type: page
parent: null
children: []
status: active
tags: [food, household, week-view]
---

# Meal Planning

> Weekly drag-and-drop meal planner. Assign recipes to Breakfast/Lunch/Dinner slots for each day, with household-aware partner assignment and automatic leftover spreading.

## Files

- **Page**: `src/app/meal-plan/page.tsx`
- **Layout**: `src/app/meal-plan/layout.tsx`
- **PWA manifest**: `public/manifests/meal-plan.webmanifest`
- **Main component**: `src/components/web/WebMealPlanCalendar.tsx`
- **Sub-components**:
  - `src/components/web/RecipeSidePanel.tsx` — draggable recipe list with search/filter
  - `src/components/web/MealPlanDropSheet.tsx` — assignment + leftover spread sheet (opens after drag-drop)

## Hooks

- `src/features/meal-planning/hooks.ts` — `useMealPlansForWeek`, `useMealPlansForDate`, `useCreateMealPlan`, `useUpdateMealPlan`, `useDeleteMealPlan`, `useHousehold`
- `src/features/meal-planning/queryKeys.ts` — `mealPlanKeys`

## API routes

- `GET /api/meal-plans?start=&end=` → `src/app/api/meal-plans/route.ts`
- `POST /api/meal-plans` → `src/app/api/meal-plans/route.ts`
- `GET|PATCH|DELETE /api/meal-plans/[id]` → `src/app/api/meal-plans/[id]/route.ts`
- `GET /api/household` → `src/app/api/household/route.ts` (partner ID lookup)

## DB tables

- `meal_plans` (see `migrations/schema.sql` and `migrations/2026-05-17_meal_plan_household_and_leftovers.sql`)

## How to get here

- Click **Meals** tab in the `WebViewContainer` top nav (web desktop)
- Direct URL: `/meal-plan` (installs as standalone PWA)
- From `/dashboard` (future: "Today's Meals" widget click)

## What it links to

- **Recipes** — `RecipeSidePanel` lists `useRecipes()` data; drag to assign
- **Shopping List** — `add-to-shopping` API route adds ingredients to Hub chat thread

## Related vault doc

- `ERA Notes/03 - Junction Modules/Meal Planning/Overview.md`

## Notes

- Warm amber radial ambient blobs rendered inside `WebMealPlanCalendar` (crossfades in on mount, replacing the blue Schedule blobs)
- Meal slots: Breakfast 🌅 / Lunch ☀️ / Dinner 🌙 (snack deferred to v2)
- Leftover cards render with `opacity-50` + "Leftover" badge on days after `planned_date` through `eats_through_date`
- `for_user_id` color dots follow Hard Rule 14 (blue-theme user = blue, partner = pink; inverted for pink-theme)
- The old `WebMealPlanner.tsx` (Recipes tab sub-tab) is kept for backwards compat; target cleanup in next PR
