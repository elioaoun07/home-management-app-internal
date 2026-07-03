---
created: 2026-07-02
type: deep-dive
status: living
owner: Elio
tags:
  - pm/fabled2
  - pm/far
---

# FAR Checklist · FABLED 2.4 — Evolving the Mechanism

> **FABLED 2:** [_index](<_index.md>) · [1 · Scoreboard](<1 - FABLED 2 — Current Implementation.md>) · [2 · Gaps](<2 - FABLED 2 — Gaps & Missing.md>) · [3 · Optimization](<3 - FABLED 2 — Optimization Plan.md>) · **4 · Enhancements**

---

## E1 — Plan in phases-with-gates, not dated weeks

The 13-week dated grid was false precision for a pain-driven solo project. Keep the FAR's *phases and exit gates* (those were right); drop per-week dating except for the current week. A phase is "done when gate met," and the gate is mechanically checkable (post-O3 CI).

## E2 — Budget the week, don't schedule it

A weekly *ratio* target beats a task grid: e.g., 60% campaign/pain work · 25% FAR-phase work · 15% hygiene sweep. The Monday two-liner reports the actual split. This legitimizes the reactive work (which June proved is often the right call) while guaranteeing the strategic and hygiene lanes never hit zero — which is exactly what happened in weeks 1–3.

## E3 — Auto-fill the scoreboard

When the PM reconciliation + git-delta scripts exist ([PM FABLED 2.4 · E2/E3](<../../FABLED 2/4 - FABLED 2 — Future Enhancements.md>)), the [file 1](<1 - FABLED 2 — Current Implementation.md>) scoreboard becomes generated: plan items ↔ touched paths ↔ test counts. The weekly review then *reads* the scoreboard instead of assembling it.

## E4 — Sunset rule for this folder

When the FAR's Phase 3 exit gate is met (or the FAR is superseded by a FAR 2.0 — see [FAR FABLED 2.4](<../../Functional Architecture Review/FABLED 2/4 - FABLED 2 — Future Enhancements.md>)), freeze this checklist folder with a closing note. Execution scaffolding should end; only the vault docs live forever.
