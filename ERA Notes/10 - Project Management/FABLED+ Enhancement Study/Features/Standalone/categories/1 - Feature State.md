---
created: 2026-07-11
type: fabled-plus-feature-state
status: current
scope: feature
feature: Categories
module_type: Standalone
evidence_cutoff: 2026-07-11
baseline: FABLED 2 plus current working-tree delta
---

# Categories · Feature State

> [FABLED+ root](<../../../_index.md>) · **Categories** · [1 · Feature State](<1 - Feature State.md>) · [2 · Vision & Roadmap](<2 - Vision & Roadmap.md>) · [3 · Action Plan](<3 - Action Plan.md>) · [4 · Checklist](<4 - Checklist.md>)

## Current verdict

A flexible classification system that supports personalized capture, but it optimizes label management rather than the quality, stability, and decision value of the household taxonomy.

## Verified implementation footprint

- `ERA Notes/01 - Architecture/Feature Map/standalone/categories.md`
- `ERA Notes/02 - Standalone Modules/Categories/Overview.md`
- `src/features/categories/hooks.ts`
- `src/components/expense/CategoryManagerDialog.tsx`
- `src/app/api/categories/route.ts`
- `src/app/api/categories/manage/route.ts`
- `migrations/schema.sql`

The footprint was checked against the working tree on 2026-07-11. Source code wins if a referenced document has drifted.

## Outcome-loop state

| Stage | Current state |
|---|---|
| **Observe** | Category choices and edits are captured. |
| **Interpret** | Hierarchy and account scope organize transactions. |
| **Propose** | Mappings and defaults can suggest labels. |
| **Commit** | CRUD and reorder flows mutate taxonomy. |
| **Verify** | No health check shows orphaned, overlapping, or unstable categories. |
| **Learn** | Corrections are not used to measure taxonomy quality or simplify it. |

## What is already valuable

- User categories, hierarchy, color, icon, reordering, and account scoping give strong personalization.
- Category selection is embedded directly in the high-frequency expense capture flow.
- Cross-user slug matching is already recognized as a household correctness rule.

## Feedback: leverage gaps and risks

- The system cannot distinguish a stable decision category from a temporary reporting label, creating taxonomy entropy over time.
- Two people may use semantically equivalent categories with different slugs, colors, or granularity despite matching rules.
- Category health is invisible: concentration, correction rate, unused branches, and ambiguous overlaps are not surfaced.

## Study conclusion

**Inference:** Treat categories as a living decision language: small enough to capture quickly, stable enough for history, and expressive enough to guide action. The feature should not become “more AI” by default; it should make its truth, decision, and outcome boundaries more explicit.

## Re-verification commands

    rg --files "ERA Notes/01 - Architecture/Feature Map/standalone"
    git log --oneline --since="2026-07-02" -- "src/features/categories/hooks.ts" "src/components/expense/CategoryManagerDialog.tsx" "src/app/api/categories/route.ts"

Re-run the relevant focused tests before moving any score.

