---
created: 2026-07-11
type: fabled-plus-vision-roadmap
status: current
scope: feature
feature: Recipes
module_type: Standalone
evidence_cutoff: 2026-07-11
baseline: FABLED 2 plus current working-tree delta
---

# Recipes · Vision & Roadmap

> [FABLED+ root](<../../../_index.md>) · **Recipes** · [1 · Feature State](<1 - Feature State.md>) · [2 · Vision & Roadmap](<2 - Vision & Roadmap.md>) · [3 · Action Plan](<3 - Action Plan.md>) · [4 · Checklist](<4 - Checklist.md>)

## Enhancement thesis

Turn recipes into evidence-backed household playbooks that learn from actual cooks while keeping food safety and preference transparent.

## Business and household value

The win is repeatable success: less cognitive load while cooking, fewer failed substitutions, and recipes that become uniquely tuned household assets.

Measure attention returned, conflict avoided, and outcomes improved—not engagement.

## Roadmap

1. Now — label extracted/estimated/verified fields and collect outcome feedback on one recipe.
2. Next — build a deterministic cooking critical path for timer-heavy recipes.
3. Later — maintain household-approved variants from repeated outcomes, never silent AI rewrites.

## New opportunity set

### V1 — Recipe truth envelope

- **Mechanism:** Label source, extraction confidence, verified quantity, and safety-critical notes per field.
- **Smallest proof:** Apply to three imported recipes.
- **Success measure:** Uncertain quantities are resolved before cooking rather than during it.
- **Kill criterion:** Keep a recipe-level badge if field granularity is too heavy.
- **Invariant:** AI output never marks itself verified.

### V2 — Cooking critical path

- **Mechanism:** Derive parallel prep, wait, timer, and dependency lanes from explicit steps.
- **Smallest proof:** Model one multi-component dinner deterministically.
- **Success measure:** The cook finishes closer to the target with fewer missed timers.
- **Kill criterion:** Keep normal linear mode for simple recipes.
- **Invariant:** The path never invents temperatures or food-safety times.

### V3 — Household approved variant

- **Mechanism:** Promote a version only after both outcome evidence and relevant household preference are recorded.
- **Smallest proof:** Compare two variants of one recurring dish.
- **Success measure:** The next cook chooses confidently without reading version history.
- **Kill criterion:** Use personal favorites if tastes genuinely differ.
- **Invariant:** Original versions remain recoverable.

## Existing-roadmap boundary

Pantry-aware cooking, unit canonicalization, leftovers, AI reports, and generic ontology are prior ideas; this pack focuses on recipe truth and execution outcome.

## Strategy guardrail

Start read-only or in shadow mode. Persist, notify, or automate only after a real proof passes its gate.

