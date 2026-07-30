---
created: 2026-07-11
type: fabled-plus-feature-state
status: current
scope: feature
feature: Prerequisites
module_type: Junction
evidence_cutoff: 2026-07-11
baseline: FABLED 2 plus current working-tree delta
---

# Prerequisites · Feature State

> [FABLED+ root](<../../../_index.md>) · **Prerequisites** · [1 · Feature State](<1 - Feature State.md>) · [2 · Vision & Roadmap](<2 - Vision & Roadmap.md>) · [3 · Action Plan](<3 - Action Plan.md>) · [4 · Checklist](<4 - Checklist.md>)

## Current verdict

A genuinely novel bridge between NFC and item activation, backed by dedicated tables and state transitions, but dependency correctness—cycles, alternative paths, evidence quality, and concurrent triggers—needs a formal graph contract.

## Verified footprint

- `ERA Notes/01 - Architecture/Feature Map/junction/prerequisites.md`
- `ERA Notes/03 - Junction Modules/Prerequisites/Overview.md`
- `src/app/api/prerequisites`
- `src/lib/prerequisiteEvaluator.ts`
- `src/app/api/nfc`
- `migrations/schema.sql`
- `src/features/items/useItems.ts`

Checked against the 2026-07-11 working tree; source wins over docs.

## Outcome loop

| Stage | Current state |
|---|---|
| **Observe** | Prerequisite definitions, NFC state, checklist evidence, and item state are captured. |
| **Interpret** | Evaluator determines whether conditions pass. |
| **Propose** | Activation can be surfaced. |
| **Commit** | Items transition when prerequisites resolve. |
| **Verify** | Graph cycles, evidence trust, and repeated trigger races are under-specified. |
| **Learn** | False/late activations do not calibrate prerequisite design. |

## Existing leverage

- Dormant→pending activation encodes a real state machine.
- NFC creates a physical evidence source rather than only time triggers.
- Dedicated prerequisite and state-log tables support auditability.

## Feedback, friction, and risk

- Dependency cycles or deep chains can create permanently dormant work without an intelligible reason.
- One prerequisite may have several acceptable evidence paths, but current representation can force one brittle path.
- Physical and digital evidence differ in confidence and expiry; boolean satisfied hides that.

## Study conclusion

**Inference:** Make prerequisites an explainable evidence graph: acyclic, versioned, alternative-aware, confidence-labeled, and safe under concurrent triggers.

## Re-verify

    git log --oneline --since="2026-07-02" -- "src/app/api/prerequisites" "src/lib/prerequisiteEvaluator.ts" "src/app/api/nfc" "migrations/schema.sql"

Trace every connected standalone before implementation.

