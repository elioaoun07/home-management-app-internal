---
created: 2026-07-11
type: fabled-plus-vision-roadmap
status: current
scope: feature
feature: Sync & Offline
module_type: Junction
evidence_cutoff: 2026-07-11
baseline: FABLED 2 plus current working-tree delta
---

# Sync & Offline · Vision & Roadmap

> [FABLED+ root](<../../../_index.md>) · **Sync & Offline** · [1 · Feature State](<1 - Feature State.md>) · [2 · Vision & Roadmap](<2 - Vision & Roadmap.md>) · [3 · Action Plan](<3 - Action Plan.md>) · [4 · Checklist](<4 - Checklist.md>)

## Enhancement thesis

Make offline operation auditable and replayable: causal mutation journal, visible sync receipt, deterministic conflict policy, and chaos fixtures.

## Business and household value

Offline reliability is a market differentiator in real Lebanese connectivity. Honest receipts prevent duplicate work and make resilience visible rather than magical.

Measure attention returned, risk reduced, and outcomes improved—not engagement.

## Roadmap

1. Now — reconcile timeout truth and model operation states/causal dependencies.
2. Next — expose per-operation receipts and one conflict workbench.
3. Later — run repeatable chaos/replay suites across high-risk household flows.

## New opportunity set

### V1 — Causal mutation journal

- **Mechanism:** Assign operation identity, entity version, dependency, optimistic effect, inverse, and replay status.
- **Smallest proof:** Journal create→edit→delete on one item offline.
- **Success measure:** Replay produces the same final state exactly once.
- **Kill criterion:** Limit dependency tracking to multi-step flows if single mutations are safe.
- **Invariant:** Journal is transport truth, not a second domain database.

### V2 — Sync receipt

- **Mechanism:** Show accepted locally, queued, sent, confirmed, conflicted, or failed with operation detail.
- **Smallest proof:** Render receipts for transaction and shopping mutations.
- **Success measure:** Users never repeat an action because sync state is ambiguous.
- **Kill criterion:** Use a compact global indicator for low-risk flows.
- **Invariant:** Local acceptance is not labeled synced.

### V3 — Offline chaos replay

- **Mechanism:** Script disconnect, timeout, duplicate retry, reordering, partner edit, and recovery against fixtures.
- **Smallest proof:** Run the top five mutation flows.
- **Success measure:** Each has deterministic final state and preserved user input.
- **Kill criterion:** Prioritize money/schedule/junction flows if full coverage is costly.
- **Invariant:** Chaos tests never hit production data.

## Existing-roadmap boundary

Generic event spine and cross-module Undo are prior ideas; this pack is specifically transport causality, conflict, and replay proof.

## Strategy guardrail

Start read-only or shadowed; use existing proposal and mutation owners; earn automation.

