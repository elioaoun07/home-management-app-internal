---
created: 2026-07-11
type: fabled-plus-index
status: current
scope: feature
feature: Items & Reminders
module_type: Standalone
evidence_cutoff: 2026-07-11
baseline: FABLED 2 plus current working-tree delta
---

# Items & Reminders · FABLED+ Index

> [FABLED+ root](<../../../_index.md>) · **Items & Reminders** · [1 · Feature State](<1 - Feature State.md>) · [2 · Vision & Roadmap](<2 - Vision & Roadmap.md>) · [3 · Action Plan](<3 - Action Plan.md>) · [4 · Checklist](<4 - Checklist.md>)

> **Verdict:** The richest operational module—items, occurrences, recurrence, alerts, flexible placement, actions, and Google Calendar sync—but its semantic load exceeds the simple priority/status vocabulary used to guide a real day.

## Loop-readiness score

| Dimension | Score |
|---|---:|
| **Truth** | 4/5 |
| **Capture** | 4/5 |
| **Decision** | 3/5 |
| **Action safety** | 4/5 |
| **Learning** | 2/5 |
| **Partnership** | 3/5 |
| **Total** | **20/30** |

Loop readiness measures closed-loop value, not FABLED maturity.

## Pack

1. [Feature State](<1 - Feature State.md>)
2. [Vision & Roadmap](<2 - Vision & Roadmap.md>)
3. [Action Plan](<3 - Action Plan.md>)
4. [Checklist](<4 - Checklist.md>)

## Evidence anchors

- `ERA Notes/01 - Architecture/Feature Map/standalone/items-and-reminders.md`
- `ERA Notes/02 - Standalone Modules/Items & Reminders/Overview.md`
- `src/features/items/useItems.ts`
- `src/features/items/useItemActions.ts`
- `src/lib/utils/dayOccurrences.ts`
- `src/lib/schedule/expandOccurrences.ts`
- `src/features/items/gcalSync.ts`
- `src/app/api/items/route.ts`

## Non-duplication boundary

Week-shape, overdue roll-forward, recurrence edit scopes, bulk occurrence actions, pressure index, and generic intent-aware planning already exist in prior roadmaps.

