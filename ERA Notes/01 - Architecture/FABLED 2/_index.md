---
created: 2026-07-02
type: index
status: baseline-frozen
superseded: 2026-07-18
owner: Elio
tags:
  - pm/fabled2
  - scope/architecture
---

# Architecture · FABLED 2 — Index

> ⚠️ **Frozen v2 baseline (2026-07-02)** — superseded 2026-07-18 by [`FABLED 3/`](<../FABLED 3/_index.md>) (model-generation handoff). Do not update; new history goes to the FABLED 3 delta ledger.


> The deep-dive audit of the app's **architecture itself** — the patterns, boundaries, and invariants this directory documents. First FABLED at this scope, built to the second-generation standard (verified against the working tree **2026-07-02**). The directory's docs (Common Patterns, Sync & Offline, Cache Invalidation, Timezone Handling, Color Identity, Feature Map) remain the rulebooks; this folder judges how the *architecture is holding* under the rules.

| # | File | Read it when… |
|---|---|---|
| 1 | [Current Implementation](<1 - FABLED 2 — Current Implementation.md>) | You want the architecture's actual state: what's enforced, what's conventional, what's drifting. |
| 2 | [Gaps & Missing](<2 - FABLED 2 — Gaps & Missing.md>) | You want the structural holes — the places convention is carrying loads that need mechanism. |
| 3 | [Optimization Plan](<3 - FABLED 2 — Optimization Plan.md>) | You're about to do cross-cutting work and want the hardening order. |
| 4 | [Future Enhancements](<4 - FABLED 2 — Future Enhancements.md>) | You want the architectural bets that make the next year cheaper. |

## Maturity scoreboard (2026-07-02)

| Dimension | Score | One-line justification |
|---|---|---|
| **Module boundaries** | 8 | Standalone/Junction model + no-cross-import rule + Feature Map routing — coherent and mostly respected. |
| **Data-access patterns** | 7 | Supabase client separation, canonical route pattern, RPC bundling (Hard Rules 20/21), query-key discipline. |
| **Mechanical enforcement** | 5 | Real hooks (ui-dir block, migration check, PM check, atlas sync) — but the biggest rules (no-console, safeFetch-only, invalidation completeness) rely on convention and are violated at scale (594 console; 240 raw fetch). |
| **Single-source-of-truth health** | 4 | Three schedule expansion engines; spend definition only just unified; two↔three AI conversation stores; account-creation logic duplicated. |
| **Repo ↔ live-DB fidelity** | 5 | `schema.sql` now carries policies + `get_schedule_bundle`; Trips RPCs still live-only. |
| **Overall** | **5.8** | A genuinely well-designed architecture whose weakest point is that its best rules are still enforced by memory. |

## The next 3 moves

1. **Convert the two highest-cost conventions into mechanisms** — `no-console` lint + a `fetch(` ratchet ([file 3 · O1](<3 - FABLED 2 — Optimization Plan.md>)).
2. **Close the single-source violations already decided** — one spend definition (done), one expansion engine (Schedule Stage 2), one account-creation function ([file 3 · O2](<3 - FABLED 2 — Optimization Plan.md>)).
3. **Adopt the repo-fidelity rule** — every live-DB object (RPC, policy) exists as a dated migration + `schema.sql` entry; Trips is the last offender ([file 3 · O3](<3 - FABLED 2 — Optimization Plan.md>)).

**Related FABLED 2:** [PM system](<../../10 - Project Management/FABLED 2/_index.md>) · [Standalone portfolio](<../../02 - Standalone Modules/FABLED 2/_index.md>) · [Junction health](<../../03 - Junction Modules/FABLED 2/_index.md>) · [Performance](<../../05 - Performance/FABLED 2/_index.md>)
