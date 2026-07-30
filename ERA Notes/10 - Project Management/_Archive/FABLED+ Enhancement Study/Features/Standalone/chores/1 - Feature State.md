---
created: 2026-07-11
type: fabled-plus-feature-state
status: current
scope: feature
feature: Chores
module_type: Standalone
evidence_cutoff: 2026-07-11
baseline: FABLED 2 plus current working-tree delta
---

# Chores · Feature State

> [FABLED+ root](<../../../_index.md>) · **Chores** · [1 · Feature State](<1 - Feature State.md>) · [2 · Vision & Roadmap](<2 - Vision & Roadmap.md>) · [3 · Action Plan](<3 - Action Plan.md>) · [4 · Checklist](<4 - Checklist.md>)

## Current verdict

A useful household task surface with grouping, postponement, check-in, and an Up Next hero, but it still counts completion more readily than effort, fairness, handoff quality, or household capacity.

## Verified footprint

- `ERA Notes/01 - Architecture/Feature Map/standalone/chores.md`
- `ERA Notes/02 - Standalone Modules/Chores/Overview.md`
- `src/features/chores/useChores.ts`
- `src/features/chores/useChoreActions.ts`
- `src/components/chores/ChoresTabContent.tsx`
- `src/components/chores/ChoreCheckInPanel.tsx`
- `src/app/chores/page.tsx`

Checked against the 2026-07-11 working tree; source wins over docs.

## Outcome loop

| Stage | Current state |
|---|---|
| **Observe** | Assignments, groups, dates, completion, postpone, and check-ins are captured. |
| **Interpret** | The surface chooses an Up Next chore and groups work. |
| **Propose** | Limited prioritization exists. |
| **Commit** | Complete and postpone actions are established. |
| **Verify** | Completion is acknowledged, but effort and quality are not explicit. |
| **Learn** | The system does not learn true workload, disliked tasks, or handoff patterns. |

## Existing leverage

- Chores reuse the item model rather than creating another scheduling engine.
- Up Next, groups, actions, postpone, and check-in reduce list-scanning friction.
- Household ownership makes the feature naturally collaborative.

## Feedback, friction, and risk

- Counting chores creates false fairness when effort, frequency, unpleasantness, and invisible coordination differ.
- A postpone may mean overload, dependency, absence, or avoidance; those causes are collapsed.
- Assignment is not a negotiation protocol: claim, handoff, decline, and acknowledgement need distinct semantics.

## Study conclusion

**Inference:** Evolve chores into a fair, low-friction household workload system that protects capacity without turning home life into performance management.

## Re-verify

    git log --oneline --since="2026-07-02" -- "src/features/chores/useChores.ts" "src/features/chores/useChoreActions.ts" "src/components/chores/ChoresTabContent.tsx" "src/components/chores/ChoreCheckInPanel.tsx"

Run focused tests and read every mutating route before implementation.

