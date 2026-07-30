---
created: 2026-07-11
type: fabled-plus-feature-state
status: current
scope: feature
feature: Budget Allocation
module_type: Standalone
evidence_cutoff: 2026-07-11
baseline: FABLED 2 plus current working-tree delta
---

# Budget Allocation · Feature State

> [FABLED+ root](<../../../_index.md>) · **Budget Allocation** · [1 · Feature State](<1 - Feature State.md>) · [2 · Vision & Roadmap](<2 - Vision & Roadmap.md>) · [3 · Action Plan](<3 - Action Plan.md>) · [4 · Checklist](<4 - Checklist.md>)

## Current verdict

A capable envelope planner with AI-assisted suggestions, but allocations remain static targets instead of negotiated, confidence-aware commitments that adapt to actual household behavior.

## Verified footprint

- `ERA Notes/01 - Architecture/Feature Map/standalone/budget-allocation.md`
- `ERA Notes/02 - Standalone Modules/Budget Allocation/Overview.md`
- `src/features/budget/hooks.ts`
- `src/lib/budget/budgetForecast.ts`
- `src/app/api/budget-allocations/route.ts`
- `src/app/api/ai-budget-suggestions/route.ts`
- `migrations/schema.sql`

Checked against the 2026-07-11 working tree; current source wins over documentation.

## Outcome loop

| Stage | Current state |
|---|---|
| **Observe** | Income, category spend, allocations, and billing window are available. |
| **Interpret** | Variance and suggestion logic translate history into targets. |
| **Propose** | AI and deterministic suggestions can propose allocations. |
| **Commit** | Users save category allocations. |
| **Verify** | No explicit review determines whether a target was realistic or useful. |
| **Learn** | Accepted, ignored, and repeatedly edited allocations do not calibrate future proposals. |

## Existing leverage

- Allocations are connected to real categories and custom billing periods.
- AI suggestions already have a deterministic statistical fallback, an excellent trust precedent.
- The module can compare plan and actual spend without needing a new capture surface.

## Feedback, friction, and risk

- A single amount implies false precision where a safe range would better reflect volatile income and prices.
- Joint priorities have no lightweight consent or dissent record, so a shared plan can still be one person's configuration.
- The module measures variance but not whether the allocation improved the intended outcome.

## Study conclusion

**Inference:** Shift from fixed envelopes to household guardrails: ranges tied to intent, agreed by the people affected, and reviewed by outcome.

## Re-verify

    git log --oneline --since="2026-07-02" -- "src/features/budget/hooks.ts" "src/lib/budget/budgetForecast.ts" "src/app/api/budget-allocations/route.ts" "src/app/api/ai-budget-suggestions/route.ts"

Re-read every mutating route and run focused tests before implementation.

