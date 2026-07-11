---
created: 2026-07-11
type: fabled-plus-vision-roadmap
status: current
scope: feature
feature: Recycle Bin
module_type: Standalone
evidence_cutoff: 2026-07-11
baseline: FABLED 2 plus current working-tree delta
---

# Recycle Bin · Vision & Roadmap

> [FABLED+ root](<../../../_index.md>) · **Recycle Bin** · [1 · Feature State](<1 - Feature State.md>) · [2 · Vision & Roadmap](<2 - Vision & Roadmap.md>) · [3 · Action Plan](<3 - Action Plan.md>) · [4 · Checklist](<4 - Checklist.md>)

## Enhancement thesis

Make deletion a reversible lifecycle contract: dependency-aware preview, purpose-aware retention, explicit external effects, and a final purge receipt.

## Business and household value

Reversibility protects trust; disciplined retention protects privacy and storage. A clear lifecycle reduces fear of acting and prevents zombie restorations.

Measure attention returned, risk reduced, or outcomes improved—not engagement.

## Roadmap

1. Now — derive restore impact for one item bundle read-only.
2. Next — add deletion reason and retention class to selected high-risk types.
3. Later — tune retention from policy and restore evidence, not arbitrary uniformity.

## New opportunity set

### V1 — Restore impact preview

- **Mechanism:** Show child records, recurrence, alerts, prerequisites, and external sync effects before restore.
- **Smallest proof:** Generate preview for recurring and Calendar-linked items.
- **Success measure:** Restored state exactly matches preview with no surprise notification.
- **Kill criterion:** Use warnings only for complex items if simple rows need none.
- **Invariant:** Preview is read-only and restore is idempotent.

### V2 — Retention classes

- **Mechanism:** Define short, standard, long, or legal/evidence retention by data purpose and privacy.
- **Smallest proof:** Classify current deletable entity types without changing purge.
- **Success measure:** Every type has a justified retention and owner.
- **Kill criterion:** Keep one window if distinctions cannot be enforced reliably.
- **Invariant:** Long retention never broadens visibility.

### V3 — Deletion outcome learning

- **Mechanism:** Capture lightweight reason and whether restore occurred, then improve duplicate/correction flows.
- **Smallest proof:** Collect reasons for 30 deletions implicitly where possible.
- **Success measure:** One avoidable deletion class is reduced.
- **Kill criterion:** Remove prompts if they add friction and yield no pattern.
- **Invariant:** Reasons are private metadata and never blame users.

## Existing-roadmap boundary

Generic cross-module Undo and event logging are existing ideas; this pack focuses on lifecycle, dependencies, and retention.

## Strategy guardrail

Start read-only or in shadow mode; earn persistence, notifications, and automation.

