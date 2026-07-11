---
created: 2026-07-11
type: fabled-plus-vision-roadmap
status: current
scope: feature
feature: Household Sharing
module_type: Junction
evidence_cutoff: 2026-07-11
baseline: FABLED 2 plus current working-tree delta
---

# Household Sharing · Vision & Roadmap

> [FABLED+ root](<../../../_index.md>) · **Household Sharing** · [1 · Feature State](<1 - Feature State.md>) · [2 · Vision & Roadmap](<2 - Vision & Roadmap.md>) · [3 · Action Plan](<3 - Action Plan.md>) · [4 · Checklist](<4 - Checklist.md>)

## Enhancement thesis

Advance from shared rows to household governance: explicit proposal, consent, conflict, delegation, expiry, and receipt—scoped to decisions that truly need them.

## Business and household value

The partner is half the product. Governance semantics reduce invisible power asymmetry and make the system genuinely ours rather than mine-with-access.

Measure attention returned, risk reduced, and outcomes improved—not engagement.

## Roadmap

1. Now — create a cross-module sharing contract matrix and conflict fixtures.
2. Next — add consent/objection to one material joint decision using drafts.
3. Later — introduce expiring stewardship only where repeated coordination proves value.

## New opportunity set

### V1 — Household decision protocol

- **Mechanism:** Represent owner, affected people, proposer, required consent, objection, expiry, and final receipt.
- **Smallest proof:** Use one budget or purchase decision.
- **Success measure:** The decision completes without ambiguous off-app consent.
- **Kill criterion:** Limit protocol to configured high-impact actions.
- **Invariant:** Visibility/read receipt is never consent.

### V2 — Conflict workbench

- **Mechanism:** When concurrent/offline edits conflict, show base, mine, theirs, consequences, and deterministic merge choices.
- **Smallest proof:** Create fixtures for note, item, and preference conflicts.
- **Success measure:** No silent last-write loss in the tested entities.
- **Kill criterion:** Use server-wins for explicitly low-value fields only.
- **Invariant:** Conflict resolution preserves both original versions.

### V3 — Stewardship lease

- **Mechanism:** Delegate a bounded domain/action set to one person for a period without transferring ownership.
- **Smallest proof:** Delegate shopping or trip preparation for one week.
- **Success measure:** Coordination decreases and permissions expire correctly.
- **Kill criterion:** Keep ordinary assignment if leases add confusion.
- **Invariant:** Lease cannot broaden underlying visibility or survive revocation.

## Existing-roadmap boundary

Generic privacy tiers and partner adoption campaigns are existing ideas; this pack defines decision and conflict governance.

## Strategy guardrail

Start read-only or shadowed; use existing proposal and mutation owners; earn automation.

