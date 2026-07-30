---
created: 2026-07-11
type: fabled-plus-index
status: current
scope: feature
feature: Statement Import
module_type: Standalone
evidence_cutoff: 2026-07-11
baseline: FABLED 2 plus current working-tree delta
---

# Statement Import · FABLED+ Index

> [FABLED+ root](<../../../_index.md>) · **Statement Import** · [1 · Feature State](<1 - Feature State.md>) · [2 · Vision & Roadmap](<2 - Vision & Roadmap.md>) · [3 · Action Plan](<3 - Action Plan.md>) · [4 · Checklist](<4 - Checklist.md>)

> **Verdict:** A high-leverage ingestion and review tool whose current working-tree merchant-mapping refactor improves deterministic reuse, while import confidence, completeness, and rollback remain less explicit than the money risk deserves.

## Loop-readiness score

| Dimension | Score |
|---|---:|
| **Truth** | 3/5 |
| **Capture** | 3/5 |
| **Decision** | 4/5 |
| **Action safety** | 4/5 |
| **Learning** | 2/5 |
| **Partnership** | 1/5 |
| **Total** | **17/30** |

Loop readiness is not FABLED maturity. It measures whether facts become safe decisions, verified outcomes, and learning.

## Pack

1. [Feature State](<1 - Feature State.md>)
2. [Vision & Roadmap](<2 - Vision & Roadmap.md>)
3. [Action Plan](<3 - Action Plan.md>)
4. [Checklist](<4 - Checklist.md>)

## Evidence anchors

- `ERA Notes/01 - Architecture/Feature Map/standalone/statement-import.md`
- `ERA Notes/02 - Standalone Modules/Statement Import/Overview.md`
- `src/features/statement-import/hooks.ts`
- `src/hooks/useMerchantMappings.ts`
- `src/lib/merchantMatch.ts`
- `src/lib/merchantMatch.test.ts`
- `src/app/api/statement-import/import/route.ts`
- `src/app/api/merchant-mappings/route.ts`

## Non-duplication boundary

Universal ingestion and merchant intelligence are prior ideas; this pack concentrates on statement-level proof, parser drift, and batch safety.

