---
created: 2026-07-11
type: fabled-plus-checklist
status: current
scope: feature
feature: Theming
module_type: Cross-Cutting
evidence_cutoff: 2026-07-11
baseline: FABLED 2 plus current working-tree delta
---

# Theming · Checklist

> [FABLED+ root](<../../../_index.md>) · **Theming** · [1 · Feature State](<1 - Feature State.md>) · [2 · Vision & Roadmap](<2 - Vision & Roadmap.md>) · [3 · Action Plan](<3 - Action Plan.md>) · [4 · Checklist](<4 - Checklist.md>)

> Promote chosen work into owning PM checklists; this study is not a second authority.

## Now

- [ ] **N1** — Inventory identity, surface, status, and accessibility tokens.
- [ ] **N2** — Trace theme-triggered query invalidation consumers.
- [ ] **N3** — Define functional overlay precedence.

## Next

- [ ] **X1** — Prototype low-motion/high-contrast overlay.
- [ ] **X2** — Write person-absolute identity tests across both viewers.
- [ ] **X3** — Add a no-new-token-bypass ratchet.

## Later

- [ ] **L1** — Narrow invalidation only with proof.
- [ ] **L2** — Certify high-traffic components first.
- [ ] **L3** — Avoid adding aesthetic themes until functional layers are coherent.

## 10× bet validation

- [ ] **BET-1 · Functional theme layer** — Add low-motion/high-contrast as a non-persisted overlay. **Pass:** Accessibility improves without changing person identity or data. **Kill:** Keep browser/system preferences if overlays duplicate them.
- [ ] **BET-2 · Invalidation proof** — Instrument a theme switch and list changed query outputs. **Pass:** Either the global invalidation is proven necessary or safely narrowed with tests. **Kill:** Keep global invalidation if any household identity data can stale.
- [ ] **BET-3 · Semantic token ratchet** — Scan five high-churn components and fix only touched lines. **Pass:** No new bypasses while existing count declines. **Kill:** Use review checklist if automated detection is too noisy.

## Definition of done

- [ ] Current consumers re-verified.
- [ ] Smallest proof passed before broad rollout.
- [ ] Identity, accessibility, partner, offline, cache, privacy, and rollback are explicit.
- [ ] Contract/fitness tests protect the rule.
- [ ] A real outcome justifies keeping it.
- [ ] Normal PM files hold execution status.

