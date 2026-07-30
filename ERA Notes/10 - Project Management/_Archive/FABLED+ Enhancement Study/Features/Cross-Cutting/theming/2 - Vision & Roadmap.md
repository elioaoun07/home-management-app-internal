---
created: 2026-07-11
type: fabled-plus-vision-roadmap
status: current
scope: feature
feature: Theming
module_type: Cross-Cutting
evidence_cutoff: 2026-07-11
baseline: FABLED 2 plus current working-tree delta
---

# Theming · Vision & Roadmap

> [FABLED+ root](<../../../_index.md>) · **Theming** · [1 · Feature State](<1 - Feature State.md>) · [2 · Vision & Roadmap](<2 - Vision & Roadmap.md>) · [3 · Action Plan](<3 - Action Plan.md>) · [4 · Checklist](<4 - Checklist.md>)

## Enhancement thesis

Separate identity from function: person color remains absolute, while accessibility, motion, contrast, and environment become composable semantic layers.

## Business and household value

Composable functional themes improve accessibility and comfort without multiplying full themes. Cleaner semantic tokens reduce regressions and maintenance cost.

Measure attention returned, risk reduced, accessibility, and outcomes—not engagement.

## Roadmap

1. Now — inventory semantic tokens, raw colors, query consumers, and accessibility modes.
2. Next — add one functional layer and prove whether all-query invalidation remains necessary.
3. Later — certify tokens/components continuously and remove bypasses incrementally.

## New opportunity set

### V1 — Functional theme layer

- **Mechanism:** Compose identity theme with high-contrast, low-motion, night, or public-display modes.
- **Smallest proof:** Add low-motion/high-contrast as a non-persisted overlay.
- **Success measure:** Accessibility improves without changing person identity or data.
- **Kill criterion:** Keep browser/system preferences if overlays duplicate them.
- **Invariant:** Person-absolute colors remain absolute.

### V2 — Invalidation proof

- **Mechanism:** Trace why theme changes invalidate queries and separate data whose presentation truly depends on identity.
- **Smallest proof:** Instrument a theme switch and list changed query outputs.
- **Success measure:** Either the global invalidation is proven necessary or safely narrowed with tests.
- **Kill criterion:** Keep global invalidation if any household identity data can stale.
- **Invariant:** Performance never beats person-correct attribution.

### V3 — Semantic token ratchet

- **Mechanism:** Detect new raw identity/background colors outside approved tokens and gradually ratchet violations down.
- **Smallest proof:** Scan five high-churn components and fix only touched lines.
- **Success measure:** No new bypasses while existing count declines.
- **Kill criterion:** Use review checklist if automated detection is too noisy.
- **Invariant:** Do not edit protected UI primitives to satisfy the ratchet.

## Existing-roadmap boundary

Theme contrast certification, accessibility floor, and density modes are existing roadmap items; this pack separates functional layers and validates invalidation cost.

## Strategy guardrail

Preserve identity and trusted shell behavior; start read-only; earn broad enforcement.

