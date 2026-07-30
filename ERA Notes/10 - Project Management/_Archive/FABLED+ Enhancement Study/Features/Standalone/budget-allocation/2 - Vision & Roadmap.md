---
created: 2026-07-11
type: fabled-plus-vision-roadmap
status: current
scope: feature
feature: Budget Allocation
module_type: Standalone
evidence_cutoff: 2026-07-11
baseline: FABLED 2 plus current working-tree delta
---

# Budget Allocation · Vision & Roadmap

> [FABLED+ root](<../../../_index.md>) · **Budget Allocation** · [1 · Feature State](<1 - Feature State.md>) · [2 · Vision & Roadmap](<2 - Vision & Roadmap.md>) · [3 · Action Plan](<3 - Action Plan.md>) · [4 · Checklist](<4 - Checklist.md>)

## Enhancement thesis

Shift from fixed envelopes to household guardrails: ranges tied to intent, agreed by the people affected, and reviewed by outcome.

## Business and household value

A budget earns retention when it reduces negotiation and surprise, not when it produces perfect-looking percentages. Guardrails make the system useful in volatile dual-currency reality while preserving human control.

The target is attention returned, errors prevented, decisions shortened, or conflict avoided—not engagement.

## Roadmap

1. Now — derive read-only allocation ranges and proposal provenance from existing inputs.
2. Next — add an intent and review outcome to one allocation without altering spend math.
3. Later — calibrate future ranges from accepted targets, overrides, and actual outcomes.

## New opportunity set

### V1 — Allocation confidence bands

- **Mechanism:** Present a safe range plus the evidence and volatility behind it instead of one authoritative amount.
- **Smallest proof:** Calculate bands for five categories across six periods.
- **Success measure:** Users change fewer targets after saving while still understanding the recommendation.
- **Kill criterion:** Retain single targets if bands create ambiguity without reducing edits.
- **Invariant:** Bands never redefine canonical spend.

### V2 — Intent-backed allocation

- **Mechanism:** Attach a short intended outcome—protect buffer, enjoy dining, prepare trip—to a category plan.
- **Smallest proof:** Add intent locally to three categories and review at month end.
- **Success measure:** The review can say whether each intent was served, not only whether money was under target.
- **Kill criterion:** Remove structured intents if they are not reviewed.
- **Invariant:** Intent is explanatory metadata, not a permission to block spending.

### V3 — Shared budget handshake

- **Mechanism:** Let a material joint allocation carry proposed, acknowledged, objected, or expired states using the existing draft pattern.
- **Smallest proof:** Prototype one shared discretionary category.
- **Success measure:** A budget change no longer requires an off-app clarification.
- **Kill criterion:** Use single-owner configuration if both users do not participate.
- **Invariant:** Silence never equals consent and no AI proposal commits money.

## Existing-roadmap boundary

Envelope funding, recurring-driven suggestions, cashflow forecast, and Sunday money review are existing roadmap ideas; this pack adds uncertainty, intent, and negotiation semantics.

## Strategy guardrail

Start read-only or in shadow mode. Persist and notify only after real use passes the named gate; never create a parallel engine for an existing concept.

