---
created: 2026-07-11
type: fabled-plus-checklist
status: current
scope: feature
feature: Sync & Offline
module_type: Junction
evidence_cutoff: 2026-07-11
baseline: FABLED 2 plus current working-tree delta
---

# Sync & Offline · Checklist

> [FABLED+ root](<../../../_index.md>) · **Sync & Offline** · [1 · Feature State](<1 - Feature State.md>) · [2 · Vision & Roadmap](<2 - Vision & Roadmap.md>) · [3 · Action Plan](<3 - Action Plan.md>) · [4 · Checklist](<4 - Checklist.md>)

> Promote chosen work into owning campaign checklists; this study is not a second authority.

## Now

- [ ] **N1** — Reconcile 3/5/8-second timeout documentation and code ownership.
- [ ] **N2** — Define operation and causal dependency fields.
- [ ] **N3** — Choose top five offline mutation flows.

## Next

- [ ] **X1** — Journal and receipt one high-risk flow.
- [ ] **X2** — Build conflict fixture preserving both versions.
- [ ] **X3** — Add chaos replay for retry/reorder.

## Later

- [ ] **L1** — Expand only to flows with real failures.
- [ ] **L2** — Measure duplicate actions and ambiguous pending states.
- [ ] **L3** — Retire legacy queue only through verified migration.

## 10× bet validation

- [ ] **BET-1 · Causal mutation journal** — Journal create→edit→delete on one item offline. **Pass:** Replay produces the same final state exactly once. **Kill:** Limit dependency tracking to multi-step flows if single mutations are safe.
- [ ] **BET-2 · Sync receipt** — Render receipts for transaction and shopping mutations. **Pass:** Users never repeat an action because sync state is ambiguous. **Kill:** Use a compact global indicator for low-risk flows.
- [ ] **BET-3 · Offline chaos replay** — Run the top five mutation flows. **Pass:** Each has deterministic final state and preserved user input. **Kill:** Prioritize money/schedule/junction flows if full coverage is costly.

## Definition of done

- [ ] Connected implementations re-verified.
- [ ] Smallest proof passed before expansion.
- [ ] Truth, time, partner, offline, cache, retry, privacy, and Undo are explicit.
- [ ] Contract/integration tests protect the bridge.
- [ ] A real outcome justifies keeping it.
- [ ] Normal PM files hold execution status.

