---
created: 2026-07-11
type: fabled-plus-vision-roadmap
status: current
scope: feature
feature: Prerequisites
module_type: Junction
evidence_cutoff: 2026-07-11
baseline: FABLED 2 plus current working-tree delta
---

# Prerequisites · Vision & Roadmap

> [FABLED+ root](<../../../_index.md>) · **Prerequisites** · [1 · Feature State](<1 - Feature State.md>) · [2 · Vision & Roadmap](<2 - Vision & Roadmap.md>) · [3 · Action Plan](<3 - Action Plan.md>) · [4 · Checklist](<4 - Checklist.md>)

## Enhancement thesis

Make prerequisites an explainable evidence graph: acyclic, versioned, alternative-aware, confidence-labeled, and safe under concurrent triggers.

## Business and household value

Reliable conditional automation differentiates the physical household OS. Formal graph safety prevents invisible deadlocks and trust-destroying surprise activation.

Measure attention returned, risk reduced, and outcomes improved—not engagement.

## Roadmap

1. Now — build graph validation and evaluator fixtures for cycles/races.
2. Next — expose Why blocked and alternate evidence paths.
3. Later — calibrate evidence expiry from real false/late activations.

## New opportunity set

### V1 — Dependency proof

- **Mechanism:** Validate acyclicity, reachability, depth, and activation idempotency before saving a graph.
- **Smallest proof:** Run validator against current prerequisites and seeded cycles.
- **Success measure:** Every dormant item has a finite explainable path or explicit impossible state.
- **Kill criterion:** Keep validation to cycle/depth if richer proof has no cases.
- **Invariant:** Invalid graph cannot activate items.

### V2 — Alternative evidence paths

- **Mechanism:** Allow explicit AND/OR groups with a human-readable reason and preview.
- **Smallest proof:** Model one prerequisite satisfiable by NFC or manual verified checklist.
- **Success measure:** The real workflow no longer needs a bypass edit.
- **Kill criterion:** Keep one path if alternatives confuse users.
- **Invariant:** Logical semantics are deterministic and tested.

### V3 — Evidence trust ladder

- **Mechanism:** Label evidence source, confidence, actor, observed time, and expiry.
- **Smallest proof:** Compare NFC tap, checklist acknowledgement, and external event.
- **Success measure:** A stale/weak proof cannot cause a surprise activation.
- **Kill criterion:** Use source+time only if confidence levels are arbitrary.
- **Invariant:** Unknown evidence never equals satisfied.

## Existing-roadmap boundary

Time-window and arrive-home triggers are existing roadmap items; this pack formalizes graph and evidence safety.

## Strategy guardrail

Start read-only or shadowed; use existing proposal and mutation owners; earn automation.

