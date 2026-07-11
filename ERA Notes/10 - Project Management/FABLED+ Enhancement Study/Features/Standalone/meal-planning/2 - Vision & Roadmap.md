---
created: 2026-07-11
type: fabled-plus-vision-roadmap
status: current
scope: feature
feature: Meal Planning
module_type: Standalone
evidence_cutoff: 2026-07-11
baseline: FABLED 2 plus current working-tree delta
---

# Meal Planning · Vision & Roadmap

> [FABLED+ root](<../../../_index.md>) · **Meal Planning** · [1 · Feature State](<1 - Feature State.md>) · [2 · Vision & Roadmap](<2 - Vision & Roadmap.md>) · [3 · Action Plan](<3 - Action Plan.md>) · [4 · Checklist](<4 - Checklist.md>)

## Enhancement thesis

Make the meal plan a resilient household agreement, not a perfect calendar: mutually acceptable, energy-aware, and easy to recover when life changes.

## Business and household value

Fewer last-minute decisions, fewer unused ingredients, and less negotiation create daily value. Reliability matters more than an optimized menu.

Measure attention returned, conflict avoided, and outcomes improved—not engagement.

## Roadmap

1. Now — record cooked/skipped/substituted and actual effort for one week.
2. Next — add a two-person preference/objection pass and backup slot.
3. Later — propose resilient weeks from explicit outcomes without auto-scheduling.

## New opportunity set

### V1 — Negotiated meal slate

- **Mechanism:** Each person can endorse, object, or mark indifferent; the plan exposes unresolved slots.
- **Smallest proof:** Use it for one week with at most one interaction per meal.
- **Success measure:** Fewer off-app meal decisions and no person feels the plan is imposed.
- **Kill criterion:** Return to a shared note if reactions are not used.
- **Invariant:** Silence is neutral, not agreement.

### V2 — Plan resilience layer

- **Mechanism:** Attach fast backup, thaw/prep dependency, and latest-start threshold to selected meals.
- **Smallest proof:** Configure three meals and simulate one disrupted evening.
- **Success measure:** A disruption switches plans in under a minute without waste.
- **Kill criterion:** Keep only a single emergency-meal list if per-meal setup is heavy.
- **Invariant:** Switching is proposed and reversible.

### V3 — Effort calibration

- **Mechanism:** Compare expected active effort with one-tap actual effort and context.
- **Smallest proof:** Collect ten cooked outcomes.
- **Success measure:** Next week's plan avoids at least one unrealistic high-effort cluster.
- **Kill criterion:** Use recipe defaults if feedback remains sparse.
- **Invariant:** Energy inference is advisory and never a health claim.

## Existing-roadmap boundary

Budget-aware planning, pantry awareness, meal visibility on time surfaces, leftovers, and kitchen briefing signals are existing roadmaps; this pack targets negotiation and resilience.

## Strategy guardrail

Start read-only or in shadow mode. Persist, notify, or automate only after a real proof passes its gate.

