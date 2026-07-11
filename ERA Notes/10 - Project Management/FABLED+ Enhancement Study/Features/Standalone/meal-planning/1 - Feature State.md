---
created: 2026-07-11
type: fabled-plus-feature-state
status: current
scope: feature
feature: Meal Planning
module_type: Standalone
evidence_cutoff: 2026-07-11
baseline: FABLED 2 plus current working-tree delta
---

# Meal Planning · Feature State

> [FABLED+ root](<../../../_index.md>) · **Meal Planning** · [1 · Feature State](<1 - Feature State.md>) · [2 · Vision & Roadmap](<2 - Vision & Roadmap.md>) · [3 · Action Plan](<3 - Action Plan.md>) · [4 · Checklist](<4 - Checklist.md>)

## Current verdict

A working weekly recipe-to-day planner with shopping integration, but it plans ideal meals more readily than real household preference, energy, disruption, and outcome.

## Verified footprint

- `ERA Notes/01 - Architecture/Feature Map/standalone/meal-planning.md`
- `ERA Notes/03 - Junction Modules/Meal Planning/Overview.md`
- `src/features/meal-planning/hooks.ts`
- `src/components/web/WebMealPlanner.tsx`
- `src/components/web/WebMealPlanCalendar.tsx`
- `src/app/api/meal-plans/route.ts`
- `src/app/api/meal-plans/add-to-shopping/route.ts`

Checked against the 2026-07-11 working tree; source wins over docs.

## Outcome loop

| Stage | Current state |
|---|---|
| **Observe** | Planned recipe, day, meal slot, and household context are captured. |
| **Interpret** | Calendar grouping turns recipes into a week. |
| **Propose** | Little assistance around compromise or disruption. |
| **Commit** | Plans are saved and ingredients can move to shopping. |
| **Verify** | Cooked/skipped/substituted outcomes are weakly connected. |
| **Learn** | Actual effort, preference, and disruption do not calibrate future weeks. |

## Existing leverage

- Weekly placement and drag/drop create a tangible plan.
- Recipe and shopping bridges reduce duplicate entry.
- The module remains small in feature code and can evolve through focused seams.

## Feedback, friction, and risk

- A plan has no resilience semantics: backup meal, time threshold, or disruption trigger.
- Two people's preferences and fairness are not negotiated; one editor can create a technically shared plan.
- Planned cooking time and actual household energy are disconnected.

## Study conclusion

**Inference:** Make the meal plan a resilient household agreement, not a perfect calendar: mutually acceptable, energy-aware, and easy to recover when life changes.

## Re-verify

    git log --oneline --since="2026-07-02" -- "src/features/meal-planning/hooks.ts" "src/components/web/WebMealPlanner.tsx" "src/components/web/WebMealPlanCalendar.tsx" "src/app/api/meal-plans/route.ts"

Run focused tests and read every mutating route before implementation.

