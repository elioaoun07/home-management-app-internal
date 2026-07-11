---
created: 2026-07-11
type: fabled-plus-index
status: current
scope: feature
feature: Plan My Day
module_type: Junction
evidence_cutoff: 2026-07-11
baseline: FABLED 2 plus current working-tree delta
---

# Plan My Day · FABLED+ Index

> [FABLED+ root](<../../../_index.md>) · **Plan My Day** · [1 · Feature State](<1 - Feature State.md>) · [2 · Vision & Roadmap](<2 - Vision & Roadmap.md>) · [3 · Action Plan](<3 - Action Plan.md>) · [4 · Checklist](<4 - Checklist.md>)

> **Verdict:** A promising bridge between recurring, one-time, and flexible schedule work, with day plans and assignment surfaces, but its optimizer semantics are under-protected and cannot yet explain trade-offs, uncertainty, or protected anchors.

## Loop-readiness score

| Dimension | Score |
|---|---:|
| **Truth** | 3/5 |
| **Capture** | 3/5 |
| **Decision** | 3/5 |
| **Action safety** | 3/5 |
| **Learning** | 1/5 |
| **Partnership** | 1/5 |
| **Total** | **14/30** |

Loop readiness measures closed-loop value, not FABLED maturity.

## Pack

1. [Feature State](<1 - Feature State.md>)
2. [Vision & Roadmap](<2 - Vision & Roadmap.md>)
3. [Action Plan](<3 - Action Plan.md>)
4. [Checklist](<4 - Checklist.md>)

## Evidence anchors

- `ERA Notes/01 - Architecture/Feature Map/junction/plan-my-day.md`
- `ERA Notes/03 - Junction Modules/Plan My Day/Overview.md`
- `src/features/day-plan/hooks.ts`
- `src/components/planner/WebDayPlanner.tsx`
- `src/components/planner/MobileFlexibleAssignmentPage.tsx`
- `src/app/api/day-plans/route.ts`
- `src/lib/schedule/expandOccurrences.ts`

## Non-duplication boundary

Intent-aware planning, week-shape, schedule pressure index, and overdue roll-forward are prior ideas; this pack adds explainability and disruption rehearsal.

