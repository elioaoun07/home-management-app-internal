---
created: 2026-07-18
type: index
status: living
owner: Elio (authored by Claude Fable 5, handoff session)
generation: 3
trigger: model-generation-handoff
predecessor: ../FABLED 2/
tags:
  - pm/fabled3
  - scope/vault
  - vault/performance
---

# Performance · FABLED 3 — Index

> Third-generation audit of this **vault section** (docs, not product code), created 2026-07-18 as part of a **model-generation handoff**. Vault sections drift slowly, so this generation is deliberately thin: **delta/affirmation mode** — the [FABLED 2 pack](<../FABLED 2/_index.md>) remains normative except where the delta below says otherwise. Verified against `f0a8e19`.

| File | Read it when… |
|---|---|
| [3.1 Current Implementation](<1 - FABLED 3 — Current Implementation.md>) | the delta since 07-02 |
| [3.2 Gaps](<2 - FABLED 3 — Gaps & Missing.md>) · [3.3 Optimization](<3 - FABLED 3 — Optimization Plan.md>) · [3.4 Enhancements](<4 - FABLED 3 — Future Enhancements.md>) | carried from FABLED 2 (inheritance blocks inside) |
| [3.5 Successor Briefing](<5 - FABLED 3 — Successor Briefing.md>) | **you are a successor model about to edit this section — read this first** |

## Maturity scoreboard (2026-07-18)

| Dimension | Score | Δ vs 07-02 | Justification |
|---|---|---|---|
| **Overall** | **4.5** | = | Good instincts, no instruments — the app optimizes reactively and can't see regressions coming. *(carried — per-dimension detail in the [frozen v2 scoreboard](<../FABLED 2/_index.md>))* |
| **Handoff readiness** | **6** | new | Reading the RPC/bundle doctrine here is mandatory before touching hot paths; writing perf docs is any-model. |

## Delta ledger (FABLED 3 era, append-only)

- **2026-07-18** (generation created):
  - Zero commits in window — pure affirmation. The instruments gap persists; no perf budget, no tracking.

## The next moves

1. Carry v2's ask verbatim: one number (p75 page-load or bundle-RPC latency) tracked anywhere beats zero numbers everywhere.

**Master index:** [FABLED 3 Master Index](<../../00 - Home/FABLED 3 Master Index.md>)
