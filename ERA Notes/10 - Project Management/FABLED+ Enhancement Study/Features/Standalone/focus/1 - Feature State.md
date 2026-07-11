---
created: 2026-07-11
type: fabled-plus-feature-state
status: current
scope: feature
feature: Focus
module_type: Standalone
evidence_cutoff: 2026-07-11
baseline: FABLED 2 plus current working-tree delta
---

# Focus · Feature State

> [FABLED+ root](<../../../_index.md>) · **Focus** · [1 · Feature State](<1 - Feature State.md>) · [2 · Vision & Roadmap](<2 - Vision & Roadmap.md>) · [3 · Action Plan](<3 - Action Plan.md>) · [4 · Checklist](<4 - Checklist.md>)

## Current verdict

A documented module whose mapped page, layout, components, and feature directory are absent from the current tree; only the focus-insights API remains, so the immediate need is an ownership decision, not enhancement code.

## Verified footprint

- `ERA Notes/01 - Architecture/Feature Map/standalone/focus.md`
- `ERA Notes/02 - Standalone Modules/Focus/Overview.md`
- `src/app/api/focus-insights/route.ts`
- `src/features/items/useFlexibleRoutines.ts`
- `src/components/web/WebTodayView.tsx`

Checked against the 2026-07-11 working tree; source wins over docs.

## Outcome loop

| Stage | Current state |
|---|---|
| **Observe** | No dedicated current UI; schedule data can feed insights. |
| **Interpret** | A focus-insights route exists. |
| **Propose** | Possible insights, but ownership and consumer are unclear. |
| **Commit** | No dedicated current focus mutation surface. |
| **Verify** | No module-specific outcome loop is evident. |
| **Learn** | No verified learning loop. |

## Existing leverage

- The surviving insights route and flexible-routine substrate preserve useful intent.
- Schedule already owns recurrence and placement, avoiding a need for a new engine.
- The documentation makes the original product purpose recoverable.

## Feedback, friction, and risk

- Feature Map and Overview describe files that no longer exist, so agents can be routed into a ghost module.
- It is unclear whether Focus is dormant product, absorbed schedule behavior, or an API capability.
- Rebuilding a page before proving demand would repeat the feature-estate problem.

## Study conclusion

**Inference:** Resolve Focus as a capability boundary first: fold its useful insight into Schedule/Today, or restore a minimal surface only when a real routine need proves it deserves ownership.

## Re-verify

    git log --oneline --since="2026-07-02" -- "src/app/api/focus-insights/route.ts" "src/features/items/useFlexibleRoutines.ts" "src/components/web/WebTodayView.tsx"

Run focused tests and read every mutating route before implementation.

