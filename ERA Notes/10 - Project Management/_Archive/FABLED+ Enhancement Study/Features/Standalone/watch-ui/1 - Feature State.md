---
created: 2026-07-11
type: fabled-plus-feature-state
status: current
scope: feature
feature: Watch UI
module_type: Standalone
evidence_cutoff: 2026-07-11
baseline: FABLED 2 plus current working-tree delta
---

# Watch UI · Feature State

> [FABLED+ root](<../../../_index.md>) · **Watch UI** · [1 · Feature State](<1 - Feature State.md>) · [2 · Vision & Roadmap](<2 - Vision & Roadmap.md>) · [3 · Action Plan](<3 - Action Plan.md>) · [4 · Checklist](<4 - Checklist.md>)

## Current verdict

A compact glance-and-capture surface with voice and transaction access, but its micro-interactions are not yet treated as a distinct reliability, haptic, offline, and handoff product contract.

## Verified footprint

- `ERA Notes/01 - Architecture/Feature Map/standalone/watch-ui.md`
- `ERA Notes/02 - Standalone Modules/Watch UI/Overview.md`
- `src/components/watch/WatchView.tsx`
- `src/components/watch/SimpleWatchView.tsx`
- `src/components/watch/WatchErrorBoundary.tsx`
- `src/lib/speechExpense.ts`

Checked against the 2026-07-11 working tree; source wins over docs.

## Outcome loop

| Stage | Current state |
|---|---|
| **Observe** | Voice/tap capture and today information are available. |
| **Interpret** | Speech parser turns utterance into transaction fields. |
| **Propose** | Limited review fits the small surface. |
| **Commit** | Some actions can be sent from the watch. |
| **Verify** | Offline, retry, and phone-handoff state are weakly communicated. |
| **Learn** | No data shows which glance or capture patterns deserve the surface. |

## Existing leverage

- The watch lowers capture friction in contexts where phone forms are inappropriate.
- Simple and richer views provide fallback options.
- Voice parsing reuses transaction semantics instead of inventing a separate money model.

## Feedback, friction, and risk

- Small-screen confirmation can hide uncertainty that would be obvious on phone.
- Network failure and delayed sync need haptic/visual states that do not imply success.
- Complex drafts require resumable handoff rather than shrinking phone review onto a watch.

## Study conclusion

**Inference:** Design the watch as an interruption-budgeted companion: glance, micro-confirm, haptic truth, and seamless handoff—never a compressed full app.

## Re-verify

    git log --oneline --since="2026-07-02" -- "src/components/watch/WatchView.tsx" "src/components/watch/SimpleWatchView.tsx" "src/components/watch/WatchErrorBoundary.tsx" "src/lib/speechExpense.ts"

Run focused tests and read mutating routes before implementation.

