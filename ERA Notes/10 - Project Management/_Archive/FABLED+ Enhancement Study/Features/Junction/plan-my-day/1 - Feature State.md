---
created: 2026-07-11
type: fabled-plus-feature-state
status: current
scope: feature
feature: Plan My Day
module_type: Junction
evidence_cutoff: 2026-07-11
baseline: FABLED 2 plus current working-tree delta
---

# Plan My Day · Feature State

> [FABLED+ root](<../../../_index.md>) · **Plan My Day** · [1 · Feature State](<1 - Feature State.md>) · [2 · Vision & Roadmap](<2 - Vision & Roadmap.md>) · [3 · Action Plan](<3 - Action Plan.md>) · [4 · Checklist](<4 - Checklist.md>)

## Current verdict

A promising bridge between recurring, one-time, and flexible schedule work, with day plans and assignment surfaces, but its optimizer semantics are under-protected and cannot yet explain trade-offs, uncertainty, or protected anchors.

## Verified footprint

- `ERA Notes/01 - Architecture/Feature Map/junction/plan-my-day.md`
- `ERA Notes/03 - Junction Modules/Plan My Day/Overview.md`
- `src/features/day-plan/hooks.ts`
- `src/components/planner/WebDayPlanner.tsx`
- `src/components/planner/MobileFlexibleAssignmentPage.tsx`
- `src/app/api/day-plans/route.ts`
- `src/lib/schedule/expandOccurrences.ts`

Checked against the 2026-07-11 working tree; source wins over docs.

## Outcome loop

| Stage | Current state |
|---|---|
| **Observe** | Date, occurrences, flexible candidates, assignments, and actions are captured. |
| **Interpret** | Planner assembles the day. |
| **Propose** | Placement and plan can be proposed. |
| **Commit** | Assignments/day plans are saved. |
| **Verify** | Trade-off explanation and planned-versus-actual fit are weak. |
| **Learn** | Duration, rejection, move, and disruption outcomes do not recalibrate future plans. |

## Existing leverage

- Day plans are separate from canonical item recurrence rather than rewriting the schedule.
- Flexible assignment can combine multiple item classes.
- The feature has a natural proposal boundary before schedule mutation.

## Feedback, friction, and risk

- A placement lacks an explanation of constraints used and compromises made.
- Hard anchors, soft preferences, energy, travel, and uncertainty are not one explicit contract.
- The currently failing flexible-occurrence guard shows planner/view semantics can diverge.

## Study conclusion

**Inference:** Make day planning a transparent constraint negotiation: protect anchors, show assumptions, rehearse disruption, and learn from actual adjustments.

## Re-verify

    git log --oneline --since="2026-07-02" -- "src/features/day-plan/hooks.ts" "src/components/planner/WebDayPlanner.tsx" "src/components/planner/MobileFlexibleAssignmentPage.tsx" "src/app/api/day-plans/route.ts"

Trace every connected standalone before implementation.

