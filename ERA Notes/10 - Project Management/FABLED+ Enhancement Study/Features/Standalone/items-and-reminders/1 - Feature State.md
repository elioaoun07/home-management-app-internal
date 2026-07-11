---
created: 2026-07-11
type: fabled-plus-feature-state
status: current
scope: feature
feature: Items & Reminders
module_type: Standalone
evidence_cutoff: 2026-07-11
baseline: FABLED 2 plus current working-tree delta
---

# Items & Reminders · Feature State

> [FABLED+ root](<../../../_index.md>) · **Items & Reminders** · [1 · Feature State](<1 - Feature State.md>) · [2 · Vision & Roadmap](<2 - Vision & Roadmap.md>) · [3 · Action Plan](<3 - Action Plan.md>) · [4 · Checklist](<4 - Checklist.md>)

## Current verdict

The richest operational module—items, occurrences, recurrence, alerts, flexible placement, actions, and Google Calendar sync—but its semantic load exceeds the simple priority/status vocabulary used to guide a real day.

## Verified footprint

- `ERA Notes/01 - Architecture/Feature Map/standalone/items-and-reminders.md`
- `ERA Notes/02 - Standalone Modules/Items & Reminders/Overview.md`
- `src/features/items/useItems.ts`
- `src/features/items/useItemActions.ts`
- `src/lib/utils/dayOccurrences.ts`
- `src/lib/schedule/expandOccurrences.ts`
- `src/features/items/gcalSync.ts`
- `src/app/api/items/route.ts`

Checked against the 2026-07-11 working tree; source wins over docs.

## Outcome loop

| Stage | Current state |
|---|---|
| **Observe** | Items, recurrence, alerts, actions, flexible placement, and calendar sync state are captured. |
| **Interpret** | Expansion and action utilities materialize daily occurrences. |
| **Propose** | Plan My Day and flexible placement can suggest timing. |
| **Commit** | Create/edit/complete/skip/postpone flows are extensive. |
| **Verify** | Completion is recorded, but intended outcome and duration accuracy are rarely checked. |
| **Learn** | Actual duration, repeated postponement, and completion context do not systematically recalibrate plans. |

## Existing leverage

- A single item model supports tasks, reminders, events, recurrence, alerts, subtasks, flexible schedules, and household ownership.
- Schedule bundle and occurrence-action patterns preserve exactly-once semantics better than ad hoc date rows.
- The recent Google Calendar bridge adds external visibility while keeping the app's item state authoritative.

## Feedback, friction, and risk

- Priority does not express commitment type: immovable promise, flexible intention, optional opportunity, or externally owned event.
- Duration and energy assumptions stay static, so repeated overruns create pressure without teaching the planner.
- The current test run still fails the flexible-occurrence view guard, proving semantic rules can drift between surfaces while TypeScript remains green.

## Study conclusion

**Inference:** Make schedule truth semantic, not merely temporal: what is protected, what can move, why it matters, and what the system learned from the outcome.

## Re-verify

    git log --oneline --since="2026-07-02" -- "src/features/items/useItems.ts" "src/features/items/useItemActions.ts" "src/lib/utils/dayOccurrences.ts" "src/lib/schedule/expandOccurrences.ts"

Run focused tests and read every mutating route before implementation.

