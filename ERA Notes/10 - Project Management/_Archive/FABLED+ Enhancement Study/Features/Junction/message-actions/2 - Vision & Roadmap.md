---
created: 2026-07-11
type: fabled-plus-vision-roadmap
status: current
scope: feature
feature: Message Actions
module_type: Junction
evidence_cutoff: 2026-07-11
baseline: FABLED 2 plus current working-tree delta
---

# Message Actions · Vision & Roadmap

> [FABLED+ root](<../../../_index.md>) · **Message Actions** · [1 · Feature State](<1 - Feature State.md>) · [2 · Vision & Roadmap](<2 - Vision & Roadmap.md>) · [3 · Action Plan](<3 - Action Plan.md>) · [4 · Checklist](<4 - Checklist.md>)

## Enhancement thesis

Compile each message into a typed, idempotent action plan with explicit preconditions, effects, compensation, source receipt, and correction feedback.

## Business and household value

Reliable conversational actions are the capture moat. Atomic plans let breadth grow without multiplying silent partial failures.

Measure attention returned, risk reduced, and outcomes improved—not engagement.

## Roadmap

1. Now — define a pure ActionPlan for one existing single action and one two-step example.
2. Next — commit through existing mutations with one operation identity and source-bound receipt.
3. Later — reuse correction outcomes across parsers only where deterministic patterns repeat.

## New opportunity set

### V1 — Typed action plan

- **Mechanism:** Represent ordered steps, dependencies, preconditions, predicted effects, mutation owners, and compensations.
- **Smallest proof:** Compile one message-to-transaction and one message-to-reminder fixture.
- **Success measure:** Plan and committed receipt match exactly.
- **Kill criterion:** Use single-action envelope for simple messages.
- **Invariant:** The model may propose a plan but cannot execute it.

### V2 — Action receipt graph

- **Mechanism:** Link source message, proposal edits, created records, operation IDs, and inverse actions.
- **Smallest proof:** Render one receipt in-thread.
- **Success measure:** A user can trace and undo the action without searching modules.
- **Kill criterion:** Keep compact source links if graph detail is unused.
- **Invariant:** Receipts are derived from committed results.

### V3 — Cross-parser correction rule

- **Mechanism:** Turn repeated edits such as date phrase, merchant, or person into scoped deterministic rules.
- **Smallest proof:** Collect 30 corrections and promote one rule behind fixtures.
- **Success measure:** The targeted correction class falls without new false positives.
- **Kill criterion:** Keep feature-local rules if semantics differ.
- **Invariant:** Rules are scoped and reversible; no history rewrite.

## Existing-roadmap boundary

Generic proposal grammar, action inbox, automation mining, and multi-turn flows already exist in prior work; this pack formalizes atomic compilation and receipts.

## Strategy guardrail

Start read-only or shadowed; use existing proposal and mutation owners; earn automation.

