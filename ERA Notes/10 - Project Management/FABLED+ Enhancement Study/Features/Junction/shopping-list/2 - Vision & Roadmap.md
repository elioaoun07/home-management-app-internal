---
created: 2026-07-11
type: fabled-plus-vision-roadmap
status: current
scope: feature
feature: Shopping List
module_type: Junction
evidence_cutoff: 2026-07-11
baseline: FABLED 2 plus current working-tree delta
---

# Shopping List · Vision & Roadmap

> [FABLED+ root](<../../../_index.md>) · **Shopping List** · [1 · Feature State](<1 - Feature State.md>) · [2 · Vision & Roadmap](<2 - Vision & Roadmap.md>) · [3 · Action Plan](<3 - Action Plan.md>) · [4 · Checklist](<4 - Checklist.md>)

## Enhancement thesis

Make shopping a live acquisition protocol: claim, constraints, substitution decision, receipt, and handoff—without turning the list into inventory bureaucracy.

## Business and household value

Fewer duplicate buys, calls, and wrong substitutions return immediate household attention. The list becomes a shared operational tool, not merely synchronized text.

Measure attention returned, risk reduced, and outcomes improved—not engagement.

## Roadmap

1. Now — define claim and acquisition outcomes in the current list model.
2. Next — add substitution compact to one high-friction item class.
3. Later — learn stable acquisition preferences only from explicit accepted outcomes.

## New opportunity set

### V1 — Collaborative claim

- **Mechanism:** Represent unclaimed, claimed, picked, unavailable, and released with actor and expiry.
- **Smallest proof:** Use it during one two-person shopping trip.
- **Success measure:** No duplicate acquisition and fewer coordination messages.
- **Kill criterion:** Keep simple presence if simultaneous shopping is rare.
- **Invariant:** A stale claim expires visibly; it never marks purchased.

### V2 — Substitution compact

- **Mechanism:** Attach must-have, flexible, forbidden, price ceiling, and ask-me rules per item/template.
- **Smallest proof:** Configure five sensitive items.
- **Success measure:** Substitutions are decided without a live call and match preferences.
- **Kill criterion:** Keep item chat if structured rules are not reused.
- **Invariant:** Safety/allergy constraints cannot be overridden silently.

### V3 — Acquisition receipt

- **Mechanism:** Record acquired variant/quantity/price or unavailable reason with minimal taps.
- **Smallest proof:** Collect receipts for ten items.
- **Success measure:** At least one future list/default improves without added entry burden.
- **Kill criterion:** Capture only unavailable/substituted outcomes if full receipt is too slow.
- **Invariant:** Completion without details remains valid, not fabricated.

## Existing-roadmap boundary

Self-driving list, pantry awareness, unit canonicalization, shopping-trip mode, price feeds, and product comparison are existing ideas; this pack targets collaboration and substitution contracts.

## Strategy guardrail

Start read-only or shadowed; use existing proposal and mutation owners; earn automation.

