---
created: 2026-07-11
type: fabled-plus-feature-state
status: current
scope: feature
feature: Recycle Bin
module_type: Standalone
evidence_cutoff: 2026-07-11
baseline: FABLED 2 plus current working-tree delta
---

# Recycle Bin · Feature State

> [FABLED+ root](<../../../_index.md>) · **Recycle Bin** · [1 · Feature State](<1 - Feature State.md>) · [2 · Vision & Roadmap](<2 - Vision & Roadmap.md>) · [3 · Action Plan](<3 - Action Plan.md>) · [4 · Checklist](<4 - Checklist.md>)

## Current verdict

A sound soft-delete and restore safety net, but deletion and restoration are row-centric while related actions, external sync, recurrence, and retention consequences can extend beyond the restored item.

## Verified footprint

- `ERA Notes/01 - Architecture/Feature Map/standalone/recycle-bin.md`
- `ERA Notes/02 - Standalone Modules/Recycle Bin/Overview.md`
- `src/features/recycle-bin/hooks.ts`
- `src/app/recycle-bin/page.tsx`
- `src/app/api/recycle-bin/route.ts`
- `src/app/api/recycle-bin/restore/route.ts`
- `src/app/api/cron/purge-recycle-bin/route.ts`

Checked against the 2026-07-11 working tree; source wins over docs.

## Outcome loop

| Stage | Current state |
|---|---|
| **Observe** | Deleted rows and timestamps are recorded. |
| **Interpret** | The bin lists recoverable items. |
| **Propose** | Restore is offered. |
| **Commit** | Restore and purge mutate lifecycle. |
| **Verify** | Related child/external effects are not always previewed as a bundle. |
| **Learn** | Deletion reasons and restore regret do not improve retention or UX. |

## Existing leverage

- Soft deletion and explicit restore preserve reversibility.
- A purge path provides lifecycle closure.
- Recent Calendar sync handling recognizes that restore can have external consequences.

## Feedback, friction, and risk

- Restore can reawaken alerts, recurrence, calendar sync, or dependencies without a full impact preview.
- One retention window does not fit financial evidence, guest data, schedule items, and sensitive content.
- The system does not learn whether deletion was cleanup, correction, privacy, duplicate, or temporary uncertainty.

## Study conclusion

**Inference:** Make deletion a reversible lifecycle contract: dependency-aware preview, purpose-aware retention, explicit external effects, and a final purge receipt.

## Re-verify

    git log --oneline --since="2026-07-02" -- "src/features/recycle-bin/hooks.ts" "src/app/recycle-bin/page.tsx" "src/app/api/recycle-bin/route.ts" "src/app/api/recycle-bin/restore/route.ts"

Run focused tests and inspect consumers before implementation.

