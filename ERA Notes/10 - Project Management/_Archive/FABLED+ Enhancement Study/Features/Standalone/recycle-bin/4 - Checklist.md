---
created: 2026-07-11
type: fabled-plus-checklist
status: current
scope: feature
feature: Recycle Bin
module_type: Standalone
evidence_cutoff: 2026-07-11
baseline: FABLED 2 plus current working-tree delta
---

# Recycle Bin · Checklist

> [FABLED+ root](<../../../_index.md>) · **Recycle Bin** · [1 · Feature State](<1 - Feature State.md>) · [2 · Vision & Roadmap](<2 - Vision & Roadmap.md>) · [3 · Action Plan](<3 - Action Plan.md>) · [4 · Checklist](<4 - Checklist.md>)

> Promote chosen work into the owning campaign checklist; this study is not a second authority.

## Now

- [ ] **N1** — Map delete/restore/purge ownership by entity.
- [ ] **N2** — Build restore-impact fixtures for recurring and synced items.
- [ ] **N3** — Inventory current retention and external side effects.

## Next

- [ ] **X1** — Render preview only when effects exist.
- [ ] **X2** — Add retention policy documentation and one high-risk class.
- [ ] **X3** — Record deletion reason without adding mandatory fields.

## Later

- [ ] **L1** — Measure restores and surprise effects.
- [ ] **L2** — Tune flows that cause avoidable deletion.
- [ ] **L3** — Emit final purge receipts for material data only.

## 10× bet validation

- [ ] **BET-1 · Restore impact preview** — Generate preview for recurring and Calendar-linked items. **Pass:** Restored state exactly matches preview with no surprise notification. **Kill:** Use warnings only for complex items if simple rows need none.
- [ ] **BET-2 · Retention classes** — Classify current deletable entity types without changing purge. **Pass:** Every type has a justified retention and owner. **Kill:** Keep one window if distinctions cannot be enforced reliably.
- [ ] **BET-3 · Deletion outcome learning** — Collect reasons for 30 deletions implicitly where possible. **Pass:** One avoidable deletion class is reduced. **Kill:** Remove prompts if they add friction and yield no pattern.

## Definition of done

- [ ] Current implementation re-verified.
- [ ] Smallest proof passed before expansion.
- [ ] Truth, time, partner, offline, cache, retry, privacy, and Undo are explicit.
- [ ] Focused tests protect the invariant.
- [ ] A real outcome justifies keeping it.
- [ ] Normal PM files hold execution status.

