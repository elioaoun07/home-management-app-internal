---
created: 2026-07-18
type: deep-dive
status: living
owner: Elio (authored by Claude Fable 5, handoff session)
generation: 3
trigger: model-generation-handoff
predecessor: ../FABLED 2/3 - FABLED 2 — Optimization Plan.md
tags:
  - pm/fabled3
  - pm/meta
---

# Project Management · FABLED 3.3 — Optimization Plan

[_index](<_index.md>) · [3.1 Current](<1 - FABLED 3 — Current Implementation.md>) · [3.2 Gaps](<2 - FABLED 3 — Gaps & Missing.md>) · [3.4 Enhancements](<4 - FABLED 3 — Future Enhancements.md>) · [3.5 Successor Briefing](<5 - FABLED 3 — Successor Briefing.md>)

**Verified 2026-07-18.** Ordered.

1. **O1 — Institute the hygiene sweep as a *scheduled* ritual (S).** Carried from v2 (its O2), now with proof: the only two flagged-fix executions in 6 weeks happened inside audit sessions. Mechanism: a recurring "Now" line in this campaign's checklist + the freshness radar printing the oldest open S-effort item every session. No new tooling.
2. **O2 — Meta-work budget rule (S, docs).** Add one line to `_Conventions.md`: *a session that only touches `ERA Notes/` or `scripts/pm/` must state which product-code item it unblocks; two consecutive such sessions require a product session between them.* Gap #2 becomes self-limiting instead of self-documenting.
3. **O3 — JSDoc-type the `shared/` parsing core (M).** Five files, pure functions, the lint.mjs fix (2026-07-18) is the exact template. Typecheck then guards the scanner that everything else trusts.
4. **O4 — SW cache-version assertion (S).** `static-twin.test.ts` already compares builds; extend it to assert `sw.js` cache key changes when `pm:build-ui` output changes. Kills Gap #4 for the cost of one test.
5. **O5 — Session-history retention note (S).** One frontmatter convention (`status: archived` after N days) + radar coverage for `11 - docs`.
6. **O6 — Pause Delivery Workspace UI until the plan exits DRAFT (decision, not work).** Record in the campaign `_index` that `src/features/delivery/` is frozen pending owner approval — makes Gap #5 an explicit decision instead of drift.
