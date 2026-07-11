---
created: 2026-07-11
type: fabled-plus-checklist
status: current
scope: feature
feature: Categories
module_type: Standalone
evidence_cutoff: 2026-07-11
baseline: FABLED 2 plus current working-tree delta
---

# Categories · Checklist

> [FABLED+ root](<../../../_index.md>) · **Categories** · [1 · Feature State](<1 - Feature State.md>) · [2 · Vision & Roadmap](<2 - Vision & Roadmap.md>) · [3 · Action Plan](<3 - Action Plan.md>) · [4 · Checklist](<4 - Checklist.md>)

> This is a study queue, not a second PM authority. Promote selected work into the owning campaign checklist before implementation.

## Now

- [ ] **N1** — Write a pure taxonomy-health analyzer and fixtures.
- [ ] **N2** — Measure unused, deep, overlapping, and frequently corrected nodes.
- [ ] **N3** — Verify cross-user slug behavior against current API semantics.

## Next

- [ ] **X1** — Prototype optional intent tags in memory or front-end config.
- [ ] **X2** — Test a seasonal ordering overlay without schema changes.
- [ ] **X3** — Add merge preview with exact affected transaction counts.

## Later

- [ ] **L1** — Persist only metadata proven useful.
- [ ] **L2** — Schedule a quarterly taxonomy review, not continuous nudges.
- [ ] **L3** — Expose category health to statement import and ERA as advisory context.

## 10× bet validation

- [ ] **BET-1 · Taxonomy health score** — Run: Generate the score for both users and inspect the five worst nodes. **Pass:** At least one simplification reduces capture hesitation or corrections. **Kill:** Keep only raw diagnostics if a composite score obscures more than it explains.
- [ ] **BET-2 · Intent tags over display labels** — Run: Tag ten categories locally and test analytics questions. **Pass:** One cross-category decision becomes simpler without adding capture steps. **Kill:** Drop tags if they duplicate budget groups or require constant maintenance.
- [ ] **BET-3 · Seasonal taxonomy overlay** — Run: Use a local overlay for one event and compare category-selection time. **Pass:** Median selection time improves with no increase in miscategorizations. **Kill:** Remove if users rely on search/recent choices instead.

## Definition of done

- [ ] The implementation claim is re-verified against current code.
- [ ] The smallest proof passes its binary gate before schema or platform expansion.
- [ ] Partner, offline, time, cache, idempotency, and Undo behavior are explicit.
- [ ] A focused test protects the new invariant or decision rule.
- [ ] The feature's normal PM files are updated; this study is not used as a duplicate execution queue.
- [ ] A measured outcome justifies keeping the capability after its trial window.

