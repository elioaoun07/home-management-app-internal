---
created: 2026-07-11
type: fabled-plus-checklist
status: current
scope: feature
feature: Transfers
module_type: Standalone
evidence_cutoff: 2026-07-11
baseline: FABLED 2 plus current working-tree delta
---

# Transfers · Checklist

> [FABLED+ root](<../../../_index.md>) · **Transfers** · [1 · Feature State](<1 - Feature State.md>) · [2 · Vision & Roadmap](<2 - Vision & Roadmap.md>) · [3 · Action Plan](<3 - Action Plan.md>) · [4 · Checklist](<4 - Checklist.md>)

> This is a study queue, not a second PM authority. Promote selected work into the owning campaign checklist before implementation.

## Now

- [ ] **N1** — Write the pure paired-receipt calculation with worked before/after fixtures.
- [ ] **N2** — Verify idempotency behavior for retry and offline replay.
- [ ] **N3** — Inventory which transfer contexts can supply purpose automatically.

## Next

- [ ] **X1** — Render the compact receipt after create and Undo.
- [ ] **X2** — Prototype safety preview against one account corridor.
- [ ] **X3** — Test public/private account combinations from both viewers.

## Later

- [ ] **L1** — Add optional review/reversal reminder proposals.
- [ ] **L2** — Measure receipt opens, Undo, and reconciliation questions.
- [ ] **L3** — Promote purpose fields only if they remain useful after 30 days.

## 10× bet validation

- [ ] **BET-1 · Paired transfer receipt** — Run: Generate receipts from existing API fixtures. **Pass:** Every transfer reconciles to both account histories with zero manual arithmetic. **Kill:** Keep a compact receipt if the expanded view is never opened.
- [ ] **BET-2 · Intent-preserving transfer** — Run: Offer three purposes on NFC wallet refill and savings transfer. **Pass:** A month later, users can identify why at least 90% of transfers occurred. **Kill:** Drop structured purposes if free-text/none dominates.
- [ ] **BET-3 · Liquidity safety preview** — Run: Run shadow previews on the last 20 transfers. **Pass:** The preview would have prevented or clarified at least one risky move. **Kill:** Do not surface it if all previews are consistently neutral.

## Definition of done

- [ ] The implementation claim is re-verified against current code.
- [ ] The smallest proof passes its binary gate before schema or platform expansion.
- [ ] Partner, offline, time, cache, idempotency, and Undo behavior are explicit.
- [ ] A focused test protects the new invariant or decision rule.
- [ ] The feature's normal PM files are updated; this study is not used as a duplicate execution queue.
- [ ] A measured outcome justifies keeping the capability after its trial window.

