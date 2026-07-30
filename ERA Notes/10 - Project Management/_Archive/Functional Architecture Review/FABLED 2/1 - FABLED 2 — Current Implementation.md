---
created: 2026-07-02
type: deep-dive
status: living
owner: Elio
tags:
  - pm/fabled2
  - pm/far
---

# FAR · FABLED 2.1 — The Thesis Scoreboard

> **FABLED 2:** [_index](<_index.md>) · **1 · Scoreboard** · [2 · Gaps](<2 - FABLED 2 — Gaps & Missing.md>) · [3 · Optimization](<3 - FABLED 2 — Optimization Plan.md>) · [4 · Enhancements](<4 - FABLED 2 — Future Enhancements.md>)
>
> Each core FAR claim, tested against three weeks of reality (verified 2026-07-02).

---

## Theses that held

| FAR claim | Reality check | Verdict |
|---|---|---|
| **Anti-roadmap: no new standalone modules until October** | June shipped zero new modules — all work landed inside existing ones | ✅ held |
| **"The intelligence exists; the delivery doesn't"** (sense → reason built; compose → deliver → approve → learn missing) | Still exactly true: no insights store, no composer, no policy, no feedback loop | ✅ held (unfortunately) |
| **Money-math trust gates everything (C8)** | June's reconciliation sprint *was* a trust campaign in disguise — penny-exact spend, tested forecast substrate | ✅ held, progressed obliquely |
| **No open-banking; SMS/receipt capture instead (C9)** | No open-banking work happened; capture upgrade still pending | ✅ held |
| **No Capacitor until trigger fires** | Still PWA; NFC work continued within PWA constraints | ✅ held |
| **Junction leverage: bridges > tools** | Kitchen (all bridges, no tools) stagnated while tool-modules sprinted — negative confirmation of the thesis | ✅ held, by counterexample |

## The amendment June forces

The FAR modeled progress as *phase work on the spine*. June shows a second productive mode: **campaign work that manufactures spine parts without touching the spine.** Concretely: `budgetForecast` + `anomalyDetection` (= signal math for R4/A1/A2), the bulk-convert reviewed-proposal sheet (= the confirm card J4/R3 needs), typed + correctly-routed notifications (= delivery substrate), `AnalysisReport` (= the composed-answer contract). **Amendment:** the nervous-system build should now be framed as *assembly of existing parts*, not construction — which changes its cost from M–H to M ([file 3](<3 - FABLED 2 — Optimization Plan.md>)).

## Theses not yet tested

- **The 90-day "normal Tuesday" definition of done** — untestable until Phase 2 starts; no briefing has ever fired.
- **Speaks-First Ratio, Proactive Hit Rate, Notification Regret** — the FAR's metrics still have no measurement plumbing (act/dismiss recording is [Notifications FABLED 2.3 · O4](<../../Notifications & Alerts/FABLED 2/3 - FABLED 2 — Optimization Plan.md>)).
- **The C-series challenge verdicts** — the scoreboard in FAR 6 was never filled ([FAR Checklist FABLED 2.1](<../../FAR Execution Checklist/FABLED 2/1 - FABLED 2 — Current Implementation.md>) item 1.5).
