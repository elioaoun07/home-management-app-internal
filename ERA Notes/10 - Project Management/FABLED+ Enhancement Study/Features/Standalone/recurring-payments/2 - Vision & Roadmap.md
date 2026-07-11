---
created: 2026-07-11
type: fabled-plus-vision-roadmap
status: current
scope: feature
feature: Recurring Payments
module_type: Standalone
evidence_cutoff: 2026-07-11
baseline: FABLED 2 plus current working-tree delta
---

# Recurring Payments · Vision & Roadmap

> [FABLED+ root](<../../../_index.md>) · **Recurring Payments** · [1 · Feature State](<1 - Feature State.md>) · [2 · Vision & Roadmap](<2 - Vision & Roadmap.md>) · [3 · Action Plan](<3 - Action Plan.md>) · [4 · Checklist](<4 - Checklist.md>)

## Enhancement thesis

Evolve recurring payments from a date generator into an obligation-assurance system that can say what is due, how sure it is, and what evidence closed the loop.

## Product and business value

Missed bills and false alarms both destroy trust. Evidence-aware obligation assurance reduces mental bookkeeping and is a credible premium-grade differentiator even in a two-person product.

Value should be measured in avoided corrections, prevented surprises, shorter decisions, safer shared action, or attention returned—not page visits.

## Roadmap

1. Now — classify coverage evidence and variance using existing commitment fixtures.
2. Next — add expected amount bands and ownership/acknowledgement semantics to the review surface.
3. Later — measure false reminders, manual overrides, and early-warning usefulness before increasing autonomy.

## New opportunity set

### V1 — Coverage evidence ladder

- **Mechanism:** Distinguish exact transaction match, partial match, manual confirmation, and unresolved coverage with explicit provenance.
- **Smallest proof:** Render the ladder for five real commitments without changing posting.
- **Success measure:** Every covered item can be explained from one evidence source.
- **Kill criterion:** Collapse back to covered/manual if extra levels do not affect decisions.
- **Invariant:** Evidence classification never posts or deletes money.

### V2 — Obligation variance bands

- **Mechanism:** Learn a robust expected range from prior confirmed amounts and flag only material drift.
- **Smallest proof:** Run a pure function over utilities, telecom, and fixed-rent fixtures.
- **Success measure:** Variable bills produce fewer false anomalies while catching a seeded price jump.
- **Kill criterion:** Use a manual range when history is too sparse.
- **Invariant:** Historical outliers are displayed, not silently discarded.

### V3 — Shared obligation handshake

- **Mechanism:** Allow one partner to claim, verify, or request confirmation of a joint commitment with an expiry.
- **Smallest proof:** Prototype acknowledgement states on one household bill.
- **Success measure:** Ownership questions drop and no bill is falsely assumed handled.
- **Kill criterion:** Keep single-owner semantics if both users do not use the handshake.
- **Invariant:** Silence is never treated as consent or payment.

## Relationship to existing plans

Cashflow forecast, recurring↔schedule unification, subscription auditing, and Sunday money rituals are existing ideas; this pack targets evidence and assurance. These proposals complement the baseline rather than renaming its ideas.

## Strategic boundary

Do not add a second engine, bypass the proposal/draft pattern, weaken household visibility, or automate a state change before its shadow proof and inverse action are written.

