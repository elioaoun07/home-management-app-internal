---
created: 2026-07-11
type: fabled-plus-vision-roadmap
status: current
scope: feature
feature: AI Assistant
module_type: Junction
evidence_cutoff: 2026-07-11
baseline: FABLED 2 plus current working-tree delta
---

# AI Assistant · Vision & Roadmap

> [FABLED+ root](<../../../_index.md>) · **AI Assistant** · [1 · Feature State](<1 - Feature State.md>) · [2 · Vision & Roadmap](<2 - Vision & Roadmap.md>) · [3 · Action Plan](<3 - Action Plan.md>) · [4 · Checklist](<4 - Checklist.md>)

## Enhancement thesis

Make ERA a compiler of bounded, inspectable capabilities: evidence in, typed plan out, shadow evaluation, human decision, deterministic commit, outcome receipt.

## Business and household value

Trustworthy extensibility is the moat. A passport lets new capabilities ship faster with consistent safety and exposes what the assistant can honestly do.

Measure attention returned, risk reduced, and outcomes improved—not engagement.

## Roadmap

1. Now — define a read-only Capability Passport and create one for a money lookup and one action.
2. Next — run action plans in shadow mode against fixtures and compare predicted with actual effects.
3. Later — calibrate confidence and clarification cost per capability from explicit outcomes.

## New opportunity set

### V1 — Capability Passport

- **Mechanism:** Declare inputs, evidence, permissions, risk, fallback, timeout, proposal renderer, mutation owner, inverse, and tests per capability.
- **Smallest proof:** Passport two existing intents without refactoring them.
- **Success measure:** A reviewer can audit both end-to-end without searching the repo.
- **Kill criterion:** Keep a smaller contract if fields are not consumed by code/tests.
- **Invariant:** Passport describes the real owner; it cannot grant permission.

### V2 — Shadow plan evaluator

- **Mechanism:** Execute a typed proposed plan against fixture/current read models without mutations and compare predicted effects/preconditions.
- **Smallest proof:** Shadow one transaction-related action over 20 fixtures.
- **Success measure:** All effects and failure reasons are known before confirmation.
- **Kill criterion:** Limit shadowing to material actions if pure reads are enough elsewhere.
- **Invariant:** Shadow path has no mutation client or service-role access.

### V3 — Intent calibration profile

- **Mechanism:** Track confidence, clarification, correction, and accepted outcome separately by capability and user.
- **Smallest proof:** Collect outcomes for three high-volume intents.
- **Success measure:** One threshold/default changes with lower corrections and no unsafe commits.
- **Kill criterion:** Use fixed conservative thresholds if data stays sparse.
- **Invariant:** Low evidence can only reduce autonomy.

## Existing-roadmap boundary

One assistant registry, proactive briefing, memory-grounded ERA, generic multi-turn flows, wake word, and AnalysisReport reuse are existing plans; this pack adds enforceable capability contracts and calibration.

## Strategy guardrail

Start read-only or shadowed; use existing proposal and mutation owners; earn automation.

