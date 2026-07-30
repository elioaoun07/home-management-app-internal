---
created: 2026-07-02
type: deep-dive
status: living
owner: Elio
tags:
  - pm/fabled2
  - pm/far
---

# FAR Checklist · FABLED 2.3 — The Re-Baseline

> **FABLED 2:** [_index](<_index.md>) · [1 · Scoreboard](<1 - FABLED 2 — Current Implementation.md>) · [2 · Gaps](<2 - FABLED 2 — Gaps & Missing.md>) · **3 · Optimization** · [4 · Enhancements](<4 - FABLED 2 — Future Enhancements.md>)
>
> Don't extend the fiction that it's week 3 of the original plan. Re-baseline once, honestly, and change the mechanism so the new baseline can't silently die the same way.

---

## O1 — Declare Phase 1 restructured (one edit to the master checklist)

Mark the scoreboard's ✅/◐/❌ against Phase 1 with a `2026-07-02 re-baseline` note. Move the ❌ items to their real homes:

- Intent fixtures → [Hub & ERA FABLED 2.3 · O1](<../../Hub & ERA/FABLED 2/3 - FABLED 2 — Optimization Plan.md>) (already sequenced there).
- Wake word → the do-or-park deadline ([Hub & ERA FABLED 2.4 · E3](<../../Hub & ERA/FABLED 2/4 - FABLED 2 — Future Enhancements.md>): decide by end of July).
- Orphan sweep + debug routes → the hygiene sweep ritual ([PM FABLED 2.3 · O2](<../../FABLED 2/3 - FABLED 2 — Optimization Plan.md>)).
- Gamification audit + decision scoreboard → one honest hour each, or strike them with a dated "not doing" (the FAR's own adopt-or-reject convention).

## O2 — Re-anchor Phase 2 on its real precondition

Phase 2 ("nervous system," originally weeks 4–8) starts when: suite green · intent fixtures exist · **delivery policy skeleton designed** ([Notifications FABLED 2.4 · E1](<../../Notifications & Alerts/FABLED 2/4 - FABLED 2 — Future Enhancements.md>) — June's insight: policy before composer). Date it by precondition, not by calendar week.

## O3 — Minimal CI so gates become checkable (fixes G5)

One GitHub Action: `pnpm test` + `pnpm docs:check` on push. Twenty minutes. "Green in CI" becomes a fact instead of a phrase — and the ratchet checks ([Audit FABLED 2.4 · E3](<../../Codebase Audit 2026-07-01/FABLED 2/4 - FABLED 2 — Future Enhancements.md>)) get a home.

## O4 — The Monday two-liner (the smallest ritual that fixes G1/G4)

Every Monday, file 4 (This Week) opens with two lines: *"Last week the plan said X; what happened was Y."* That's the entire mechanism — divergence becomes a sentence you write instead of a month you reconstruct. When the auto-delta report ships, Y auto-fills.
