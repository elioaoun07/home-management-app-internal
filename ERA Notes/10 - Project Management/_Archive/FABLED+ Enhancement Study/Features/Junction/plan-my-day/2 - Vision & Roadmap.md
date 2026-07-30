---
created: 2026-07-11
type: fabled-plus-vision-roadmap
status: current
scope: feature
feature: Plan My Day
module_type: Junction
evidence_cutoff: 2026-07-11
baseline: FABLED 2 plus current working-tree delta
---

# Plan My Day · Vision & Roadmap

> [FABLED+ root](<../../../_index.md>) · **Plan My Day** · [1 · Feature State](<1 - Feature State.md>) · [2 · Vision & Roadmap](<2 - Vision & Roadmap.md>) · [3 · Action Plan](<3 - Action Plan.md>) · [4 · Checklist](<4 - Checklist.md>)

## Enhancement thesis

Make day planning a transparent constraint negotiation: protect anchors, show assumptions, rehearse disruption, and learn from actual adjustments.

## Business and household value

A trustworthy plan reduces morning decision load. Explanation and resilience matter more than a mathematically dense optimizer.

Measure attention returned, risk reduced, and outcomes improved—not engagement.

## Roadmap

1. Now — pin cross-view occurrence semantics and define constraint/uncertainty types.
2. Next — explain one proposed placement and support protected anchors.
3. Later — shadow-replay disruptions and calibrate estimates from user adjustments.

## New opportunity set

### V1 — Constraint receipt

- **Mechanism:** Show why each item was placed: anchor, duration, window, dependency, preference, and compromise.
- **Smallest proof:** Generate receipts for one day's manual plan.
- **Success measure:** Users understand and correct a placement without opening item details.
- **Kill criterion:** Use a short reason chip if full receipts are ignored.
- **Invariant:** Only real constraints are cited.

### V2 — Disruption rehearsal

- **Mechanism:** Simulate losing a time block and show what moves, breaks, or remains protected before applying.
- **Smallest proof:** Rehearse one two-hour disruption.
- **Success measure:** A revised plan is chosen in under a minute.
- **Kill criterion:** Keep manual replanning if simulations are rarely used.
- **Invariant:** Rehearsal cannot mutate schedule.

### V3 — Protected anchor contract

- **Mechanism:** Declare items/events that cannot move without explicit override and consequence preview.
- **Smallest proof:** Protect three weekly anchors.
- **Success measure:** No automated/proposed replan moves them silently.
- **Kill criterion:** Use existing fixed events if anchor semantics add nothing.
- **Invariant:** Override is explicit and auditable.

## Existing-roadmap boundary

Intent-aware planning, week-shape, schedule pressure index, and overdue roll-forward are prior ideas; this pack adds explainability and disruption rehearsal.

## Strategy guardrail

Start read-only or shadowed; use existing proposal and mutation owners; earn automation.

