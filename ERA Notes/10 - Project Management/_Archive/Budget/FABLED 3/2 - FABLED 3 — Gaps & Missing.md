---
created: 2026-07-18
type: deep-dive
status: living
owner: Elio (authored by Claude Fable 5, handoff session)
generation: 3
trigger: model-generation-handoff
predecessor: ../FABLED 2/2 - FABLED 2 — Gaps & Missing.md
tags:
  - pm/fabled3
  - module/budget
---

# Budget · FABLED 3.2 — Gaps & Missing

[_index](<_index.md>) · [3.1 Current](<1 - FABLED 3 — Current Implementation.md>) · [3.3 Optimization](<3 - FABLED 3 — Optimization Plan.md>) · [3.4 Enhancements](<4 - FABLED 3 — Future Enhancements.md>) · [3.5 Successor Briefing](<5 - FABLED 3 — Successor Briefing.md>)

> **Inheritance (verified 2026-07-18):** v2's gap list stands except where noted. Delta only.

1. **RESOLVED — debug/diagnostic routes** (v2 Code-health item): deleted 2026-07-18. Took 6 weeks and a generational audit to execute a 15-minute fix — logged as PM-system Gap #1 evidence, not a Budget problem.
2. **PARTIALLY RESOLVED — route-test absolutism**: recurring has contract tests; **transactions and accounts still have zero**, and they carry the household-linking logic (Hard Rule 13) that changed most in June.
3. **NEW — two 3,000-line blobs.** `MobileExpenseForm.tsx` 3,099 (grew +115 since v2 measured 2,984) and `recurring/page.tsx` 3,083 (new). Both mix data orchestration with presentation; both are where the next regression hides. The commitments engine's clean extraction proves the cure works.
4. **NEW — commitments matching is heuristic and silent.** `matched` state depends on amount/account/date-window rules in `commitments.ts`; a false match shows a commitment as handled when it isn't (silent-failure taxonomy: *wrong-but-plausible display*). The test file covers the ladder but the window/tolerance constants deserve a worked-example table in the vault doc.
5. **Merchant mappings stop at import** (carried, now sharper): the API exists, manual entry still doesn't consult it — the learning loop is half-closed.
6. Everything else in v2 file 2 (bridges to Schedule, console.* hotspots in finance routes, LBP display rules) — unchanged, still open.
