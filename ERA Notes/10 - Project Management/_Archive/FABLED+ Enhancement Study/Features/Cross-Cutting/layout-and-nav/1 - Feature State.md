---
created: 2026-07-11
type: fabled-plus-feature-state
status: current
scope: feature
feature: Layout & Navigation
module_type: Cross-Cutting
evidence_cutoff: 2026-07-11
baseline: FABLED 2 plus current working-tree delta
---

# Layout & Navigation · Feature State

> [FABLED+ root](<../../../_index.md>) · **Layout & Navigation** · [1 · Feature State](<1 - Feature State.md>) · [2 · Vision & Roadmap](<2 - Vision & Roadmap.md>) · [3 · Action Plan](<3 - Action Plan.md>) · [4 · Checklist](<4 - Checklist.md>)

## Current verdict

A responsive shell with conditional headers, mobile navigation, tabs, FAB, deep links, and route-specific isolation, but it organizes destinations better than interrupted work, current context, and safe continuation.

## Verified footprint

- `ERA Notes/01 - Architecture/Feature Map/cross-cutting/layout-and-nav.md`
- `src/app/layout.tsx`
- `src/components/layouts`
- `src/components/MobileNav.tsx`
- `src/contexts/TabContext.tsx`
- `src/contexts/AppModeContext.tsx`
- `src/components/web/WebTabletMissionControl.tsx`

Checked against the 2026-07-11 working tree; source wins over docs.

## Outcome loop

| Stage | Current state |
|---|---|
| **Observe** | Route, tab, device, deep-link intent, and mode are known. |
| **Interpret** | Shell chooses header/nav/FAB and target. |
| **Propose** | Navigation presents destinations/actions. |
| **Commit** | Route/tab transitions occur. |
| **Verify** | Interrupted form/modal/workflow restoration is inconsistent. |
| **Learn** | Navigation dead ends and repeated backtracking do not simplify the information architecture. |

## Existing leverage

- Mobile-first shell and conditional route behavior handle many product surfaces.
- TabContext supports notification deep links and pending entity focus.
- AppMode/FAB patterns adapt common capture actions.

## Feedback, friction, and risk

- Users return to a feature, not necessarily the exact unfinished decision or draft.
- Contextual actions can move location or meaning between surfaces, reducing muscle memory.
- Standalone/guest/NFC isolation and fixed headers are correctness rules that need automated route-layout contracts.

## Study conclusion

**Inference:** Shift navigation from places to continuity: preserve exact work state, keep one predictable action anchor, and make route isolation mechanically testable.

## Re-verify

    git log --oneline --since="2026-07-02" -- "src/components/layouts" "src/components/MobileNav.tsx" "src/contexts/TabContext.tsx" "src/contexts/AppModeContext.tsx"

Trace all consumers before implementation.

