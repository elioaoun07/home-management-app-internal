---
created: 2026-07-18
type: deep-dive
status: living
owner: Elio (authored by Claude Fable 5, handoff session)
generation: 3
trigger: model-generation-handoff
predecessor: ../FABLED 2/4 - FABLED 2 — Future Enhancements.md
tags:
  - pm/fabled3
  - module/budget
---

# Budget · FABLED 3.4 — Future Enhancements

[_index](<_index.md>) · [3.1 Current](<1 - FABLED 3 — Current Implementation.md>) · [3.2 Gaps](<2 - FABLED 3 — Gaps & Missing.md>) · [3.3 Optimization](<3 - FABLED 3 — Optimization Plan.md>) · [3.5 Successor Briefing](<5 - FABLED 3 — Successor Briefing.md>)

> **Inheritance (verified 2026-07-18):** [FABLED 2 file 4](<../FABLED 2/4 - FABLED 2 — Future Enhancements.md>) E1–E10 carry forward with their kill criteria intact. E-status delta: the recurring-reconciliation idea family is now **partially shipped** via the commitments engine. Gen-3 additions:

- **E11 — Commitment-aware briefing line** ⭐ · Impact high · Effort S · Seam: `commitments.ts` is pure — the ERA briefing can call it server-side and say "2 commitments look missed this period." Read-only, no auto-posting (drafts doctrine). Kill: needs the Awakening briefing live; park until it renders somewhere.
- **E12 — `missed` → draft proposal** ⭐ · Impact high · Effort M · Seam: when a commitment is `missed` and a near-match transaction exists just outside tolerance, propose a draft link (human confirms). This is the AI-proposes/human-confirms pattern applied to reconciliation. Kill: if false-match complaints appear at current tolerances, fix O3's constants first — never widen matching to feed proposals.
- **E13 — Matching-tolerance self-report** ⭐ · Impact low-medium · Effort S · Seam: count `matched` decisions per month with amount deltas; one line in analytics. Turns the silent heuristic into an observable one. Kill: skip if E12 isn't pursued — observability for an unused path is meta-work.
