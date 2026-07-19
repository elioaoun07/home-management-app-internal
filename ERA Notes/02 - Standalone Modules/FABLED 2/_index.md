---
created: 2026-07-02
type: index
status: baseline-frozen
superseded: 2026-07-18
owner: Elio
tags:
  - pm/fabled2
  - scope/standalone
---

# Standalone Modules · FABLED 2 — Index

> ⚠️ **Frozen v2 baseline (2026-07-02)** — superseded 2026-07-18 by [`FABLED 3/`](<../FABLED 3/_index.md>) (model-generation handoff). Do not update; new history goes to the FABLED 3 delta ledger.


> The **portfolio-level** deep-dive over all standalone modules — the view no single module doc gives: coverage, health distribution, orphans, and where the portfolio itself (not any one module) needs work. Verified against the working tree **2026-07-02**. Per-module depth lives in each module's vault doc and, for campaign-covered clusters, in the PM FABLED 2 folders.

| # | File | Read it when… |
|---|---|---|
| 1 | [Current Implementation](<1 - FABLED 2 — Current Implementation.md>) | You want the portfolio map: tiers, doc coverage, test coverage, ownership. |
| 2 | [Gaps & Missing](<2 - FABLED 2 — Gaps & Missing.md>) | You want the portfolio's holes — orphans, unclassified dirs, uncovered strays. |
| 3 | [Optimization Plan](<3 - FABLED 2 — Optimization Plan.md>) | You want the portfolio hygiene moves. |
| 4 | [Future Enhancements](<4 - FABLED 2 — Future Enhancements.md>) | You want portfolio-level ideas — lifecycle states, module scorecards. |

## Maturity scoreboard (2026-07-02)

| Dimension | Score | One-line justification |
|---|---|---|
| **Doc coverage** | 8 | Every shipping standalone now has an Overview.md (the May "5–6 missing" gap is closed — verified today). |
| **Boundary compliance** | 7 | The no-cross-import rule appears respected; not yet mechanically checked. |
| **Health distribution** | 6 | Finance + Schedule cores strong and (partly) tested; long tail of 🔵 modules stable but unprotected. |
| **Portfolio hygiene** | 4 | `blink/` + `today/` empty dirs persist; `memories/` undecided; `receipts` unclassified; `navigation/`+`dashboard/` misfiled utils. |
| **Overall** | **6.2** | A healthy portfolio with a small, stubborn pile of dead weight nobody's swept. |

## The next 3 moves

1. **Run the orphan sweep** — the same six items flagged since May ([file 3 · O1](<3 - FABLED 2 — Optimization Plan.md>)).
2. **Classify the stragglers** — `memories`, `receipts`, `navigation`, `dashboard` prefetch dir ([file 2 · G2](<2 - FABLED 2 — Gaps & Missing.md>)).
3. **Mechanize the boundary rule** — the 20-line cross-import checker ([Architecture FABLED 2.4 · E6](<../../01 - Architecture/FABLED 2/4 - FABLED 2 — Future Enhancements.md>)).

**Related FABLED 2:** [Architecture](<../../01 - Architecture/FABLED 2/_index.md>) · [Junctions](<../../03 - Junction Modules/FABLED 2/_index.md>) · campaign folders under [10 - Project Management](<../../10 - Project Management/FABLED 2/_index.md>)
