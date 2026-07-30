---
created: 2026-07-11
type: fabled-plus-vision-roadmap
status: current
scope: feature
feature: Statement Import
module_type: Standalone
evidence_cutoff: 2026-07-11
baseline: FABLED 2 plus current working-tree delta
---

# Statement Import · Vision & Roadmap

> [FABLED+ root](<../../../_index.md>) · **Statement Import** · [1 · Feature State](<1 - Feature State.md>) · [2 · Vision & Roadmap](<2 - Vision & Roadmap.md>) · [3 · Action Plan](<3 - Action Plan.md>) · [4 · Checklist](<4 - Checklist.md>)

## Enhancement thesis

Make every import a rehearsed, provable batch: source fingerprint, confidence, exact diff, atomic receipt, and post-import reconciliation.

## Business and household value

Reliable ingestion converts external financial history into the app's moat. The business value is speed without trust loss: large batches become safer than manual entry rather than merely faster.

The target is attention returned, errors prevented, decisions shortened, or conflict avoided—not engagement.

## Roadmap

1. Now — finish and verify the merchant matcher, then add a read-only statement reconciliation summary.
2. Next — give every import a source profile and immutable batch receipt with retry semantics.
3. Later — use corrections to version parsers and detect format drift before it reaches money.

## New opportunity set

### V1 — Import rehearsal

- **Mechanism:** Show the exact would-create/would-skip/would-update diff, duplicate clusters, and balance deltas before commit.
- **Smallest proof:** Run it against two real statements with seeded duplicates.
- **Success measure:** The batch outcome is predictable to the row and cent before import.
- **Kill criterion:** Keep only summary totals if row-level diff is too noisy.
- **Invariant:** Rehearsal is read-only and uses the same deterministic rules as commit.

### V2 — Statement source fingerprint

- **Mechanism:** Identify institution/format/version from headers and structure, then pin the parser profile used.
- **Smallest proof:** Fingerprint three existing files and a deliberately modified format.
- **Success measure:** Format drift is detected before wrong rows reach review.
- **Kill criterion:** Use manual profile selection if automatic identification is unreliable.
- **Invariant:** Low confidence blocks auto-selection but never blocks manual review.

### V3 — Batch reconciliation receipt

- **Mechanism:** Assign an idempotent batch identity and reconcile statement totals, imported rows, skipped rows, and account deltas.
- **Smallest proof:** Generate a receipt for one import and replay the request.
- **Success measure:** Replay creates no duplicates and the receipt balances exactly.
- **Kill criterion:** Do not build one-click rollback until batch identity and invariants are proven.
- **Invariant:** Rollback, if later added, must invert only effects owned by that batch.

## Existing-roadmap boundary

Universal ingestion and merchant intelligence are prior ideas; this pack concentrates on statement-level proof, parser drift, and batch safety.

## Strategy guardrail

Start read-only or in shadow mode. Persist and notify only after real use passes the named gate; never create a parallel engine for an existing concept.

