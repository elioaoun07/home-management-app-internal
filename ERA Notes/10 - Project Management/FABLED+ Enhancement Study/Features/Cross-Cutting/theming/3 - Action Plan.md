---
created: 2026-07-11
type: fabled-plus-action-plan
status: current
scope: feature
feature: Theming
module_type: Cross-Cutting
evidence_cutoff: 2026-07-11
baseline: FABLED 2 plus current working-tree delta
---

# Theming · Action Plan

> [FABLED+ root](<../../../_index.md>) · **Theming** · [1 · Feature State](<1 - Feature State.md>) · [2 · Vision & Roadmap](<2 - Vision & Roadmap.md>) · [3 · Action Plan](<3 - Action Plan.md>) · [4 · Checklist](<4 - Checklist.md>)

## Objective

Prove one cross-cutting improvement without destabilizing every consumer.

## Now

- Inventory identity, surface, status, and accessibility tokens.
- Trace theme-triggered query invalidation consumers.
- Define functional overlay precedence.

**Gate N:** deterministic inventory or read-only proof.

## Next

- Prototype low-motion/high-contrast overlay.
- Write person-absolute identity tests across both viewers.
- Add a no-new-token-bypass ratchet.

**Gate X:** vertical slice across representative mobile/desktop, both viewers/themes, and degraded states.

## Later

- Narrow invalidation only with proof.
- Certify high-traffic components first.
- Avoid adding aesthetic themes until functional layers are coherent.

**Gate L:** measured outcome earns wider adoption; otherwise stop at the proven slice.

## Mandatory preflight

- Trace consumers and route classes.
- Run Design Doctrine Ten Questions.
- Test accessibility, identity, cache, offline, and privacy behavior.
- Ratchet rather than bulk-rewrite.

## Non-goals

Theme contrast certification, accessibility floor, and density modes are existing roadmap items; this pack separates functional layers and validates invalidation cost.

