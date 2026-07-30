---
created: 2026-07-11
type: fabled-plus-feature-state
status: current
scope: feature
feature: Recipes
module_type: Standalone
evidence_cutoff: 2026-07-11
baseline: FABLED 2 plus current working-tree delta
---

# Recipes · Feature State

> [FABLED+ root](<../../../_index.md>) · **Recipes** · [1 · Feature State](<1 - Feature State.md>) · [2 · Vision & Roadmap](<2 - Vision & Roadmap.md>) · [3 · Action Plan](<3 - Action Plan.md>) · [4 · Checklist](<4 - Checklist.md>)

## Current verdict

A sophisticated recipe system with extraction, versions, scaling, substitution, optimization, cooking mode, and logs, but its intelligence is recipe-centric rather than outcome- and household-centric.

## Verified footprint

- `ERA Notes/01 - Architecture/Feature Map/standalone/recipes.md`
- `ERA Notes/02 - Standalone Modules/Recipes/Overview.md`
- `src/features/recipes/hooks.ts`
- `src/components/web/RecipeCookingMode.tsx`
- `src/app/api/recipes/route.ts`
- `src/app/api/recipes/[id]/versions/route.ts`
- `src/app/api/recipes/[id]/cooking-log/route.ts`

Checked against the 2026-07-11 working tree; source wins over docs.

## Outcome loop

| Stage | Current state |
|---|---|
| **Observe** | Ingredients, steps, versions, sources, substitutions, and cooking logs are captured. |
| **Interpret** | Scaling and AI helpers transform a recipe. |
| **Propose** | Optimization, generation, and substitution produce suggestions. |
| **Commit** | Users save versions and logs. |
| **Verify** | Safety, taste, timing, and substitution outcomes are not consistently tied back. |
| **Learn** | Versions exist, but successful changes are not automatically distinguished from abandoned experiments. |

## Existing leverage

- Versioning makes recipe evolution auditable.
- Scaling, substitutions, extraction, generation, and cooking mode create an unusually complete precision tool.
- Cooking logs provide a foothold for real outcome learning.

## Feedback, friction, and risk

- A recipe's canonical text cannot express confidence in extracted quantities or substitution safety.
- Cooking mode follows steps but does not model the critical path across timers, prep, and shared kitchen attention.
- Two users' taste, skill, dietary constraints, and preferred version can diverge without explicit household resolution.

## Study conclusion

**Inference:** Turn recipes into evidence-backed household playbooks that learn from actual cooks while keeping food safety and preference transparent.

## Re-verify

    git log --oneline --since="2026-07-02" -- "src/features/recipes/hooks.ts" "src/components/web/RecipeCookingMode.tsx" "src/app/api/recipes/route.ts" "src/app/api/recipes/[id]/versions/route.ts"

Run focused tests and read every mutating route before implementation.

