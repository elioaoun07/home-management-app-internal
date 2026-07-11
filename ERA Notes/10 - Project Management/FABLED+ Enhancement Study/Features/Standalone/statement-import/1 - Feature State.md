---
created: 2026-07-11
type: fabled-plus-feature-state
status: current
scope: feature
feature: Statement Import
module_type: Standalone
evidence_cutoff: 2026-07-11
baseline: FABLED 2 plus current working-tree delta
---

# Statement Import · Feature State

> [FABLED+ root](<../../../_index.md>) · **Statement Import** · [1 · Feature State](<1 - Feature State.md>) · [2 · Vision & Roadmap](<2 - Vision & Roadmap.md>) · [3 · Action Plan](<3 - Action Plan.md>) · [4 · Checklist](<4 - Checklist.md>)

## Current verdict

A high-leverage ingestion and review tool whose current working-tree merchant-mapping refactor improves deterministic reuse, while import confidence, completeness, and rollback remain less explicit than the money risk deserves.

## Verified footprint

- `ERA Notes/01 - Architecture/Feature Map/standalone/statement-import.md`
- `ERA Notes/02 - Standalone Modules/Statement Import/Overview.md`
- `src/features/statement-import/hooks.ts`
- `src/hooks/useMerchantMappings.ts`
- `src/lib/merchantMatch.ts`
- `src/lib/merchantMatch.test.ts`
- `src/app/api/statement-import/import/route.ts`
- `src/app/api/merchant-mappings/route.ts`

Checked against the 2026-07-11 working tree; current source wins over documentation.

## Outcome loop

| Stage | Current state |
|---|---|
| **Observe** | CSV/PDF rows, merchants, amounts, dates, and mappings are ingested. |
| **Interpret** | Parser, matcher, categories, and duplicate logic create proposed transactions. |
| **Propose** | A review surface exists before import. |
| **Commit** | Bulk import writes transactions and balance effects. |
| **Verify** | Row validation exists, but statement-level completeness and reversible batch receipt are weak. |
| **Learn** | Merchant mappings learn deterministic corrections; parser-format and review corrections are not yet a full loop. |

## Existing leverage

- Parse and import are separate phases, enabling human review before money mutation.
- Bulk import uses safeFetch with an explicit 60-second timeout and invalidates account data.
- The in-progress shared merchant matcher is pure, tested, and reusable without illegal standalone-to-standalone imports.

## Feedback, friction, and risk

- Row confidence is not enough: the system must prove statement coverage, totals, date range, duplicates, and skipped rows as one batch.
- Bank format drift can silently degrade parsing because source profile/version is not a durable concept.
- A bulk mutation needs one batch identity, exact effects, and rollback/recovery receipt, especially across retries.

## Study conclusion

**Inference:** Make every import a rehearsed, provable batch: source fingerprint, confidence, exact diff, atomic receipt, and post-import reconciliation.

## Re-verify

    git log --oneline --since="2026-07-02" -- "src/features/statement-import/hooks.ts" "src/hooks/useMerchantMappings.ts" "src/lib/merchantMatch.ts" "src/lib/merchantMatch.test.ts"

Re-read every mutating route and run focused tests before implementation.

