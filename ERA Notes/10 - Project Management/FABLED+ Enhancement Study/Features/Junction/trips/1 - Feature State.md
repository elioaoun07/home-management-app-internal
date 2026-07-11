---
created: 2026-07-11
type: fabled-plus-feature-state
status: current
scope: feature
feature: Trips
module_type: Junction
evidence_cutoff: 2026-07-11
baseline: FABLED 2 plus current working-tree delta
---

# Trips · Feature State

> [FABLED+ root](<../../../_index.md>) · **Trips** · [1 · Feature State](<1 - Feature State.md>) · [2 · Vision & Roadmap](<2 - Vision & Roadmap.md>) · [3 · Action Plan](<3 - Action Plan.md>) · [4 · Checklist](<4 - Checklist.md>)

## Current verdict

A high-leverage lifecycle junction spanning accounts, recurrence pauses, chores, meal planning, places, packing, and reversible side effects, but its activation is still too close to a live multi-module migration to be trusted without isolation and rehearsal.

## Verified footprint

- `ERA Notes/01 - Architecture/Feature Map/junction/trips.md`
- `ERA Notes/03 - Junction Modules/Trips/Overview.md`
- `src/features/trips/hooks.ts`
- `src/components/trips`
- `src/app/api/trips/[id]/activate/route.ts`
- `src/app/api/trips/[id]/complete/route.ts`
- `migrations/schema.sql`

Checked against the 2026-07-11 working tree; source wins over docs.

## Outcome loop

| Stage | Current state |
|---|---|
| **Observe** | Trip details, places, packing, and side effects are captured. |
| **Interpret** | Activation determines cross-module changes. |
| **Propose** | Impact can be previewed in concept, not fully isolated. |
| **Commit** | Activate/complete routes perform broad effects. |
| **Verify** | End-to-end cascade and rollback proof remain weak. |
| **Learn** | Completed trips do not improve future contingency, ownership, or setup decisions. |

## Existing leverage

- Trip, places, packing, and side-effect records form a real lifecycle model.
- The side-effect ledger is designed for reversibility.
- Activation bridges multiple modules in one meaningful household mode.

## Feedback, friction, and risk

- A preview against live state can drift between review and activation; isolation/version preconditions are needed.
- Travel disruption—delay, cancellation, lost item, overspend, illness—has no coherent recovery playbook.
- Shared trip decisions and responsibilities are distributed across lists and conversation.

## Study conclusion

**Inference:** Treat a trip as a temporary branch of household operations: rehearse in isolation, commit with version checks, operate from contingency playbooks, and merge back with a receipt.

## Re-verify

    git log --oneline --since="2026-07-02" -- "src/features/trips/hooks.ts" "src/components/trips" "src/app/api/trips/[id]/activate/route.ts" "src/app/api/trips/[id]/complete/route.ts"

Trace every connected standalone before implementation.

