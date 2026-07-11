---
created: 2026-07-11
type: fabled-plus-vision-roadmap
status: current
scope: feature
feature: Inventory
module_type: Standalone
evidence_cutoff: 2026-07-11
baseline: FABLED 2 plus current working-tree delta
---

# Inventory · Vision & Roadmap

> [FABLED+ root](<../../../_index.md>) · **Inventory** · [1 · Feature State](<1 - Feature State.md>) · [2 · Vision & Roadmap](<2 - Vision & Roadmap.md>) · [3 · Action Plan](<3 - Action Plan.md>) · [4 · Checklist](<4 - Checklist.md>)

## Enhancement thesis

Make inventory honestly approximate: confidence, location, decay, and lightweight verification instead of pretending every count is a live database fact.

## Business and household value

Trustworthy approximate inventory prevents duplicate buys and missing essentials without demanding warehouse discipline. The differentiator is honesty about uncertainty.

Measure attention returned, conflict avoided, and outcomes improved—not engagement.

## Roadmap

1. Now — derive confidence/freshness from last verified and change history without schema changes.
2. Next — add zones and one-tap verify/unknown states for selected items.
3. Later — propose consumption cadence only where repeated confirmations support it.

## New opportunity set

### V1 — Stock confidence decay

- **Mechanism:** Reduce confidence over time based on item volatility and unobserved consumption, while leaving quantity intact.
- **Smallest proof:** Apply to ten fast/slow items for two weeks.
- **Success measure:** Low-confidence prompts find real inaccuracies with few false interruptions.
- **Kill criterion:** Use only last-verified labels if decay scoring feels arbitrary.
- **Invariant:** Confidence never changes quantity.

### V2 — Household zones

- **Mechanism:** Track coarse location and allow unknown/moved states without forcing precise bins.
- **Smallest proof:** Add pantry, freezer, bathroom, and car to twenty items.
- **Success measure:** Find-time and duplicate purchases improve.
- **Kill criterion:** Keep a free-text location if zones require maintenance.
- **Invariant:** Moving location is separate from consuming stock.

### V3 — Verification sweep

- **Mechanism:** Offer a 60-second rotating check of the few high-value, low-confidence items.
- **Smallest proof:** Run one weekly sweep for three weeks.
- **Success measure:** Corrections prevent at least one missed or duplicate purchase.
- **Kill criterion:** Stop if sweeps are skipped twice or feel like chores.
- **Invariant:** Unverified remains unknown, never assumed zero.

## Existing-roadmap boundary

Self-driving shopping, pantry-aware recipes, unit canonicalization, barcode/OCR, and waste tracking are prior ideas; this pack focuses on inventory truth.

## Strategy guardrail

Start read-only or in shadow mode; earn persistence, notification, and automation.

