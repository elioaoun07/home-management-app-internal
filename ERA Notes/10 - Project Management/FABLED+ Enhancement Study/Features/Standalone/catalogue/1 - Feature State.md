---
created: 2026-07-11
type: fabled-plus-feature-state
status: current
scope: feature
feature: Catalogue
module_type: Standalone
evidence_cutoff: 2026-07-11
baseline: FABLED 2 plus current working-tree delta
---

# Catalogue · Feature State

> [FABLED+ root](<../../../_index.md>) · **Catalogue** · [1 · Feature State](<1 - Feature State.md>) · [2 · Vision & Roadmap](<2 - Vision & Roadmap.md>) · [3 · Action Plan](<3 - Action Plan.md>) · [4 · Checklist](<4 - Checklist.md>)

## Current verdict

A broad reusable-template system with modules, categories, items, sub-items, product links, and calendar promotion, but reuse currently copies structure more reliably than it manages template evolution and instantiated drift.

## Verified footprint

- `ERA Notes/01 - Architecture/Feature Map/standalone/catalogue.md`
- `ERA Notes/02 - Standalone Modules/Catalogue/Overview.md`
- `src/features/catalogue/hooks.ts`
- `src/components/web/WebCatalogue.tsx`
- `src/components/web/CatalogueItemDialog.tsx`
- `src/app/api/catalogue/items/route.ts`
- `src/app/api/catalogue/modules/route.ts`

Checked against the 2026-07-11 working tree; source wins over docs.

## Outcome loop

| Stage | Current state |
|---|---|
| **Observe** | Reusable definitions, links, sub-items, and metadata are captured. |
| **Interpret** | Hierarchy and item type determine presentation and promotion. |
| **Propose** | Templates prefill future records. |
| **Commit** | CRUD and promotion create or update records. |
| **Verify** | No first-class check compares a template with existing instances. |
| **Learn** | Reuse frequency and post-instantiation edits do not improve the template. |

## Existing leverage

- Modules, categories, items, sub-items, links, and calendar/task creation make Catalogue a flexible reuse layer.
- Product comparison and document-image support extend it beyond simple task templates.
- Promotion paths reduce repeated structured entry.

## Feedback, friction, and risk

- A template update has no semantic version, migration intent, or affected-instance preview.
- Heavy editing after promotion is valuable feedback but disappears from Catalogue.
- Shared templates need ownership and compatibility rules when two users depend on them.

## Study conclusion

**Inference:** Treat Catalogue as the household's versioned operating manual: reusable objects that declare compatibility, learn from instances, and never surprise existing records.

## Re-verify

    git log --oneline --since="2026-07-02" -- "src/features/catalogue/hooks.ts" "src/components/web/WebCatalogue.tsx" "src/components/web/CatalogueItemDialog.tsx" "src/app/api/catalogue/items/route.ts"

Run focused tests and read mutating routes before implementation.

